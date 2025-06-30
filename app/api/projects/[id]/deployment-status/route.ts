import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Octokit } from "@octokit/rest"

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
    const match = project.githubRepo.match(/github\.com\/([^\/]+)\/([^\/\?.]+)/)
    if (!match) {
      return NextResponse.json({ error: "Invalid GitHub repository URL" }, { status: 400 })
    }

    const owner = match[1]
    const repo = match[2].replace('.git', '')

    // Initialize Octokit
    const octokit = new Octokit({
      auth: account.access_token
    })

    // Get workflow runs
    const { data: runs } = await octokit.rest.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      per_page: 10 // Get last 10 runs
    })

    // Filter deployment-related runs
    const deploymentRuns = runs.workflow_runs
      .filter(run => run.path?.includes('tfplan.yml') || run.path?.includes('tfapply.yml'))
      .map(run => ({
        id: run.id,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        html_url: run.html_url,
        created_at: run.created_at,
        updated_at: run.updated_at,
        run_number: run.run_number,
        event: run.event,
        head_branch: run.head_branch,
        head_sha: run.head_sha.substring(0, 7),
        workflow_id: run.workflow_id,
        workflow: run.path?.includes('tfplan.yml') ? 'tfplan.yml' : run.path?.includes('tfapply.yml') ? 'tfapply.yml' : run.path,
        branch: run.head_branch
      }))

    // Get the latest deployment run
    const latestDeployment = deploymentRuns[0]

    return NextResponse.json({
      latestDeployment,
      deploymentHistory: deploymentRuns.slice(0, 5),
      hasDeployments: deploymentRuns.length > 0,
      totalDeployments: deploymentRuns.length,
      hasMoreDeployments: deploymentRuns.length > 5
    })

  } catch (error: any) {
    console.error("Error fetching deployment status:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch deployment status" },
      { status: 500 }
    )
  }
}