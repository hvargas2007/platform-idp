"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { 
  Plus, 
  FileCode2, 
  Search,
  Filter
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { TemplateCard } from "@/components/ui/template-card"
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
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function TemplatesPage() {
  const router = useRouter()
  const { showError, showSuccess } = useToast()
  const [templates, setTemplates] = useState<GitHubTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/templates")
      
      if (!response.ok) {
        throw new Error("Failed to load templates")
      }
      
      const data = await response.json()
      setTemplates(data)
    } catch (error) {
      console.error("Error loading templates:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    try {
      const response = await fetch(`/api/templates/${id}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        throw new Error("Failed to delete template")
      }

      setTemplates(templates.filter(t => t.id !== id))
      showSuccess("Template deleted successfully")
    } catch (error) {
      console.error("Error deleting template:", error)
      showError("Failed to delete template. Please try again.")
    }
  }

  const filteredTemplates = templates.filter(template => 
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.category.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading templates...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Templates</h1>
            <p className="text-gray-600">Import and manage templates from GitHub repositories</p>
          </div>
          <Link href="/dashboard/templates/import">
            <Button className="bg-primary text-white hover:bg-primary-hover transition-colors">
              <Plus className="h-4 w-4 mr-2" />
              Import Template
            </Button>
          </Link>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <Button variant="outline" className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filter
        </Button>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <FileCode2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {searchQuery ? "No templates found" : "No templates yet"}
          </h2>
          <p className="text-gray-600 mb-6">
            {searchQuery 
              ? "Try adjusting your search query" 
              : "Import templates from GitHub to use them in your projects"
            }
          </p>
          {!searchQuery && (
            <Link href="/dashboard/templates/import">
              <Button className="bg-primary text-white hover:bg-primary-hover transition-colors">
                <Plus className="h-4 w-4 mr-2" />
                Import your first template
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <TemplateCard 
              key={template.id} 
              template={template} 
              onDelete={handleDeleteTemplate}
            />
          ))}
        </div>
      )}
    </div>
  )
}