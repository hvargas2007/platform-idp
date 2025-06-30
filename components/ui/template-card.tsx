"use client"

import { cn } from "@/lib/utils"
import Link from "next/link"
import { 
  Github, 
  ExternalLink,
  MoreVertical,
  Lock,
  GitBranch,
  Trash2,
  FileCode2
} from "lucide-react"
import { Button } from "./button"
import { useState } from "react"

interface TemplateCardProps {
  template: {
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
  }
  onDelete?: (id: string) => void
  className?: string
}

export function TemplateCard({ template, onDelete, className }: TemplateCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  
  const handleDelete = async () => {
    if (!onDelete) return
    
    if (!confirm("Are you sure you want to delete this template? This action cannot be undone.")) {
      return
    }
    
    setIsDeleting(true)
    try {
      await onDelete(template.id)
    } finally {
      setIsDeleting(false)
    }
  }
  
  return (
    <div className={cn(
      "bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 card-hover",
      className
    )}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="text-4xl">{template.icon || "📦"}</div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg text-gray-900 truncate">{template.name}</h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                {template.category}
              </span>
            </div>
          </div>
          <button className="text-gray-400 hover:text-gray-600 transition-colors">
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>

        {/* Description */}
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {template.description}
        </p>

        {/* Repository Info */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <Github className="h-4 w-4 text-gray-400" />
            <code className="text-xs text-gray-600 truncate flex-1">
              {template.githubUrl.replace('https://github.com/', '')}
            </code>
          </div>
          
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              <span>{template.branch}</span>
            </div>
            {template.isPrivate && (
              <div className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                <span>Private</span>
              </div>
            )}
            {template.includeBranches && (
              <span>All branches</span>
            )}
          </div>
        </div>

        {/* Features */}
        {template.features.length > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-1">
              {template.features.slice(0, 3).map((feature, i) => (
                <span 
                  key={i}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                >
                  {feature}
                </span>
              ))}
              {template.features.length > 3 && (
                <span className="text-xs text-gray-500">
                  +{template.features.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex gap-2">
            <Link href={`/projects/new?template=${template.templateId}`}>
              <Button size="sm" className="bg-primary hover:bg-primary-hover text-white">
                Use Template
              </Button>
            </Link>
            <a 
              href={template.githubUrl} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="outline" className="border-gray-200 hover:bg-gray-50">
                <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          </div>
          
          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {isDeleting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}