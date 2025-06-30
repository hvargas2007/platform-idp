import { Octokit } from "@octokit/rest"

export function createGitHubClient(token?: string) {
  return new Octokit({
    auth: token || process.env.GITHUB_TOKEN
  })
}

export interface CreateRepoOptions {
  name: string
  description?: string
  private?: boolean
  template?: string
  autoInit?: boolean
}

export async function createRepository(options: CreateRepoOptions, userToken?: string) {
  const octokit = createGitHubClient(userToken)
  
  try {
    const { data } = await octokit.repos.createForAuthenticatedUser({
      name: options.name,
      description: options.description,
      private: options.private ?? false,
      auto_init: options.autoInit ?? true
    })
    
    return data
  } catch (error) {
    console.error("Error creating repository:", error)
    throw error
  }
}

export async function createPullRequest(
  owner: string,
  repo: string,
  title: string,
  head: string,
  base: string,
  body?: string,
  userToken?: string
) {
  const octokit = createGitHubClient(userToken)
  
  try {
    const { data } = await octokit.pulls.create({
      owner,
      repo,
      title,
      head,
      base,
      body
    })
    
    return data
  } catch (error) {
    console.error("Error creating pull request:", error)
    throw error
  }
}

export async function setupBranchProtection(
  owner: string,
  repo: string,
  branch: string = "main",
  userToken?: string
) {
  const octokit = createGitHubClient(userToken)
  
  try {
    await octokit.repos.updateBranchProtection({
      owner,
      repo,
      branch,
      required_status_checks: null, // No requerir checks por ahora
      enforce_admins: false, // No aplicar a admins
      required_pull_request_reviews: {
        required_approving_review_count: 1,
        dismiss_stale_reviews: true,
        require_code_owner_reviews: false
      },
      restrictions: null,
      allow_force_pushes: false,
      allow_deletions: false
    })
  } catch (error) {
    console.error("Error setting up branch protection:", error)
    throw error
  }
}

export async function createWorkflow(
  owner: string,
  repo: string,
  workflowPath: string,
  workflowContent: string,
  userToken?: string
) {
  const octokit = createGitHubClient(userToken)
  
  try {
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: workflowPath,
      message: "Add workflow",
      content: Buffer.from(workflowContent).toString("base64")
    })
  } catch (error) {
    console.error("Error creating workflow:", error)
    throw error
  }
}