import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { Octokit } from "@octokit/rest"
import { z } from "zod"

// Validation schema
const validateGitHubSchema = z.object({
  githubUrl: z.string().url(),
  githubToken: z.string().optional()
})

// Extract owner and repo from GitHub URL
function parseGitHubUrl(url: string): { owner: string; repo: string; organization?: string } | null {
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/\?.]+)/,
    /github\.com:([^\/]+)\/([^\/\?.]+)/
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      const owner = match[1]
      const repo = match[2].replace('.git', '')
      
      // Check if it's an organization by looking at common patterns
      // This is a simple heuristic - in practice, you'd check via API
      const organization = owner.includes('-org') || owner.includes('-team') ? owner : undefined
      
      return { owner, repo, organization }
    }
  }
  
  return null
}

// POST /api/admin/templates/validate-github
export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin()
  if (adminCheck.error) return adminCheck.error

  try {
    const body = await request.json()
    const { githubUrl, githubToken } = validateGitHubSchema.parse(body)
    
    // Parse GitHub URL
    const parsed = parseGitHubUrl(githubUrl)
    if (!parsed) {
      return NextResponse.json(
        { 
          valid: false, 
          error: "Invalid GitHub URL format",
          details: "URL must be in format: https://github.com/owner/repo"
        },
        { status: 400 }
      )
    }
    
    const { owner, repo } = parsed
    
    // Create Octokit instance with token if provided
    const octokit = new Octokit({
      auth: githubToken || process.env.GITHUB_TOKEN
    })
    
    try {
      // Try to get repository information
      const { data: repoData } = await octokit.repos.get({
        owner,
        repo
      })
      
      // Check if it's an organization
      let organizationData = null
      let isOrganization = false
      
      try {
        const { data: ownerData } = await octokit.users.getByUsername({
          username: owner
        })
        
        isOrganization = ownerData.type === 'Organization'
        
        if (isOrganization) {
          organizationData = {
            name: ownerData.name || owner,
            login: ownerData.login,
            avatarUrl: ownerData.avatar_url
          }
        }
      } catch (error) {
        // Ignore error - owner check is optional
      }
      
      // Get default branch info
      const defaultBranch = repoData.default_branch || 'main'
      
      // Get branches list
      let branches: string[] = []
      try {
        const { data: branchesData } = await octokit.repos.listBranches({
          owner,
          repo,
          per_page: 100
        })
        branches = branchesData.map(b => b.name)
      } catch (error) {
        // If we can't list branches, just include the default
        branches = [defaultBranch]
      }
      
      // Check if we have write access (for cloning)
      let hasWriteAccess = false
      if (githubToken) {
        try {
          const { data: user } = await octokit.users.getAuthenticated()
          // Check if the authenticated user has push access
          const { data: perms } = await octokit.repos.get({
            owner,
            repo
          })
          hasWriteAccess = perms.permissions?.push || false
        } catch (error) {
          // No write access
        }
      }
      
      return NextResponse.json({
        valid: true,
        repository: {
          name: repoData.name,
          fullName: repoData.full_name,
          description: repoData.description,
          private: repoData.private,
          defaultBranch,
          branches,
          language: repoData.language,
          topics: repoData.topics || [],
          htmlUrl: repoData.html_url,
          cloneUrl: repoData.clone_url,
          sshUrl: repoData.ssh_url,
          size: repoData.size,
          stargazersCount: repoData.stargazers_count,
          forksCount: repoData.forks_count,
          hasIssues: repoData.has_issues,
          hasWiki: repoData.has_wiki,
          archived: repoData.archived,
          disabled: repoData.disabled
        },
        owner: {
          login: owner,
          type: isOrganization ? 'Organization' : 'User',
          avatarUrl: repoData.owner.avatar_url
        },
        organization: organizationData,
        access: {
          canRead: true,
          canWrite: hasWriteAccess,
          isPublic: !repoData.private,
          requiresToken: repoData.private
        },
        parsedUrl: {
          owner,
          repo,
          organization: isOrganization ? owner : undefined
        }
      })
      
    } catch (error: any) {
      // Handle specific GitHub API errors
      if (error.status === 404) {
        return NextResponse.json({
          valid: false,
          error: "Repository not found",
          details: githubToken 
            ? "The repository doesn't exist or the token doesn't have access to it"
            : "The repository doesn't exist or is private (try adding a GitHub token)"
        })
      } else if (error.status === 401) {
        return NextResponse.json({
          valid: false,
          error: "Authentication failed",
          details: "The provided GitHub token is invalid or expired"
        })
      } else if (error.status === 403) {
        return NextResponse.json({
          valid: false,
          error: "Access forbidden",
          details: "The token doesn't have permission to access this repository"
        })
      }
      
      throw error
    }
    
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          valid: false,
          error: "Invalid request data", 
          details: error.errors 
        },
        { status: 400 }
      )
    }
    
    console.error("Error validating GitHub repository:", error)
    return NextResponse.json(
      { 
        valid: false,
        error: "Failed to validate repository",
        details: error.message || "An unexpected error occurred"
      },
      { status: 500 }
    )
  }
}