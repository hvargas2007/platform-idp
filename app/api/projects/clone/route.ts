import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { GitHubRepoCloner } from "@/lib/github/repo-cloner"
import { safeDecrypt, encrypt } from "@/lib/encryption"
import { GitHubSecretsManager } from "@/lib/github/secrets"

export async function POST(request: NextRequest) {
  console.log("POST /api/projects/clone - Request received")
  
  const session = await auth()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  try {
    const body = await request.json()
    const { 
      sourceUrl, 
      name, 
      description, 
      isPrivate,
      includeBranches = true,
      githubTemplateId,
      githubUsername,
      githubToken,
      awsConfig
    } = body
    
    console.log("Clone request:", { sourceUrl, name, isPrivate, includeBranches, githubTemplateId, hasCustomCredentials: !!(githubUsername && githubToken) })
    
    // Validate custom credentials if provided
    if (githubUsername && !githubToken) {
      return NextResponse.json({ error: "GitHub token is required when providing a username" }, { status: 400 })
    }
    if (!githubUsername && githubToken) {
      return NextResponse.json({ error: "GitHub username is required when providing a token" }, { status: 400 })
    }
    
    // Parsear la URL del repositorio fuente
    const match = sourceUrl.match(/github\.com\/([^\/]+)\/([^\/\?.]+)/)
    if (!match) {
      return NextResponse.json({ error: "URL de GitHub inválida" }, { status: 400 })
    }
    
    const sourceOwner = match[1]
    const sourceRepo = match[2].replace('.git', '')
    
    // Get source token if cloning from a template
    let sourceToken: string | undefined
    let actualTemplateId: string | null = null
    
    if (githubTemplateId) {
      // First try to find by database id
      let template = await prisma.gitHubTemplate.findUnique({
        where: { id: githubTemplateId }
      })
      
      // If not found, try to find by templateId field
      if (!template) {
        template = await prisma.gitHubTemplate.findUnique({
          where: { templateId: githubTemplateId }
        })
      }
      
      if (template) {
        actualTemplateId = template.id // Use the actual database ID
        if (template.githubToken) {
          // Use safeDecrypt to handle both encrypted and plain text tokens
          sourceToken = safeDecrypt(template.githubToken)
          console.log(`Token decrypted successfully for template: ${template.name}`)
        }
      } else {
        console.warn(`Template not found with id/templateId: ${githubTemplateId}`)
      }
    }
    
    // Prepare AWS configuration data
    const awsData: any = {}
    if (awsConfig) {
      awsData.awsRole = awsConfig.awsRole || null
      awsData.awsRegion = awsConfig.awsRegion || null
      awsData.awsBackend = awsConfig.awsBackend || null
      awsData.projectName = awsConfig.projectName || null
      awsData.usernameGithub = awsConfig.usernameGithub || null
      // Encrypt sensitive data
      awsData.accessToken = awsConfig.accessToken ? encrypt(awsConfig.accessToken) : null
    }
    
    // Crear proyecto en la base de datos
    const project = await prisma.project.create({
      data: {
        name,
        description: description || `Cloned from ${sourceOwner}/${sourceRepo}`,
        userId: session.user.id,
        status: "ACTIVE",
        githubTemplateId: actualTemplateId, // Use the actual database ID
        ...awsData
      }
    })
    
    // Determine which token to use for target repository creation
    let userToken: string | undefined
    
    if (githubUsername && githubToken) {
      // Use provided custom credentials
      userToken = githubToken
      console.log(`Using custom GitHub credentials for user: ${githubUsername}`)
    } else {
      // Get the user's GitHub token from their account
      const userAccount = await prisma.account.findFirst({
        where: {
          userId: session.user.id,
          provider: 'github'
        }
      })
      
      userToken = userAccount?.access_token || undefined
      
      if (!userToken) {
        console.warn('No GitHub token available for user')
      }
    }
    
    // Clonar el repositorio
    const cloner = new GitHubRepoCloner(userToken, sourceToken)
    const result = await cloner.cloneAsTemplate({
      sourceOwner,
      sourceRepo,
      targetName: name,
      targetDescription: description,
      isPrivate,
      includeBranches,
      sourceToken,
      targetUsername: githubUsername // Pass custom username if provided
    })
    
    // Actualizar proyecto con la URL del repo
    await prisma.project.update({
      where: { id: project.id },
      data: { 
        githubRepo: result.repository.html_url
      }
    })
    
    // Configure GitHub secrets and variables if AWS config is provided
    if (awsConfig && userToken) {
      try {
        console.log("Configuring GitHub secrets and variables for AWS deployment")
        
        const repoInfo = GitHubSecretsManager.parseRepoUrl(result.repository.html_url)
        if (repoInfo) {
          const secretsManager = new GitHubSecretsManager(
            userToken,
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
          
          console.log("GitHub secrets and variables configured successfully")
        }
      } catch (secretsError) {
        console.error("Error configuring GitHub secrets:", secretsError)
        // Don't fail the entire operation if secrets configuration fails
        // The project and repository were created successfully
      }
    }
    
    return NextResponse.json({
      id: project.id,
      name: project.name,
      githubUrl: result.repository.html_url,
      filesCount: result.filesCount,
      message: result.message
    })
    
  } catch (error: any) {
    console.error("Error cloning project:", error)
    
    // Provide more specific error messages
    let errorMessage = error.message || "Error cloning project"
    let statusCode = 500
    
    if (error.message?.includes('Bad credentials') || error.message?.includes('Authentication failed')) {
      errorMessage = "Authentication failed. Please ensure you're logged in with GitHub and have the necessary permissions."
      statusCode = 401
    } else if (error.message?.includes('Not Found')) {
      errorMessage = error.message // Use the detailed message from repo-cloner
      statusCode = 404
    } else if (error.message?.includes('Repository creation failed') || error.message?.includes('Access denied')) {
      errorMessage = error.message // Use the detailed message from repo-cloner
      statusCode = 403
    } else if (error.message?.includes('already exists')) {
      errorMessage = error.message // Use the detailed message from repo-cloner
      statusCode = 409
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}