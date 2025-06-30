import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { encrypt, safeDecrypt } from "@/lib/encryption"
import { GitHubSecretsManager } from "@/lib/github/secrets"

interface AwsConfig {
  awsRole?: string
  awsRegion?: string
  awsBackend?: string
  projectName?: string
  accessToken?: string
  usernameGithub?: string
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
      }
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Return the AWS configuration (decrypt sensitive data)
    const awsConfig = {
      awsRole: project.awsRole,
      awsRegion: project.awsRegion,
      awsBackend: project.awsBackend,
      projectName: project.projectName,
      usernameGithub: project.usernameGithub,
      // Don't return the actual token for security
      hasAccessToken: !!project.accessToken
    }

    return NextResponse.json({ awsConfig })
  } catch (error) {
    console.error("Error fetching AWS config:", error)
    return NextResponse.json(
      { error: "Failed to fetch AWS configuration" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const body = await request.json()
    const awsConfig: AwsConfig = body.awsConfig || {}

    // Find the project
    const project = await prisma.project.findFirst({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    if (!project.githubRepo) {
      return NextResponse.json({ error: "Project has no GitHub repository" }, { status: 400 })
    }

    // Update project with AWS configuration
    const updateData: any = {
      awsRole: awsConfig.awsRole || null,
      awsRegion: awsConfig.awsRegion || null,
      awsBackend: awsConfig.awsBackend || null,
      projectName: awsConfig.projectName || null,
      usernameGithub: awsConfig.usernameGithub || null,
    }

    // Encrypt access token if provided
    if (awsConfig.accessToken) {
      updateData.accessToken = encrypt(awsConfig.accessToken)
    }

    await prisma.project.update({
      where: { id },
      data: updateData
    })

    // Get GitHub token
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: 'github'
      }
    })

    if (!account?.access_token) {
      return NextResponse.json(
        { error: "GitHub account not connected" },
        { status: 400 }
      )
    }

    // Parse GitHub repo URL
    const repoInfo = GitHubSecretsManager.parseRepoUrl(project.githubRepo)
    if (!repoInfo) {
      return NextResponse.json({ error: "Invalid GitHub repository URL" }, { status: 400 })
    }

    // Configure GitHub secrets and variables
    const secretsManager = new GitHubSecretsManager(
      account.access_token,
      repoInfo.owner,
      repoInfo.repo
    )
    
    await secretsManager.configureSecretsAndVariables({
      secrets: {
        ACCESS_TOKEN: awsConfig.accessToken,
        USERNAME_GITHUB: awsConfig.usernameGithub
      },
      variables: {
        AWS_ROLE: awsConfig.awsRole,
        AWS_REGION: awsConfig.awsRegion,
        AWS_BACKEND: awsConfig.awsBackend,
        PROJECT_NAME: awsConfig.projectName
      }
    })

    return NextResponse.json({ 
      message: "AWS configuration updated and GitHub secrets/variables set successfully" 
    })

  } catch (error: any) {
    console.error("Error updating AWS config:", error)
    
    let errorMessage = "Failed to update AWS configuration"
    if (error.message?.includes("Not Found")) {
      errorMessage = "Repository not found or you don't have access"
    } else if (error.message?.includes("Forbidden")) {
      errorMessage = "You don't have permission to set secrets on this repository"
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

