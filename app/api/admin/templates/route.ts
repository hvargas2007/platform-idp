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

// Validation schema for GitHub template
const githubTemplateSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  category: z.string(),
  icon: z.string(),
  githubUrl: z.string().url(),
  githubToken: z.string().optional(),
  branch: z.string().default("main"),
  features: z.array(z.string()),
  includeBranches: z.boolean().default(false),
  isPrivate: z.boolean().default(false)
})

// GET /api/admin/templates - List all templates
export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin()
  if (adminCheck.error) return adminCheck.error

  try {
    const templates = await prisma.gitHubTemplate.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
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

    return NextResponse.json(templates)
  } catch (error) {
    console.error("Error fetching templates:", error)
    return NextResponse.json(
      { error: "Error fetching templates" },
      { status: 500 }
    )
  }
}

// POST /api/admin/templates - Create new template
export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin()
  if (adminCheck.error) return adminCheck.error

  try {
    const body = await request.json()
    const validatedData = githubTemplateSchema.parse(body)

    // Check if templateId already exists
    const existing = await prisma.gitHubTemplate.findUnique({
      where: { templateId: validatedData.templateId }
    })

    if (existing) {
      return NextResponse.json(
        { error: "Template ID already exists" },
        { status: 400 }
      )
    }

    // Parse GitHub URL to extract owner and repo
    const parsed = parseGitHubUrl(validatedData.githubUrl)
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid GitHub URL format" },
        { status: 400 }
      )
    }

    // Validate repository exists and is accessible
    const octokit = new Octokit({
      auth: validatedData.githubToken || process.env.GITHUB_TOKEN
    })

    try {
      const { data: repoData } = await octokit.repos.get({
        owner: parsed.owner,
        repo: parsed.repo
      })

      // Check if it's an organization
      let githubOrganization: string | undefined
      try {
        const { data: ownerData } = await octokit.users.getByUsername({
          username: parsed.owner
        })
        
        if (ownerData.type === 'Organization') {
          githubOrganization = parsed.owner
        }
      } catch (error) {
        // Ignore - organization check is optional
      }

      // Prepare data for creation
      const templateData: any = {
        templateId: validatedData.templateId,
        name: validatedData.name,
        description: validatedData.description,
        category: validatedData.category,
        icon: validatedData.icon,
        githubUrl: validatedData.githubUrl,
        branch: validatedData.branch,
        features: validatedData.features,
        includeBranches: validatedData.includeBranches,
        isPrivate: repoData.private, // Use actual repo privacy status
        owner: parsed.owner,
        repoName: parsed.repo,
        githubOrganization,
        createdBy: adminCheck.userId
      }

      // Encrypt and store token if provided
      if (validatedData.githubToken) {
        templateData.githubToken = encrypt(validatedData.githubToken)
      }

      const template = await prisma.gitHubTemplate.create({
        data: templateData,
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
      const { githubToken, ...templateResponse } = template
      
      return NextResponse.json(templateResponse, { status: 201 })
    } catch (error: any) {
      if (error.status === 404) {
        return NextResponse.json(
          { error: "Repository not found or not accessible with provided credentials" },
          { status: 400 }
        )
      }
      throw error
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error creating template:", error)
    return NextResponse.json(
      { error: "Error creating template" },
      { status: 500 }
    )
  }
}