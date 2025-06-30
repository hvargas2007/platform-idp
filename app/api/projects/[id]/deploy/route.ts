import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Octokit } from "@octokit/rest"

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
    const { workflowFile = "deploy.yml", branch = "main" } = body

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

    // Check if AWS configuration exists
    if (!project.awsRole || !project.awsRegion) {
      return NextResponse.json(
        { error: "AWS configuration is required. Please configure AWS settings first." },
        { status: 400 }
      )
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

    // Trigger the deployment workflow
    try {
      const response = await octokit.rest.actions.createWorkflowDispatch({
        owner,
        repo,
        workflow_id: workflowFile,
        ref: branch,
        inputs: {
          branch: branch
        }
      })

      // Get the latest workflow run
      const { data: runs } = await octokit.rest.actions.listWorkflowRuns({
        owner,
        repo,
        workflow_id: workflowFile,
        per_page: 1
      })

      const latestRun = runs.workflow_runs[0]

      return NextResponse.json({
        message: "Deployment triggered successfully",
        workflowRun: {
          id: latestRun?.id,
          status: latestRun?.status,
          conclusion: latestRun?.conclusion,
          html_url: latestRun?.html_url,
          created_at: latestRun?.created_at,
          workflow: workflowFile,
          branch: branch
        }
      })

    } catch (error: any) {
      console.error("Error triggering deployment:", error)
      
      if (error.status === 404) {
        return NextResponse.json(
          { 
            error: `Workflow file '${workflowFile}' not found. Make sure the workflow file exists in .github/workflows/${workflowFile}` 
          },
          { status: 404 }
        )
      } else if (error.status === 403) {
        return NextResponse.json(
          { error: "You don't have permission to trigger workflows on this repository" },
          { status: 403 }
        )
      } else if (error.status === 422 && error.message?.includes("Unexpected inputs provided")) {
        return NextResponse.json(
          { 
            error: "The workflow does not accept inputs. This has been fixed - please try again." 
          },
          { status: 422 }
        )
      }
      
      throw error
    }

  } catch (error: any) {
    console.error("Error triggering deployment:", error)
    return NextResponse.json(
      { error: error.message || "Failed to trigger deployment" },
      { status: 500 }
    )
  }
}