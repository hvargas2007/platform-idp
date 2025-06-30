import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/templates/github-list - List user's templates and optionally admin templates
export async function GET(request: NextRequest) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get URL search params
    const searchParams = request.nextUrl.searchParams
    const includeAdmin = searchParams.get("includeAdmin") === "true"

    // Build where clause based on user preferences
    let whereClause: any = {
      isActive: true,
      OR: [
        { createdBy: session.user.id }, // User's own templates
      ]
    }

    // If includeAdmin is true or user is admin, include admin templates
    if (includeAdmin || session.user.role === "ADMIN") {
      whereClause.OR.push({ createdBy: null }) // Admin templates (legacy)
      
      // Also include templates created by admin users
      const adminUsers = await prisma.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true }
      })
      
      if (adminUsers.length > 0) {
        whereClause.OR.push({
          createdBy: { in: adminUsers.map(u => u.id) }
        })
      }
    }

    const templates = await prisma.gitHubTemplate.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        templateId: true,
        name: true,
        description: true,
        category: true,
        icon: true,
        githubUrl: true,
        branch: true,
        features: true,
        includeBranches: true,
        isPrivate: true,
        createdBy: true
      }
    })

    // Add isOwner flag to each template
    const templatesWithOwnership = templates.map(template => ({
      ...template,
      isOwner: template.createdBy === session.user.id
    }))

    return NextResponse.json(templatesWithOwnership)
  } catch (error) {
    console.error("Error fetching templates:", error)
    return NextResponse.json(
      { error: "Error fetching templates" },
      { status: 500 }
    )
  }
}