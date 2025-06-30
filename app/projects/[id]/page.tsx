"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ExternalLink, GitBranch, CheckCircle, Cloud, Settings, Loader2, Eye, EyeOff, RefreshCw, PlayCircle, Rocket, GitMerge, FileText } from "lucide-react"
import Link from "next/link"
import { TerraformPlanModal } from "@/components/terraform-plan-modal"
import { useToast } from "@/contexts/toast-context"

interface Project {
  id: string
  name: string
  description: string | null
  githubRepo: string | null
  status: string
  createdAt: string
  updatedAt: string
  awsRole: string | null
  awsRegion: string | null
  awsBackend: string | null
  projectName: string | null
  usernameGithub: string | null
  githubTemplate: {
    name: string
    description: string
    category: string
  } | null
}

interface DeploymentStatus {
  latestDeployment?: {
    id: number
    name: string
    status: string
    conclusion: string | null
    html_url: string
    created_at: string
    updated_at: string
    workflow?: string
    branch?: string
  }
  deploymentHistory?: Array<{
    id: number
    name: string
    status: string
    conclusion: string | null
    html_url: string
    created_at: string
    updated_at: string
    workflow?: string
    branch?: string
  }>
  hasDeployments: boolean
  totalDeployments?: number
  hasMoreDeployments?: boolean
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { showSuccess, showError, showInfo } = useToast()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [deploying, setDeploying] = useState(false)
  const [showAwsConfig, setShowAwsConfig] = useState(false)
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState("main")
  const [showApplyConfirm, setShowApplyConfirm] = useState(false)
  const [deployingWorkflow, setDeployingWorkflow] = useState<string | null>(null)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [selectedPlanRun, setSelectedPlanRun] = useState<{ id: number, name?: string } | null>(null)
  
  // AWS Config form states
  const [awsRole, setAwsRole] = useState("")
  const [awsRegion, setAwsRegion] = useState("")
  const [awsBackend, setAwsBackend] = useState("")
  const [awsProjectName, setAwsProjectName] = useState("")
  const [awsAccessToken, setAwsAccessToken] = useState("")
  const [awsUsernameGithub, setAwsUsernameGithub] = useState("")
  const [showToken, setShowToken] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  
  // Template sync states
  const [checkingUpdates, setCheckingUpdates] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [templateUpdates, setTemplateUpdates] = useState<{
    hasUpdates: boolean
    latestCommit?: {
      sha: string
      message: string
      date: string
      author: string
    }
    changedFiles?: string[]
  } | null>(null)
  const [showSyncConfirm, setShowSyncConfirm] = useState(false)
  const [syncMethod, setSyncMethod] = useState<"pr" | "direct">("pr")

  useEffect(() => {
    loadProject()
  }, [])

  useEffect(() => {
    if (project?.awsRole) {
      loadDeploymentStatus()
    }
    if (project?.githubTemplate) {
      checkTemplateUpdates()
    }
  }, [project])

  const loadProject = async () => {
    try {
      const { id } = await params
      const response = await fetch(`/api/projects/${id}`)
      
      if (!response.ok) {
        router.push("/dashboard")
        return
      }
      
      const data = await response.json()
      setProject(data)
      
      // Set GitHub config form values
      setAwsRole(data.awsRole || "")
      setAwsRegion(data.awsRegion || "")
      setAwsBackend(data.awsBackend || "")
      setAwsProjectName(data.projectName || "")
      setAwsUsernameGithub(data.usernameGithub || "")
    } catch (error) {
      console.error("Error loading project:", error)
      router.push("/dashboard")
    } finally {
      setLoading(false)
    }
  }

  const loadDeploymentStatus = async () => {
    if (!project) return
    
    setLoadingStatus(true)
    try {
      const response = await fetch(`/api/projects/${project.id}/deployment-status`)
      if (response.ok) {
        const data = await response.json()
        setDeploymentStatus(data)
      }
    } catch (error) {
      console.error("Error loading deployment status:", error)
    } finally {
      setLoadingStatus(false)
    }
  }

