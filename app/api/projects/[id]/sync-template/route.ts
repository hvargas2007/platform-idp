import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Octokit } from "@octokit/rest"
import { safeDecrypt } from "@/lib/encryption"
import { GitHubRepoCloner } from "@/lib/github/repo-cloner"

interface TemplateUpdate {
  hasUpdates: boolean
  latestCommit?: {
    sha: string
    message: string
    date: string
    author: string
  }
  changedFiles?: string[]
}

// GET: Check if there are updates available from the template
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
    // Get project with template info
    const project = await prisma.project.findFirst({
      where: {
        id,
        userId: session.user.id
      },
      include: {
        githubTemplate: true
      }
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    if (!project.githubTemplate) {
      return NextResponse.json({ error: "Project was not created from a template" }, { status: 400 })
    }

    if (!project.githubRepo) {
      return NextResponse.json({ error: "Project does not have a GitHub repository" }, { status: 400 })
    }

    // Get user's GitHub token
    const userAccount = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: 'github'
      }
    })

    if (!userAccount?.access_token) {
      return NextResponse.json({ error: "GitHub authentication required" }, { status: 401 })
    }

    const octokit = new Octokit({
      auth: userAccount.access_token
    })

    // Parse repository URLs
    const projectRepoMatch = project.githubRepo.match(/github\.com\/([^\/]+)\/([^\/\?.]+)/)
    const templateRepoMatch = project.githubTemplate.githubUrl.match(/github\.com\/([^\/]+)\/([^\/\?.]+)/)

    if (!projectRepoMatch || !templateRepoMatch) {
      return NextResponse.json({ error: "Invalid repository URLs" }, { status: 400 })
    }

    const [, projectOwner, projectRepo] = projectRepoMatch
    const [, templateOwner, templateRepo] = templateRepoMatch

    // Get template repository info
    let templateOctokit = octokit
    if (project.githubTemplate.githubToken) {
      const templateToken = safeDecrypt(project.githubTemplate.githubToken)
      if (templateToken) {
        templateOctokit = new Octokit({ auth: templateToken })
      }
    }

    // Get latest commit from template
    const { data: templateCommits } = await templateOctokit.repos.listCommits({
      owner: templateOwner,
      repo: templateRepo.replace('.git', ''),
      sha: project.githubTemplate.branch || 'main',
      per_page: 1
    })

    if (!templateCommits.length) {
      return NextResponse.json({ 
        hasUpdates: false,
        message: "No commits found in template repository"
      })
    }

    const latestTemplateCommit = templateCommits[0]

    // Get the last sync commit from the project repository
    // Look for commits with sync-template in the message
    const { data: projectCommits } = await octokit.repos.listCommits({
      owner: projectOwner,
      repo: projectRepo.replace('.git', ''),
      per_page: 100
    })

    // Find the last sync commit or the initial commit
    const lastSyncCommit = projectCommits.find(commit => 
      commit.commit.message.includes('sync-template') || 
      commit.commit.message.includes('Initial commit from template')
    )
    
    // Extract template SHA from commit message if available
    let lastSyncedTemplateSha: string | null = null
    if (lastSyncCommit) {
      const shaMatch = lastSyncCommit.commit.message.match(/template-sha: ([a-f0-9]{40})/i)
      if (shaMatch) {
        lastSyncedTemplateSha = shaMatch[1]
      }
    }

    // Compare dates to determine if there are updates
    const templateCommitDate = new Date(latestTemplateCommit.commit.author?.date || '')
    const lastSyncDate = lastSyncCommit 
      ? new Date(lastSyncCommit.commit.author?.date || '')
      : new Date(project.createdAt)

    const hasUpdates = templateCommitDate > lastSyncDate

    const response: TemplateUpdate = {
      hasUpdates,
      latestCommit: {
        sha: latestTemplateCommit.sha,
        message: latestTemplateCommit.commit.message,
        date: latestTemplateCommit.commit.author?.date || '',
        author: latestTemplateCommit.commit.author?.name || 'Unknown'
      }
    }

    // If there are updates, get the list of changed files
    if (hasUpdates && lastSyncedTemplateSha) {
      try {
        const { data: comparison } = await templateOctokit.repos.compareCommits({
          owner: templateOwner,
          repo: templateRepo.replace('.git', ''),
          base: lastSyncedTemplateSha, // Use the template SHA from last sync
          head: latestTemplateCommit.sha
        })

        response.changedFiles = comparison.files?.map(file => file.filename) || []
      } catch (error) {
        console.error("Error comparing commits:", error)
        // Continue without file list - this might happen if the base commit is no longer available
      }
    } else if (hasUpdates) {
      // No previous template SHA, so all files are potentially changed
      response.changedFiles = ['All files (first sync or template SHA not found)']
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error("Error checking template updates:", error)
    return NextResponse.json(
      { error: "Failed to check template updates" },
      { status: 500 }
    )
  }
}

