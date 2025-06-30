import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { encrypt } from "@/lib/encryption"
import { Octokit } from "@octokit/rest"

// Extract owner and repo from GitHub URL
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/\?.]+)/,
    /github\.com:([^\/]+)\/([^\/\?.]+)/
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      const owner = match[1]
      const repo = match[2].replace('.git', '')
      return { owner, repo }
    }
  }
  
  return null
}

// Validation schema for updating GitHub template
const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  icon: z.string().optional(),
  githubUrl: z.string().url().optional(),
  githubToken: z.string().optional(),
  branch: z.string().optional(),
  features: z.array(z.string()).optional(),
  includeBranches: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  isActive: z.boolean().optional()
})

// PUT /api/admin/templates/[id] - Update template
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const adminCheck = await requireAdmin()
  if (adminCheck.error) return adminCheck.error

  try {
    const body = await request.json()
    const validatedData = updateTemplateSchema.parse(body)

    // Check if template exists
    const existing = await prisma.gitHubTemplate.findUnique({
      where: { id: params.id }
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: any = { ...validatedData }
    
    // If GitHub URL is being updated, parse and validate it
    if (validatedData.githubUrl) {
      const parsed = parseGitHubUrl(validatedData.githubUrl)
      if (!parsed) {
        return NextResponse.json(
          { error: "Invalid GitHub URL format" },
          { status: 400 }
        )
      }
      
      // Validate repository exists and is accessible
      const octokit = new Octokit({
        auth: validatedData.githubToken || existing.githubToken || process.env.GITHUB_TOKEN
      })
      
      try {
        const { data: repoData } = await octokit.repos.get({
          owner: parsed.owner,
          repo: parsed.repo
        })
        
        // Update parsed fields
        updateData.owner = parsed.owner
        updateData.repoName = parsed.repo
        updateData.isPrivate = repoData.private
        
        // Check if it's an organization
        try {
          const { data: ownerData } = await octokit.users.getByUsername({
            username: parsed.owner
          })
          
          updateData.githubOrganization = ownerData.type === 'Organization' ? parsed.owner : null
        } catch (error) {
          // Ignore - organization check is optional
        }
      } catch (error: any) {
        if (error.status === 404) {
          return NextResponse.json(
            { error: "Repository not found or not accessible with provided credentials" },
            { status: 400 }
          )
        }
        throw error
      }
    }
    
    // Encrypt token if provided
    if (validatedData.githubToken !== undefined) {
      updateData.githubToken = validatedData.githubToken ? encrypt(validatedData.githubToken) : null
    }

    const updated = await prisma.gitHubTemplate.update({
      where: { id: params.id },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    // Don't return the encrypted token
    const { githubToken, ...templateResponse } = updated
    
    return NextResponse.json(templateResponse)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error updating template:", error)
    return NextResponse.json(
      { error: "Error updating template" },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/templates/[id] - Delete template (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const adminCheck = await requireAdmin()
  if (adminCheck.error) return adminCheck.error

  try {
    // Check if template exists
    const existing = await prisma.gitHubTemplate.findUnique({
      where: { id: params.id }
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      )
    }

    // Soft delete by setting isActive to false
    await prisma.gitHubTemplate.update({
      where: { id: params.id },
      data: { isActive: false }
    })

    return NextResponse.json({ message: "Template deleted successfully" })
  } catch (error) {
    console.error("Error deleting template:", error)
    return NextResponse.json(
      { error: "Error deleting template" },
      { status: 500 }
    )
  }
}