  const handleRunWorkflow = async (workflowFile: string) => {
    if (!project) return
    
    setDeployingWorkflow(workflowFile)
    try {
      const response = await fetch(`/api/projects/${project.id}/deploy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          workflowFile,
          branch: selectedBranch
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        showError(data.error || `Failed to trigger ${workflowFile}`)
        return
      }
      
      const workflowName = workflowFile === "tfplan.yml" ? "Plan" : "Apply"
      showSuccess(`${workflowName} workflow triggered successfully on ${selectedBranch} branch!`)
      
      // Reload deployment status
      setTimeout(() => {
        loadDeploymentStatus()
      }, 2000)
    } catch (error) {
      console.error("Error triggering workflow:", error)
      showError("Failed to trigger workflow")
    } finally {
      setDeployingWorkflow(null)
    }
  }

  const handlePlan = () => {
    handleRunWorkflow("tfplan.yml")
  }

  const handleApply = () => {
    setShowApplyConfirm(true)
  }

  const confirmApply = () => {
    setShowApplyConfirm(false)
    handleRunWorkflow("tfapply.yml")
  }

  const checkTemplateUpdates = async () => {
    if (!project) return
    
    setCheckingUpdates(true)
    try {
      const response = await fetch(`/api/projects/${project.id}/sync-template`)
      if (response.ok) {
        const data = await response.json()
        setTemplateUpdates(data)
      }
    } catch (error) {
      console.error("Error checking template updates:", error)
    } finally {
      setCheckingUpdates(false)
    }
  }

  const handleSyncTemplate = async () => {
    if (!project) return
    
    setSyncing(true)
    setShowSyncConfirm(false)
    
    try {
      const response = await fetch(`/api/projects/${project.id}/sync-template`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          createPullRequest: syncMethod === "pr",
          directToMain: syncMethod === "direct"
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        showError(data.error || "Failed to sync with template")
        return
      }
      
      if (data.pullRequestUrl) {
        // Open the pull request in a new tab
        window.open(data.pullRequestUrl, '_blank')
        showSuccess(`Template sync completed! ${data.updatedFiles} files were updated. A pull request has been created for your review.`)
      } else {
        showSuccess(`Template sync completed! ${data.updatedFiles} files were updated${syncMethod === "direct" ? " directly to the main branch" : ""}.`)
      }
      
      // Refresh template updates status
      await checkTemplateUpdates()
    } catch (error) {
      console.error("Error syncing with template:", error)
      showError("Failed to sync with template")
    } finally {
      setSyncing(false)
    }
  }

  const handleSaveAwsConfig = async () => {
    if (!project) return
    
    setSavingConfig(true)
    try {
      const response = await fetch(`/api/projects/${project.id}/github-config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          awsConfig: {
            awsRole,
            awsRegion,
            awsBackend,
            projectName: awsProjectName,
            accessToken: awsAccessToken,
            usernameGithub: awsUsernameGithub
          }
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        showError(data.error || "Failed to save GitHub configuration")
        return
      }
      
      showSuccess("GitHub secrets and variables saved successfully!")
      setShowAwsConfig(false)
      
      // Reload project to get updated data
      await loadProject()
    } catch (error) {
      console.error("Error saving GitHub config:", error)
      showError("Failed to save GitHub configuration")
    } finally {
      setSavingConfig(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!project) {
    return null
  }

  const hasAwsConfig = !!(project.awsRole && project.awsRegion)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">{project.name}</h1>
              <p className="text-sm text-gray-600">{project.description}</p>
            </div>
          </div>
          {project.githubRepo && (
            <a
              href={project.githubRepo}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
            >
              <GitBranch className="h-4 w-4" />
              View on GitHub
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Información Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Project Status */}
            <section className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Project Status</h2>
              <div className="space-y-3">
                <StatusItem
                  icon={<CheckCircle className="h-5 w-5 text-green-500" />}
                  label="Repository"
                  value="Created"
                />
                <StatusItem
                  icon={<GitBranch className="h-5 w-5 text-blue-500" />}
                  label="Status"
                  value={project.status}
                />
                {hasAwsConfig && (
                  <StatusItem
                    icon={<Cloud className="h-5 w-5 text-blue-500" />}
                    label="GitHub Secrets & Variables"
                    value="Configured"
                  />
                )}
              </div>
            </section>

            {/* AWS Deployment Status */}
            {hasAwsConfig && (
              <section className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Deployment Status</h2>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={loadDeploymentStatus}
                    disabled={loadingStatus}
                  >
                    {loadingStatus ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                
                {loadingStatus ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : deploymentStatus?.latestDeployment ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Latest Deployment</span>
                        <span className={`text-sm px-2 py-1 rounded ${
                          deploymentStatus.latestDeployment.status === 'completed' 
                            ? deploymentStatus.latestDeployment.conclusion === 'success' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {deploymentStatus.latestDeployment.status === 'completed' 
                            ? deploymentStatus.latestDeployment.conclusion 
                            : deploymentStatus.latestDeployment.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {deploymentStatus.latestDeployment.name}
                      </p>
                      {deploymentStatus.latestDeployment.workflow && (
                        <p className="text-xs text-gray-600 mb-1">
                          Workflow: {deploymentStatus.latestDeployment.workflow}
                        </p>
                      )}
                      {deploymentStatus.latestDeployment.branch && (
                        <p className="text-xs text-gray-600 mb-1">
                          Branch: {deploymentStatus.latestDeployment.branch}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        {new Date(deploymentStatus.latestDeployment.created_at).toLocaleString()}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <a
                          href={deploymentStatus.latestDeployment.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                        >
                          View logs
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        
                        {/* Show View Plan link for completed plan workflows */}
                        {deploymentStatus.latestDeployment.workflow === 'tfplan.yml' && 
                         deploymentStatus.latestDeployment.status === 'completed' &&
                         deploymentStatus.latestDeployment.conclusion === 'success' && (
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault()
                              setSelectedPlanRun({ 
                                id: deploymentStatus.latestDeployment.id, 
                                name: deploymentStatus.latestDeployment.name 
                              })
                              setShowPlanModal(true)
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                          >
                            View Plan
                            <FileText className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No deployments yet. Run a Plan or Apply workflow to start.
                  </p>
                )}
                
                {/* Deployment History */}
                {deploymentStatus?.deploymentHistory && deploymentStatus.deploymentHistory.length > 1 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                      Recent Deployments
                      {deploymentStatus.hasMoreDeployments && (
                        <span className="text-xs text-gray-500 font-normal ml-2">
                          (Showing last 5 of {deploymentStatus.totalDeployments} deployments)
                        </span>
                      )}
                    </h4>
                    <div className="space-y-2">
                      {deploymentStatus.deploymentHistory.slice(1).map((deployment) => (
                        <div key={deployment.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-gray-900">
                              {deployment.workflow === 'tfplan.yml' ? 'Plan' : 'Apply'}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded ${
                              deployment.status === 'completed' 
                                ? deployment.conclusion === 'success' 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {deployment.status === 'completed' 
                                ? deployment.conclusion 
                                : deployment.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">
                            Branch: {deployment.branch} • {new Date(deployment.created_at).toLocaleString()}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <a
                              href={deployment.html_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                            >
                              View logs
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            
                            {/* Show View Plan link for completed plan workflows in history */}
                            {deployment.workflow === 'tfplan.yml' && 
                             deployment.status === 'completed' &&
                             deployment.conclusion === 'success' && (
                              <a
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault()
                                  setSelectedPlanRun({ 
                                    id: deployment.id, 
                                    name: deployment.name 
                                  })
                                  setShowPlanModal(true)
                                }}
                                className="text-xs text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                              >
                                View Plan
                                <FileText className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* GitHub Secrets & Variables Configuration */}
            {showAwsConfig && (
              <section className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-4">GitHub Secrets & Variables Configuration</h2>
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        AWS Role ARN
                      </label>
                      <input
                        type="text"
                        value={awsRole}
                        onChange={(e) => setAwsRole(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="arn:aws:iam::123456789012:role/MyRole"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        AWS Region
                      </label>
                      <input
                        type="text"
                        value={awsRegion}
                        onChange={(e) => setAwsRegion(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="us-east-1"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        AWS Backend (S3 Bucket)
                      </label>
                      <input
                        type="text"
                        value={awsBackend}
                        onChange={(e) => setAwsBackend(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="my-terraform-state-bucket"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Project Name
                      </label>
                      <input
                        type="text"
                        value={awsProjectName}
                        onChange={(e) => setAwsProjectName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="my-aws-project"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        GitHub Username
                      </label>
                      <input
                        type="text"
                        value={awsUsernameGithub}
                        onChange={(e) => setAwsUsernameGithub(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="github-username"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Access Token
                      </label>
                      <div className="relative">
                        <input
                          type={showToken ? "text" : "password"}
                          value={awsAccessToken}
                          onChange={(e) => setAwsAccessToken(e.target.value)}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="your-access-token"
                        />
                        <button
                          type="button"
                          onClick={() => setShowToken(!showToken)}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-3 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setShowAwsConfig(false)}
                      disabled={savingConfig}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveAwsConfig}
                      disabled={savingConfig}
                    >
                      {savingConfig ? "Saving..." : "Save Configuration"}
                    </Button>
                  </div>
                </div>
              </section>
            )}

            {/* Project Details */}
            <section className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Project Details</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Description</h3>
                  <p className="text-gray-600">{project.description || "No description provided"}</p>
                </div>
                {project.githubRepo && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-1">Repository URL</h3>
                    <a 
                      href={project.githubRepo} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 text-sm break-all"
                    >
                      {project.githubRepo}
                    </a>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions */}
            <section className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
              <div className="space-y-3">
                {project.githubRepo && (
                  <a
                    href={project.githubRepo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <Button className="w-full" variant="outline">
                      <GitBranch className="h-4 w-4 mr-2" />
                      Open in GitHub
                    </Button>
                  </a>
                )}
                
                {hasAwsConfig ? (
                  <>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Select Branch
                        </label>
                        <select
                          value={selectedBranch}
                          onChange={(e) => setSelectedBranch(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="dev">dev</option>
                          <option value="qa">qa</option>
                          <option value="main">main</option>
                        </select>
                      </div>
                      
                      <Button
                        className="w-full"
                        onClick={handlePlan}
                        disabled={deployingWorkflow === "tfplan.yml"}
                        variant="outline"
                      >
                        {deployingWorkflow === "tfplan.yml" ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Running Plan...
                          </>
                        ) : (
                          <>
                            <PlayCircle className="h-4 w-4 mr-2" />
                            Run Plan
                          </>
                        )}
                      </Button>
                      
                      <Button
                        className="w-full"
                        onClick={handleApply}
                        disabled={deployingWorkflow === "tfapply.yml"}
                      >
                        {deployingWorkflow === "tfapply.yml" ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Running Apply...
                          </>
                        ) : (
                          <>
                            <Rocket className="h-4 w-4 mr-2" />
                            Run Apply
                          </>
                        )}
                      </Button>
                    </div>
                    
                    <Button
                      className="w-full mt-3"
                      variant="outline"
                      onClick={() => setShowAwsConfig(true)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Update GitHub Config
                    </Button>
                  </>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => setShowAwsConfig(true)}
                  >
                    <Cloud className="h-4 w-4 mr-2" />
                    Configure AWS
                  </Button>
                )}
              </div>
            </section>

            {/* GitHub Secrets & Variables Summary */}
            {hasAwsConfig && (
              <section className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-4">GitHub Secrets & Variables</h2>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Role:</span>
                    <p className="text-xs text-gray-800 break-all">{project.awsRole}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Region:</span>
                    <p className="text-gray-800">{project.awsRegion}</p>
                  </div>
                  {project.awsBackend && (
                    <div>
                      <span className="text-gray-600">Backend:</span>
                      <p className="text-gray-800">{project.awsBackend}</p>
                    </div>
                  )}
                  {project.projectName && (
                    <div>
                      <span className="text-gray-600">Project:</span>
                      <p className="text-gray-800">{project.projectName}</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Template Information */}
            {project.githubTemplate && (
              <section className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Template</h2>
                  {templateUpdates?.hasUpdates && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      Updates available
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="font-medium">{project.githubTemplate.name}</p>
                  <p className="text-sm text-gray-600">{project.githubTemplate.description}</p>
                  <div className="mt-3 mb-4">
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                      {project.githubTemplate.category}
                    </span>
                  </div>
                  
                  {/* Template sync button */}
                  <Button
                    className="w-full"
                    variant={templateUpdates?.hasUpdates ? "default" : "outline"}
                    onClick={() => templateUpdates?.hasUpdates ? setShowSyncConfirm(true) : checkTemplateUpdates()}
                    disabled={checkingUpdates || syncing}
                  >
                    {checkingUpdates ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Checking for updates...
                      </>
                    ) : syncing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : templateUpdates?.hasUpdates ? (
                      <>
                        <GitMerge className="h-4 w-4 mr-2" />
                        Sync with Template
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Check for Updates
                      </>
                    )}
                  </Button>
                  
                  {/* Show latest template commit info if updates available */}
                  {templateUpdates?.hasUpdates && templateUpdates.latestCommit && (
                    <div className="mt-3 p-3 bg-gray-50 rounded text-xs space-y-1">
                      <p className="font-medium text-gray-700">Latest template update:</p>
                      <p className="text-gray-600">{templateUpdates.latestCommit.message}</p>
                      <p className="text-gray-500">
                        by {templateUpdates.latestCommit.author} on {new Date(templateUpdates.latestCommit.date).toLocaleDateString()}
                      </p>
                      {templateUpdates.changedFiles && templateUpdates.changedFiles.length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-blue-600 hover:text-blue-700">
                            {templateUpdates.changedFiles.length} files changed
                          </summary>
                          <ul className="mt-1 ml-4 text-gray-600">
                            {templateUpdates.changedFiles.slice(0, 10).map((file, index) => (
                              <li key={index}>• {file}</li>
                            ))}
                            {templateUpdates.changedFiles.length > 10 && (
                              <li>• ... and {templateUpdates.changedFiles.length - 10} more</li>
                            )}
                          </ul>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Information */}
            <section className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Information</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Created</span>
                  <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Updated</span>
                  <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Apply Confirmation Dialog */}
      {showApplyConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Confirm Apply</h3>
            <p className="text-gray-600 mb-4">
              You are about to run the Apply workflow on the <strong>{selectedBranch}</strong> branch. 
              This will make actual changes to your AWS infrastructure.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Make sure you have reviewed the Plan output before proceeding.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowApplyConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmApply}
                className="bg-red-600 hover:bg-red-700"
              >
                Yes, Apply Changes
              </Button>
            </div>
          </div>
        </div>
      )}


      {/* Sync Template Confirmation Dialog */}
      {showSyncConfirm && templateUpdates?.hasUpdates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Sync with Template</h3>
            <p className="text-gray-600 mb-4">
              You are about to sync your project with the latest template changes.
            </p>
            
            {/* Sync method selection */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Choose sync method:
              </label>
              <div className="space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="syncMethod"
                    value="pr"
                    checked={syncMethod === "pr"}
                    onChange={(e) => setSyncMethod(e.target.value as "pr" | "direct")}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Create Pull Request</div>
                    <div className="text-sm text-gray-600">
                      Create a new branch and pull request for review (recommended)
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="syncMethod"
                    value="direct"
                    checked={syncMethod === "direct"}
                    onChange={(e) => setSyncMethod(e.target.value as "pr" | "direct")}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Sync directly to main</div>
                    <div className="text-sm text-gray-600">
                      Update files directly in the main branch (use with caution)
                    </div>
                  </div>
                </label>
              </div>
            </div>
            
            {syncMethod === "direct" && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 font-medium">⚠️ Warning:</p>
                <p className="text-sm text-yellow-700">
                  Syncing directly to main will immediately update your main branch without review. 
                  Make sure you have a backup or are comfortable with the changes.
                </p>
              </div>
            )}
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 font-medium mb-2">This will:</p>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                {syncMethod === "pr" ? (
                  <>
                    <li>Create a new branch with the template updates</li>
                    <li>Update files that have changed in the template</li>
                    <li>Create a pull request for you to review</li>
                    <li>Preserve your local modifications where possible</li>
                  </>
                ) : (
                  <>
                    <li>Update files directly in your main branch</li>
                    <li>Apply template changes immediately</li>
                    <li>Preserve your local modifications where possible</li>
                    <li>Create commits in your main branch history</li>
                  </>
                )}
              </ul>
            </div>
            
            {templateUpdates.latestCommit && (
              <div className="bg-gray-50 p-3 rounded mb-4 text-sm">
                <p className="font-medium text-gray-700">Latest template update:</p>
                <p className="text-gray-600 mt-1">{templateUpdates.latestCommit.message}</p>
                <p className="text-gray-500 text-xs mt-1">
                  by {templateUpdates.latestCommit.author} on {new Date(templateUpdates.latestCommit.date).toLocaleDateString()}
                </p>
              </div>
            )}
            
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowSyncConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSyncTemplate}
                disabled={syncing}
                className={syncMethod === "direct" ? "bg-yellow-600 hover:bg-yellow-700" : ""}
              >
                {syncing ? "Syncing..." : syncMethod === "pr" ? "Create Pull Request" : "Sync to Main"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Terraform Plan Modal */}
      {selectedPlanRun && (
        <TerraformPlanModal
          isOpen={showPlanModal}
          onClose={() => {
            setShowPlanModal(false)
            setSelectedPlanRun(null)
          }}
          projectId={project.id}
          runId={selectedPlanRun.id}
          runName={selectedPlanRun.name}
        />
      )}
    </div>
  )
}

function StatusItem({ icon, label, value }: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div className="flex-1 flex justify-between items-center">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
    </div>
  )
}