// POST: Sync the project with the latest template changes
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
    const { createPullRequest = true, directToMain = false } = body

    // Get project with template info
    const project = await prisma.project.findFirst({
      where: {
        id,
        userId: session.user.id
      },
      include: {
        githubTemplate: true
      }
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    if (!project.githubTemplate) {
      return NextResponse.json({ error: "Project was not created from a template" }, { status: 400 })
    }

    if (!project.githubRepo) {
      return NextResponse.json({ error: "Project does not have a GitHub repository" }, { status: 400 })
    }

    // Get user's GitHub token
    const userAccount = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: 'github'
      }
    })

    if (!userAccount?.access_token) {
      return NextResponse.json({ error: "GitHub authentication required" }, { status: 401 })
    }

    // Parse repository URLs
    const projectRepoMatch = project.githubRepo.match(/github\.com\/([^\/]+)\/([^\/\?.]+)/)
    const templateRepoMatch = project.githubTemplate.githubUrl.match(/github\.com\/([^\/]+)\/([^\/\?.]+)/)

    if (!projectRepoMatch || !templateRepoMatch) {
      return NextResponse.json({ error: "Invalid repository URLs" }, { status: 400 })
    }

    const [, projectOwner, projectRepo] = projectRepoMatch
    const [, templateOwner, templateRepo] = templateRepoMatch
    const cleanProjectRepo = projectRepo.replace('.git', '')
    const cleanTemplateRepo = templateRepo.replace('.git', '')

    // Get template token if available
    let templateToken: string | undefined
    if (project.githubTemplate.githubToken) {
      templateToken = safeDecrypt(project.githubTemplate.githubToken) || undefined
    }

    // Create GitHubRepoCloner instance
    const repoCloner = new GitHubRepoCloner(userAccount.access_token, templateToken)

    try {
      // Use the GitHubRepoCloner to sync the repository
      const result = await repoCloner.syncWithTemplate({
        sourceOwner: templateOwner,
        sourceRepo: cleanTemplateRepo,
        targetOwner: projectOwner,
        targetRepo: cleanProjectRepo,
        createPullRequest: createPullRequest && !directToMain,
        sourceToken: templateToken,
        directToMain: directToMain
      })

      if (!result.success) {
        return NextResponse.json(
          { error: result.message || "Failed to sync with template" },
          { status: 500 }
        )
      }

      return NextResponse.json({
        message: result.message,
        syncBranch: result.syncBranch,
        updatedFiles: result.filesCount,
        pullRequestUrl: result.pullRequestUrl,
        directToMain
      })

    } catch (error: any) {
      console.error("Error syncing with template:", error)
      
      return NextResponse.json(
        { 
          error: error.message || "Failed to sync with template",
          details: error.message 
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error("Error syncing with template:", error)
    return NextResponse.json(
      { error: "Failed to sync with template" },
      { status: 500 }
    )
  }
}