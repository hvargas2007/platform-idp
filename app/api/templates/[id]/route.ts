import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// DELETE /api/templates/[id] - Delete a user's template
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check if the template exists and belongs to the user
    const template = await prisma.gitHubTemplate.findFirst({
      where: {
        id: params.id,
        createdBy: session.user.id
      }
    })

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      )
    }

    // Check if any projects are using this template
    const projectsUsingTemplate = await prisma.project.count({
      where: {
        githubTemplateId: params.id
      }
    })

    if (projectsUsingTemplate > 0) {
      // Soft delete - mark as inactive instead of deleting
      await prisma.gitHubTemplate.update({
        where: { id: params.id },
        data: { isActive: false }
      })
    } else {
      // Hard delete if no projects are using it
      await prisma.gitHubTemplate.delete({
        where: { id: params.id }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting template:", error)
    return NextResponse.json(
      { error: "Error deleting template" },
      { status: 500 }
    )
  }
}

// PUT /api/templates/[id] - Update a user's template
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()

    // Check if the template exists and belongs to the user
    const template = await prisma.gitHubTemplate.findFirst({
      where: {
        id: params.id,
        createdBy: session.user.id
      }
    })

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      )
    }

    // Update the template
    const updated = await prisma.gitHubTemplate.update({
      where: { id: params.id },
      data: {
        name: body.name,
        description: body.description,
        category: body.category,
        icon: body.icon,
        branch: body.branch,
        features: body.features,
        includeBranches: body.includeBranches,
        isPrivate: body.isPrivate,
        githubToken: body.githubToken !== undefined ? body.githubToken : template.githubToken
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating template:", error)
    return NextResponse.json(
      { error: "Error updating template" },
      { status: 500 }
    )
  }
}