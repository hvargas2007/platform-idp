"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, GitBranch, Folder, Zap, Shield, Github, Loader2, Eye, EyeOff } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/contexts/toast-context"

interface GitHubTemplate {
  id: string
  templateId: string
  name: string
  description: string
  category: string
  icon: string
  githubUrl: string
  branch: string
  features: string[]
  includeBranches: boolean
  isPrivate: boolean
  createdBy?: string
  isOwner?: boolean
  gitflow?: {
    defaultBranch: string
    branches: {
      develop?: boolean
      feature?: boolean
    }
  }
}

export default function NewProjectPage() {
  const router = useRouter()
  const { showError } = useToast()
  const [selectedTemplate, setSelectedTemplate] = useState<string>("")
  const [githubTemplates, setGithubTemplates] = useState<GitHubTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  
  
  const [projectName, setProjectName] = useState("")
  const [projectDescription, setProjectDescription] = useState("")
  const [isPrivate, setIsPrivate] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [showAllTemplates, setShowAllTemplates] = useState(false)
  const [useCustomCredentials, setUseCustomCredentials] = useState(false)
  const [githubUsername, setGithubUsername] = useState("")
  const [githubToken, setGithubToken] = useState("")
  const [showToken, setShowToken] = useState(false)
  
  // AWS Configuration states
  const [configureAws, setConfigureAws] = useState(false)
  const [awsRole, setAwsRole] = useState("")
  const [awsRegion, setAwsRegion] = useState("")
  const [awsBackend, setAwsBackend] = useState("")
  const [awsProjectName, setAwsProjectName] = useState("")
  const [awsAccessToken, setAwsAccessToken] = useState("")
  const [awsUsernameGithub, setAwsUsernameGithub] = useState("")
  const [showAwsToken, setShowAwsToken] = useState(false)

  // Load GitHub templates from database
  useEffect(() => {
    loadGitHubTemplates()
  }, [showAllTemplates])

  const loadGitHubTemplates = async () => {
    try {
      // By default, only show user's templates. Add includeAdmin param to show all
      const url = showAllTemplates 
        ? "/api/templates/github-list?includeAdmin=true" 
        : "/api/templates/github-list"
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        // Transform the data to match the expected format
        const transformedTemplates = data.map((t: any) => ({
          ...t,
          // Keep the actual database id, don't override with templateId
          gitflow: {
            defaultBranch: t.branch || 'main',
            branches: {
              develop: true,
              feature: true
            }
          }
        }))
        setGithubTemplates(transformedTemplates)
      }
    } catch (error) {
      console.error("Error loading GitHub templates:", error)
    } finally {
      setLoadingTemplates(false)
    }
  }

  const handleCreateProject = async () => {
    if (!selectedTemplate || !projectName) {
      showError("Please select a template and enter a project name")
      return
    }

    setIsCreating(true)

    try {
      // Verificar si es un template de GitHub
      const githubTemplate = githubTemplates.find(t => t.id === selectedTemplate)
      
      if (!githubTemplate) {
        throw new Error("Template not found")
      }
      
      // Use clone API for GitHub templates
      const response = await fetch("/api/projects/clone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceUrl: githubTemplate.githubUrl,
          name: projectName,
          description: projectDescription || githubTemplate.description,
          isPrivate,
          includeBranches: githubTemplate.includeBranches ?? true,
          githubTemplateId: githubTemplate.id, // This now sends the actual database ID
          // Include custom credentials if provided
          ...(useCustomCredentials && githubUsername && githubToken && {
            githubUsername,
            githubToken
          }),
          // Include AWS configuration if provided
          ...(configureAws && {
            awsConfig: {
              awsRole,
              awsRegion,
              awsBackend,
              projectName: awsProjectName,
              accessToken: awsAccessToken,
              usernameGithub: awsUsernameGithub
            }
          })
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Error creating project")
      }

      router.push(`/projects/${data.id}`)
    } catch (error: any) {
      console.error("Error:", error)
      showError(error.message || "Error creating project. Please try again.")
    } finally {
      setIsCreating(false)
    }
  }

  const selectedTemplateData = githubTemplates.find(t => t.id === selectedTemplate)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Create New Project</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-8">
          {/* Paso 1: Seleccionar Template */}
          <section className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">1. Select a Template</h2>
            
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <Github className="h-5 w-5" />
                  Available Templates
                </h3>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="showAllTemplates"
                    checked={showAllTemplates}
                    onChange={(e) => {
                      setShowAllTemplates(e.target.checked)
                      setLoadingTemplates(true)
                    }}
                    className="rounded"
                  />
                  <label htmlFor="showAllTemplates" className="text-sm text-gray-700">
                    Show all templates
                  </label>
                </div>
              </div>
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : githubTemplates.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {githubTemplates.map((template) => (
                    <div
                      key={template.id}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        selectedTemplate === template.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => setSelectedTemplate(template.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="text-2xl mb-2">{template.icon}</div>
                          <h3 className="font-semibold">{template.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                          <div className="mt-2 space-x-2">
                            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                              {template.category}
                            </span>
                            {template.isOwner && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                Your Template
                              </span>
                            )}
                            {template.isPrivate && (
                              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                                Private
                              </span>
                            )}
                          </div>
                        </div>
                        <Github className="h-4 w-4 text-gray-400" />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {template.githubUrl.replace('https://github.com/', '')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {showAllTemplates ? (
                    <>
                      <p>No templates available.</p>
                      <p className="text-sm mt-2">Import your own templates or contact an administrator.</p>
                    </>
                  ) : (
                    <>
                      <p>You haven't imported any templates yet.</p>
                      <p className="text-sm mt-2">
                        <Link href="/dashboard/templates/import" className="text-blue-600 hover:underline">
                          Import a template
                        </Link>
                        {" "}or enable "Show all templates" to see shared templates.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Paso 2: Configurar Proyecto */}
          <section className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">2. Configure Your Project</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="my-awesome-project"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will be the GitHub repository name
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="A brief description of your project..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPrivate"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="isPrivate" className="text-sm text-gray-700">
                  Private repository
                </label>
              </div>

              <div className="mt-6 border-t pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="useCustomCredentials"
                    checked={useCustomCredentials}
                    onChange={(e) => setUseCustomCredentials(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="useCustomCredentials" className="text-sm font-medium text-gray-700">
                    Use custom GitHub credentials
                  </label>
                </div>
                
                {useCustomCredentials && (
                  <div className="space-y-4 bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-600">
                      Provide your GitHub credentials to access private repositories or use your own account for cloning.
                    </p>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        GitHub Username
                      </label>
                      <input
                        type="text"
                        value={githubUsername}
                        onChange={(e) => setGithubUsername(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="your-github-username"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        GitHub Personal Access Token
                      </label>
                      <div className="relative">
                        <input
                          type={showToken ? "text" : "password"}
                          value={githubToken}
                          onChange={(e) => setGithubToken(e.target.value)}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="ghp_..."
                        />
                        <button
                          type="button"
                          onClick={() => setShowToken(!showToken)}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Your token needs repo scope for private repositories.
                        <a 
                          href="https://github.com/settings/tokens/new" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="ml-1 text-blue-600 hover:underline"
                        >
                          Create token
                        </a>
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 border-t pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="configureAws"
                    checked={configureAws}
                    onChange={(e) => setConfigureAws(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="configureAws" className="text-sm font-medium text-gray-700">
                    Configure GitHub Secrets and Variables
                  </label>
                </div>
                
                {configureAws && (
                  <div className="space-y-4 bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-600">
                      Configure GitHub secrets and variables for your project. These will be used by GitHub Actions workflows.
                    </p>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          AWS Role ARN <span className="text-xs text-gray-500">(Variable)</span>
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
                          AWS Region <span className="text-xs text-gray-500">(Variable)</span>
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
                          AWS Backend (S3 Bucket) <span className="text-xs text-gray-500">(Variable)</span>
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
                          Project Name <span className="text-xs text-gray-500">(Variable)</span>
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
                          GitHub Username <span className="text-xs text-gray-500">(Secret)</span>
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
                          Access Token <span className="text-xs text-gray-500">(Secret)</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showAwsToken ? "text" : "password"}
                            value={awsAccessToken}
                            onChange={(e) => setAwsAccessToken(e.target.value)}
                            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="your-access-token"
                          />
                          <button
                            type="button"
                            onClick={() => setShowAwsToken(!showAwsToken)}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          >
                            {showAwsToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-500 mt-2">
                      These settings will be configured as GitHub repository secrets and variables for deployment.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Características del Template */}
          {selectedTemplateData && (
            <section className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">Template Features</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    Includes
                  </h3>
                  <ul className="space-y-1">
                    {selectedTemplateData.features.map((feature, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-blue-500" />
                    Git Configuration
                  </h3>
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li>• Main branch: {selectedTemplateData.gitflow?.defaultBranch || 'main'}</li>
                    {selectedTemplateData.gitflow?.branches?.develop && <li>• Branch develop</li>}
                    {selectedTemplateData.gitflow?.branches?.feature && <li>• Feature branches</li>}
                    <li>• Branch protection enabled</li>
                    <li>• GitHub Actions configured</li>
                  </ul>
                </div>
              </div>
            </section>
          )}

          {/* Botón de Crear */}
          <div className="flex justify-end gap-4">
            <Link href="/dashboard">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button
              onClick={handleCreateProject}
              disabled={!selectedTemplate || !projectName || isCreating}
            >
              {isCreating ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}