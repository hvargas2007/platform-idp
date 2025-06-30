"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Github, Lock, CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react"
import Link from "next/link"

export default function ImportTemplatePage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    githubUrl: "",
    githubUsername: "",
    githubToken: "",
    templateId: "",
    name: "",
    description: "",
    category: "backend",
    icon: "📦",
    branch: "main",
    features: [""],
    includeBranches: true,
    isPrivate: false
  })

  const [validationState, setValidationState] = useState<{
    loading: boolean
    valid: boolean | null
    error: string | null
    details: any | null
  }>({
    loading: false,
    valid: null,
    error: null,
    details: null
  })

  const validateGitHubRepo = async () => {
    if (!formData.githubUrl) {
      setValidationState({
        loading: false,
        valid: false,
        error: "Please enter a GitHub URL",
        details: null
      })
      return
    }

    // Basic URL validation
    const githubUrlPattern = /^https:\/\/github\.com\/[\w-]+\/[\w.-]+$/
    if (!githubUrlPattern.test(formData.githubUrl)) {
      setValidationState({
        loading: false,
        valid: false,
        error: "Invalid GitHub URL format. Expected: https://github.com/owner/repo",
        details: null
      })
      return
    }

    try {
      setValidationState({ loading: true, valid: null, error: null, details: null })
      
      const response = await fetch("/api/templates/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubUrl: formData.githubUrl,
          githubToken: formData.githubToken
        })
      })
      
      const data = await response.json()
      
      if (response.ok && data.valid) {
        setValidationState({
          loading: false,
          valid: true,
          error: null,
          details: data
        })
        
        // Auto-fill some fields if they're empty
        if (!formData.templateId) {
          setFormData(prev => ({
            ...prev,
            templateId: data.parsedUrl.repo,
            name: prev.name || data.repository.name,
            description: prev.description || data.repository.description || "",
            isPrivate: data.repository.private
          }))
        }
      } else {
        setValidationState({
          loading: false,
          valid: false,
          error: data.error || "Invalid repository",
          details: data.details
        })
      }
    } catch (error: any) {
      setValidationState({
        loading: false,
        valid: false,
        error: "Failed to validate repository",
        details: error.message
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate required fields
    if (!formData.githubUrl || !formData.templateId || !formData.name) {
      setError("Please fill in all required fields")
      return
    }

    // Validate repository first if not already validated
    if (validationState.valid !== true) {
      await validateGitHubRepo()
      if (validationState.valid !== true) {
        setError("Please validate the GitHub repository first")
        return
      }
    }

    try {
      setSaving(true)
      setError(null)

      const templateData = {
        ...formData,
        features: formData.features.filter(f => f.trim() !== "")
      }

      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templateData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to import template")
      }

      router.push("/dashboard/templates")
    } catch (error: any) {
      setError(error.message)
    } finally {
      setSaving(false)
    }
  }

  const addFeature = () => {
    setFormData({
      ...formData,
      features: [...formData.features, ""]
    })
  }

  const updateFeature = (index: number, value: string) => {
    const features = [...formData.features]
    features[index] = value
    setFormData({ ...formData, features })
  }

  const removeFeature = (index: number) => {
    const features = formData.features.filter((_, i) => i !== index)
    setFormData({ ...formData, features })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/dashboard/templates">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Import Template from GitHub</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              {error}
            </div>
          )}

          {/* GitHub Repository Section */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Github className="h-5 w-5" />
              GitHub Repository
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Repository URL *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.githubUrl}
                    onChange={(e) => {
                      setFormData({ ...formData, githubUrl: e.target.value })
                      setValidationState({ loading: false, valid: null, error: null, details: null })
                    }}
                    placeholder="https://github.com/owner/repository"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={validateGitHubRepo}
                    disabled={validationState.loading || !formData.githubUrl}
                  >
                    {validationState.loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : validationState.valid === true ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : validationState.valid === false ? (
                      <XCircle className="h-4 w-4 text-red-600" />
                    ) : (
                      "Validate"
                    )}
                  </Button>
                </div>
                {validationState.error && (
                  <p className="mt-1 text-sm text-red-600">{validationState.error}</p>
                )}
                {validationState.valid === true && validationState.details && (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded text-sm">
                    <p className="font-medium text-green-800">
                      {validationState.details.repository.fullName}
                    </p>
                    {validationState.details.repository.description && (
                      <p className="text-green-700 mt-1">
                        {validationState.details.repository.description}
                      </p>
                    )}
                    <div className="flex gap-4 mt-2 text-xs text-green-600">
                      <span>{validationState.details.repository.private ? "Private" : "Public"} repository</span>
                      <span>Default branch: {validationState.details.repository.defaultBranch}</span>
                      <span>{validationState.details.owner.type === "Organization" ? "Organization" : "User"} owned</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  GitHub Username (optional)
                </label>
                <input
                  type="text"
                  value={formData.githubUsername}
                  onChange={(e) => setFormData({ ...formData, githubUsername: e.target.value })}
                  placeholder="your-github-username"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Your GitHub username for attribution
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  GitHub Token (for private repos)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={formData.githubToken}
                    onChange={(e) => {
                      setFormData({ ...formData, githubToken: e.target.value })
                      setValidationState({ loading: false, valid: null, error: null, details: null })
                    }}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Lock className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Required for private repositories. Create a token with 'repo' scope at{" "}
                  <a 
                    href="https://github.com/settings/tokens/new" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    GitHub Settings
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Template Details Section */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Template Details</h2>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template ID *
                </label>
                <input
                  type="text"
                  value={formData.templateId}
                  onChange={(e) => setFormData({ ...formData, templateId: e.target.value })}
                  placeholder="my-template-id"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Unique identifier for this template
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My Template"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Describe what this template provides..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="infrastructure">Infrastructure</option>
                  <option value="backend">Backend</option>
                  <option value="frontend">Frontend</option>
                  <option value="serverless">Serverless</option>
                  <option value="fullstack">Full Stack</option>
                  <option value="mobile">Mobile</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Icon (Emoji)
                </label>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="📦"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Branch
                </label>
                <input
                  type="text"
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  placeholder="main"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="includeBranches"
                    checked={formData.includeBranches}
                    onChange={(e) => setFormData({ ...formData, includeBranches: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor="includeBranches" className="text-sm text-gray-700">
                    Include all branches
                  </label>
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPrivate"
                    checked={formData.isPrivate}
                    onChange={(e) => setFormData({ ...formData, isPrivate: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor="isPrivate" className="text-sm text-gray-700">
                    Private repository
                  </label>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Features
                </label>
                <div className="space-y-2">
                  {formData.features.map((feature, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={feature}
                        onChange={(e) => updateFeature(index, e.target.value)}
                        placeholder="Feature description"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeFeature(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addFeature}
                  >
                    Add Feature
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                "Import Template"
              )}
            </Button>
            <Link href="/dashboard/templates">
              <Button variant="outline" disabled={saving}>
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </main>
    </div>
  )
}