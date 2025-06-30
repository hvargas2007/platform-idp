import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/templates - List user's templates
export async function GET(request: NextRequest) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const templates = await prisma.gitHubTemplate.findMany({
      where: { 
        createdBy: session.user.id,
        isActive: true 
      },
      orderBy: { createdAt: "desc" }
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

// POST /api/templates - Create a new template for the user
export async function POST(request: NextRequest) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    
    // Validate required fields
    const requiredFields = ["templateId", "name", "githubUrl"]
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // Check if templateId already exists for this user
    const existing = await prisma.gitHubTemplate.findFirst({
      where: {
        templateId: body.templateId,
        createdBy: session.user.id
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: "Template with this ID already exists" },
        { status: 409 }
      )
    }

    // Parse GitHub URL to extract owner and repo
    const githubUrlMatch = body.githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/)
    if (!githubUrlMatch) {
      return NextResponse.json(
        { error: "Invalid GitHub URL format" },
        { status: 400 }
      )
    }

    const [, owner, repoName] = githubUrlMatch
    const isOrganization = body.githubUrl.includes("/orgs/") || false // Simple check, can be improved

    // Create the template
    const template = await prisma.gitHubTemplate.create({
      data: {
        templateId: body.templateId,
        name: body.name,
        description: body.description || "",
        category: body.category || "other",
        icon: body.icon || "📦",
        githubUrl: body.githubUrl,
        githubToken: body.githubToken || null,
        githubOrganization: isOrganization ? owner : null,
        owner: owner,
        repoName: repoName.replace(/\.git$/, ""), // Remove .git suffix if present
        branch: body.branch || "main",
        features: body.features || [],
        includeBranches: body.includeBranches ?? true,
        isPrivate: body.isPrivate ?? false,
        isActive: true,
        createdBy: session.user.id
      }
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error: any) {
    console.error("Error creating template:", error)
    
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Template with this ID already exists" },
        { status: 409 }
      )
    }
    
    return NextResponse.json(
      { error: "Error creating template" },
      { status: 500 }
    )
  }
}