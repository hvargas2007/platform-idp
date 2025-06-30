import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Octokit } from "@octokit/rest"

interface TerraformPlanOutput {
  planText: string
  summary: {
    toAdd: number
    toChange: number
    toDestroy: number
  }
}

function extractTerraformPlan(logs: string): TerraformPlanOutput | null {
  try {
    // Look for the terraform plan section
    // The plan output typically appears after "Terraform Plan" and before the next step
    const planStartMarkers = [
      "Terraform Plan",
      "terraform plan",
      "Running terraform plan",
      "##[group]Run terraform plan",
      "Run terraform plan",
      "Terraform will perform the following actions:",
      "Terraform used the selected providers"
    ]
    
    const planEndMarkers = [
      "##[endgroup]",
      "Post Run actions",
      "Cleaning up orphan processes",
      "##[group]",
      "::endgroup::"
    ]
    
    let planStartIndex = -1
    let startMarker = ""
    
    // Find the start of the terraform plan output
    for (const marker of planStartMarkers) {
      const index = logs.indexOf(marker)
      if (index !== -1 && (planStartIndex === -1 || index < planStartIndex)) {
        planStartIndex = index
        startMarker = marker
      }
    }
    
    if (planStartIndex === -1) {
      return null
    }
    
    // Move past the marker to the actual plan output
    let planStart = logs.indexOf("\n", planStartIndex) + 1
    
    // Find the end of the terraform plan output
    let planEndIndex = logs.length
    for (const marker of planEndMarkers) {
      const index = logs.indexOf(marker, planStart)
      if (index !== -1 && index < planEndIndex) {
        planEndIndex = index
      }
    }
    
    // Extract the plan text
    let planText = logs.substring(planStart, planEndIndex).trim()
    
    // Look for the Plan summary line after the plan text if not included
    const planSummaryPattern = /Plan:\s*\d+\s*to add,\s*\d+\s*to change,\s*\d+\s*to destroy/
    const remainingLogs = logs.substring(planEndIndex)
    const summaryMatch = remainingLogs.match(planSummaryPattern)
    if (summaryMatch && remainingLogs.indexOf(summaryMatch[0]) < 200) {
      // If the summary is found within 200 characters after the plan, include it
      planText += "\n\n" + summaryMatch[0]
    }
    
    // Clean up ANSI escape codes and GitHub Actions formatting
    planText = planText
      .replace(/\x1b\[[0-9;]*m/g, '') // Remove ANSI color codes
      .replace(/##\[.*?\]/g, '') // Remove GitHub Actions markers
      .replace(/\[command\]/g, '') // Remove command markers
      .replace(/::group::/g, '') // Remove group markers
      .replace(/::endgroup::/g, '') // Remove endgroup markers
      .replace(/\u001b\[[0-9;]*m/g, '') // Remove more ANSI codes
      .replace(/^.*terraform plan.*$/m, '') // Remove the terraform plan command line itself
      .trim()
    
    // If the plan is too short, it might not be the actual plan
    if (planText.length < 100) {
      // Try to find the plan in a different way - look for common terraform plan patterns
      const tfPlanPattern = /(?:Terraform will perform the following actions:|No changes\. Infrastructure is up-to-date\.|Plan:)[\s\S]*?(?:Plan:|─+|$)/
      const match = logs.match(tfPlanPattern)
      if (match) {
        planText = match[0].trim()
      }
    }
    
    // Additional cleanup for common terraform plan output
    if (planText.includes('Terraform will perform the following actions:') || 
        planText.includes('No changes. Infrastructure is up-to-date.')) {
      // Find the actual plan content
      const planStartIdx = planText.search(/(?:Terraform will perform the following actions:|No changes\. Infrastructure is up-to-date\.|Refreshing state\.\.\.)/);
      if (planStartIdx !== -1) {
        planText = planText.substring(planStartIdx);
      }
    }
    
    // Extract summary information
    // First check if the plan summary is in the full logs (not just in planText)
    const fullSummaryMatch = logs.match(/Plan:\s*(\d+)\s*to add,\s*(\d+)\s*to change,\s*(\d+)\s*to destroy/)
    const planSummaryMatch = planText.match(/Plan:\s*(\d+)\s*to add,\s*(\d+)\s*to change,\s*(\d+)\s*to destroy/)
    
    let summary = {
      toAdd: 0,
      toChange: 0,
      toDestroy: 0
    }
    
    if (fullSummaryMatch || planSummaryMatch) {
      const match = fullSummaryMatch || planSummaryMatch
      summary = {
        toAdd: parseInt(match[1]) || 0,
        toChange: parseInt(match[2]) || 0,
        toDestroy: parseInt(match[3]) || 0
      }
    } else {
      // Try alternative formats
      const addMatch = planText.match(/(\d+)\s*(?:resource\(s\)?|resources?)\s*to add/i)
      const changeMatch = planText.match(/(\d+)\s*(?:resource\(s\)?|resources?)\s*to change/i)
      const destroyMatch = planText.match(/(\d+)\s*(?:resource\(s\)?|resources?)\s*to destroy/i)
      
      if (addMatch) summary.toAdd = parseInt(addMatch[1]) || 0
      if (changeMatch) summary.toChange = parseInt(changeMatch[1]) || 0
      if (destroyMatch) summary.toDestroy = parseInt(destroyMatch[1]) || 0
      
      // Also check for the "No changes" case
      if (planText.includes("No changes") || planText.includes("Infrastructure is up-to-date")) {
        summary = { toAdd: 0, toChange: 0, toDestroy: 0 }
      }
    }
    
    return {
      planText,
      summary
    }
  } catch (error) {
    console.error("Error extracting terraform plan:", error)
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id, runId } = await params

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

    // Get workflow run details
    const { data: run } = await octokit.rest.actions.getWorkflowRun({
      owner,
      repo,
      run_id: parseInt(runId)
    })

    // Check if this is a plan workflow
    const isPlanWorkflow = run.path?.includes('tfplan.yml') || run.name?.toLowerCase().includes('plan')
    
    if (!isPlanWorkflow) {
      return NextResponse.json({ 
        error: "This endpoint only works for Terraform plan workflows" 
      }, { status: 400 })
    }

    // Get jobs for this workflow run
    const { data: jobs } = await octokit.rest.actions.listJobsForWorkflowRun({
      owner,
      repo,
      run_id: parseInt(runId)
    })

    // Find the job that contains the terraform plan
    let planOutput: TerraformPlanOutput | null = null
    
    for (const job of jobs.jobs) {
      // Get logs for this job
      try {
        const { data: logsData } = await octokit.rest.actions.downloadJobLogsForWorkflowRun({
          owner,
          repo,
          job_id: job.id
        })
        
        // The logs are returned as a string
        const logs = logsData.toString()
        
        // Extract terraform plan from logs
        const extractedPlan = extractTerraformPlan(logs)
        
        if (extractedPlan) {
          planOutput = extractedPlan
          break
        }
      } catch (error) {
        console.error(`Error fetching logs for job ${job.id}:`, error)
      }
    }

    if (!planOutput) {
      return NextResponse.json({ 
        error: "Could not find Terraform plan output in workflow logs" 
      }, { status: 404 })
    }

    return NextResponse.json({
      workflowRun: {
        id: run.id,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        html_url: run.html_url,
        created_at: run.created_at,
        updated_at: run.updated_at
      },
      plan: planOutput
    })

  } catch (error: any) {
    console.error("Error fetching deployment logs:", error)
    
    if (error.status === 404) {
      return NextResponse.json(
        { error: "Workflow run not found" },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to fetch deployment logs" },
      { status: 500 }
    )
  }
}