"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Plus, Edit, Trash2, Github, Save, X, Loader2, CheckCircle, XCircle, AlertCircle, Lock } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface GitHubTemplate {
  id: string
  templateId: string
  name: string
  description: string
  category: string
  icon: string
  githubUrl: string
  githubToken?: string
  githubOrganization?: string | null
  owner?: string | null
  repoName?: string | null
  branch: string
  features: string[]
  includeBranches: boolean
  isPrivate: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
  creator?: {
    id: string
    name: string | null
    email: string
  }
}

export default function AdminTemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<GitHubTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [newTemplate, setNewTemplate] = useState({
    templateId: "",
    name: "",
    description: "",
    category: "infrastructure",
    icon: "📦",
    githubUrl: "",
    githubToken: "",
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

  const [editingTemplate, setEditingTemplate] = useState<Partial<GitHubTemplate> | null>(null)

  // Load templates on component mount
  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/admin/templates")
      
      if (!response.ok) {
        if (response.status === 403) {
          router.push("/dashboard")
          return
        }
        throw new Error("Failed to load templates")
      }
      
      const data = await response.json()
      setTemplates(data)
    } catch (error) {
      console.error("Error loading templates:", error)
      setError("Error loading templates")
    } finally {
      setLoading(false)
    }
  }

  const validateGitHubRepo = async () => {
    if (!newTemplate.githubUrl) {
      setValidationState({
        loading: false,
        valid: false,
        error: "Please enter a GitHub URL",
        details: null
      })
      return
    }
    
    try {
      setValidationState({ loading: true, valid: null, error: null, details: null })
      
      const response = await fetch("/api/admin/templates/validate-github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubUrl: newTemplate.githubUrl,
          githubToken: newTemplate.githubToken
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
        if (!newTemplate.templateId) {
          setNewTemplate(prev => ({
            ...prev,
            templateId: data.parsedUrl.repo,
            name: prev.name || data.repository.name,
            description: prev.description || data.repository.description || ""
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
  
  const handleAddTemplate = async () => {
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
        ...newTemplate,
        features: newTemplate.features.filter(f => f.trim() !== "")
      }
      
      const response = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templateData)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create template")
      }
      
      const created = await response.json()
      setTemplates([created, ...templates])
      
      // Reset form
      setNewTemplate({
        templateId: "",
        name: "",
        description: "",
        category: "infrastructure",
        icon: "📦",
        githubUrl: "",
        githubToken: "",
        branch: "main",
        features: [""],
        includeBranches: true,
        isPrivate: false
      })
      setValidationState({
        loading: false,
        valid: null,
        error: null,
        details: null
      })
      setIsAdding(false)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateTemplate = async () => {
    if (!editingId || !editingTemplate) return
    
    try {
      setSaving(true)
      setError(null)
      
      const updateData = {
        ...editingTemplate,
        features: editingTemplate.features?.filter(f => f.trim() !== "")
      }
      
      const response = await fetch(`/api/admin/templates/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update template")
      }
      
      const updated = await response.json()
      setTemplates(templates.map(t => t.id === editingId ? updated : t))
      setEditingId(null)
      setEditingTemplate(null)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return
    
    try {
      const response = await fetch(`/api/admin/templates/${id}`, {
        method: "DELETE"
      })
      
      if (!response.ok) {
        throw new Error("Failed to delete template")
      }
      
      setTemplates(templates.filter(t => t.id !== id))
    } catch (error: any) {
      setError(error.message)
    }
  }

  const addFeature = () => {
    if (isAdding) {
      setNewTemplate({
        ...newTemplate,
        features: [...newTemplate.features, ""]
      })
    } else if (editingTemplate) {
      setEditingTemplate({
        ...editingTemplate,
        features: [...(editingTemplate.features || []), ""]
      })
    }
  }

  const updateFeature = (index: number, value: string) => {
    if (isAdding) {
      const features = [...newTemplate.features]
      features[index] = value
      setNewTemplate({ ...newTemplate, features })
    } else if (editingTemplate) {
      const features = [...(editingTemplate.features || [])]
      features[index] = value
      setEditingTemplate({ ...editingTemplate, features })
    }
  }

  const removeFeature = (index: number) => {
    if (isAdding) {
      const features = newTemplate.features.filter((_, i) => i !== index)
      setNewTemplate({ ...newTemplate, features })
    } else if (editingTemplate) {
      const features = (editingTemplate.features || []).filter((_, i) => i !== index)
      setEditingTemplate({ ...editingTemplate, features })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    )
  }

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
            <h1 className="text-2xl font-bold">Administrar Templates de GitHub</h1>
          </div>
          <Button onClick={() => setIsAdding(true)} disabled={isAdding}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar Template
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Formulario para agregar template */}
        {isAdding && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Nuevo Template desde GitHub</h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID único *
                </label>
                <input
                  type="text"
                  value={newTemplate.templateId}
                  onChange={(e) => setNewTemplate({ ...newTemplate, templateId: e.target.value })}
                  placeholder="terraform-vpc-module"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  placeholder="Terraform VPC Module"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL del Repositorio *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTemplate.githubUrl}
                    onChange={(e) => {
                      setNewTemplate({ ...newTemplate, githubUrl: e.target.value })
                      setValidationState({ loading: false, valid: null, error: null, details: null })
                    }}
                    placeholder="https://github.com/mi-empresa/terraform-aws-vpc"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={validateGitHubRepo}
                    disabled={validationState.loading || !newTemplate.githubUrl}
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
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
                    <p className="font-medium text-green-800">
                      {validationState.details.repository.fullName}
                    </p>
                    <p className="text-green-700">
                      {validationState.details.repository.description}
                    </p>
                    <div className="flex gap-4 mt-1 text-xs text-green-600">
                      <span>{validationState.details.repository.private ? "Private" : "Public"}</span>
                      <span>{validationState.details.repository.defaultBranch} branch</span>
                      <span>{validationState.details.owner.type}</span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  GitHub Token (for private repos)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={newTemplate.githubToken}
                    onChange={(e) => {
                      setNewTemplate({ ...newTemplate, githubToken: e.target.value })
                      setValidationState({ loading: false, valid: null, error: null, details: null })
                    }}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md"
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
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoría
                </label>
                <select
                  value={newTemplate.category}
                  onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="infrastructure">Infrastructure</option>
                  <option value="backend">Backend</option>
                  <option value="frontend">Frontend</option>
                  <option value="serverless">Serverless</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Icono
                </label>
                <input
                  type="text"
                  value={newTemplate.icon}
                  onChange={(e) => setNewTemplate({ ...newTemplate, icon: e.target.value })}
                  placeholder="🚀"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Branch
                </label>
                <input
                  type="text"
                  value={newTemplate.branch}
                  onChange={(e) => setNewTemplate({ ...newTemplate, branch: e.target.value })}
                  placeholder="main"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="includeBranches"
                    checked={newTemplate.includeBranches}
                    onChange={(e) => setNewTemplate({ ...newTemplate, includeBranches: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor="includeBranches" className="text-sm text-gray-700">
                    Incluir todos los branches
                  </label>
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPrivate"
                    checked={newTemplate.isPrivate}
                    onChange={(e) => setNewTemplate({ ...newTemplate, isPrivate: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor="isPrivate" className="text-sm text-gray-700">
                    Repositorio privado
                  </label>
                </div>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Características
                </label>
                {newTemplate.features.map((feature, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={feature}
                      onChange={(e) => updateFeature(index, e.target.value)}
                      placeholder="Característica del template"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeFeature(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addFeature}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar característica
                </Button>
              </div>
            </div>
            
            <div className="flex gap-4 mt-6">
              <Button onClick={handleAddTemplate} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Guardar Template
              </Button>
              <Button variant="outline" onClick={() => setIsAdding(false)} disabled={saving}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Lista de templates */}
        <div className="grid gap-4">
          {templates.map((template) => (
            <div key={template.id} className="bg-white rounded-lg shadow-sm p-6">
              {editingId === template.id ? (
                // Edit mode
                <div>
                  <h3 className="text-lg font-semibold mb-4">Editar Template</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre
                      </label>
                      <input
                        type="text"
                        value={editingTemplate?.name || ""}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Categoría
                      </label>
                      <select
                        value={editingTemplate?.category || ""}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, category: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="infrastructure">Infrastructure</option>
                        <option value="backend">Backend</option>
                        <option value="frontend">Frontend</option>
                        <option value="serverless">Serverless</option>
                      </select>
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Descripción
                      </label>
                      <textarea
                        value={editingTemplate?.description || ""}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Características
                      </label>
                      {(editingTemplate?.features || []).map((feature, index) => (
                        <div key={index} className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={feature}
                            onChange={(e) => updateFeature(index, e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeFeature(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={addFeature}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Agregar característica
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 mt-6">
                    <Button onClick={handleUpdateTemplate} disabled={saving}>
                      {saving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Guardar cambios
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setEditingId(null)
                        setEditingTemplate(null)
                      }} 
                      disabled={saving}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                // Display mode
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{template.icon}</span>
                      <h3 className="text-lg font-semibold">{template.name}</h3>
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        {template.category}
                      </span>
                      {template.isPrivate && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                          Private
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 mb-2">{template.description}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Github className="h-4 w-4" />
                      <code>{template.githubUrl}</code>
                      <span>•</span>
                      <span>Branch: {template.branch}</span>
                      {template.includeBranches && (
                        <>
                          <span>•</span>
                          <span>Incluye todos los branches</span>
                        </>
                      )}
                    </div>
                    {(template.owner || template.githubOrganization) && (
                      <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                        <span>Owner: {template.owner}</span>
                        {template.githubOrganization && (
                          <>
                            <span>•</span>
                            <span className="text-blue-600">Organization</span>
                          </>
                        )}
                        {template.githubToken && (
                          <>
                            <span>•</span>
                            <Lock className="h-3 w-3 inline" />
                            <span className="text-green-600">Token configured</span>
                          </>
                        )}
                      </div>
                    )}
                    {template.features.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">Características:</p>
                        <ul className="text-sm text-gray-600 list-disc list-inside">
                          {template.features.slice(0, 3).map((feature, i) => (
                            <li key={i}>{feature}</li>
                          ))}
                          {template.features.length > 3 && (
                            <li>... y {template.features.length - 3} más</li>
                          )}
                        </ul>
                      </div>
                    )}
                    {template.creator && (
                      <div className="mt-2 text-xs text-gray-500">
                        Creado por: {template.creator.name || template.creator.email}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setEditingId(template.id)
                        setEditingTemplate({
                          name: template.name,
                          description: template.description,
                          category: template.category,
                          icon: template.icon,
                          githubUrl: template.githubUrl,
                          branch: template.branch,
                          features: [...template.features],
                          includeBranches: template.includeBranches,
                          isPrivate: template.isPrivate
                        })
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleDeleteTemplate(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {templates.length === 0 && !isAdding && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No hay templates configurados aún</p>
            <Button onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar primer template
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}