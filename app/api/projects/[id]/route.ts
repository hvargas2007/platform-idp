import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    // First check if the project exists and belongs to the user
    const project = await prisma.project.findFirst({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Soft delete - update status to DELETED instead of hard delete
    const updatedProject = await prisma.project.update({
      where: { id },
      data: { 
        status: "DELETED",
        updatedAt: new Date()
      }
    })

    return NextResponse.json({ 
      message: "Project deleted successfully",
      project: updatedProject 
    })
  } catch (error) {
    console.error("Error deleting project:", error)
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const project = await prisma.project.findFirst({
      where: {
        id,
        userId: session.user.id
      },
      include: {
        githubTemplate: {
          select: {
            name: true,
            description: true,
            category: true
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Return project data without sensitive information
    return NextResponse.json({
      id: project.id,
      name: project.name,
      description: project.description,
      githubRepo: project.githubRepo,
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      awsRole: project.awsRole,
      awsRegion: project.awsRegion,
      awsBackend: project.awsBackend,
      projectName: project.projectName,
      usernameGithub: project.usernameGithub,
      // Don't send the access token for security
      hasAccessToken: !!project.accessToken,
      githubTemplate: project.githubTemplate
    })
  } catch (error) {
    console.error("Error fetching project:", error)
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    )
  }
}