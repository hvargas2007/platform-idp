"use client"

import { cn } from "@/lib/utils"
import Link from "next/link"
import { 
  GitBranch, 
  Calendar, 
  ExternalLink,
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock,
  FolderOpen,
  Trash2,
  Edit,
  Settings
} from "lucide-react"
import { Button } from "./button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/contexts/toast-context"

interface ProjectCardProps {
  project: {
    id: string
    name: string
    description?: string | null
    status: string
    githubRepo?: string | null
    createdAt: Date
    githubTemplate?: {
      name: string
      icon: string
    } | null
  }
  className?: string
}

const statusConfig = {
  ACTIVE: { 
    icon: CheckCircle, 
    color: 'text-[#25d366] bg-[#dcf8c6]',
    label: 'Active'
  },
  PENDING: { 
    icon: Clock, 
    color: 'text-[#ffa000] bg-[#fff3cd]',
    label: 'Pending'
  },
  FAILED: { 
    icon: XCircle, 
    color: 'text-red-600 bg-red-100',
    label: 'Failed'
  },
  DELETED: { 
    icon: XCircle, 
    color: 'text-gray-600 bg-gray-100',
    label: 'Deleted'
  }
}

export function ProjectCard({ project, className }: ProjectCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()
  const { showError, showSuccess } = useToast()
  
  const status = statusConfig[project.status as keyof typeof statusConfig] || statusConfig.PENDING
  const StatusIcon = status.icon
  
  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete project')
      }
      
      setShowDeleteDialog(false)
      showSuccess('Project deleted successfully')
      router.refresh()
    } catch (error) {
      console.error('Error deleting project:', error)
      showError('Failed to delete project. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }
  
  return (
    <>
    <div className={cn(
      "bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 card-hover",
      className
    )}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 bg-gray-100 rounded-lg">
              {project.githubTemplate?.icon ? (
                <span className="text-2xl">{project.githubTemplate.icon}</span>
              ) : (
                <FolderOpen className="h-6 w-6 text-gray-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[#111b21] truncate">{project.name}</h3>
              <p className="text-sm text-[#667781]">
                {project.githubTemplate?.name || 'Custom Project'}
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md hover:bg-gray-100">
                <MoreVertical className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/projects/${project.id}`} className="cursor-pointer">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/projects/${project.id}/edit`} className="cursor-pointer">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setShowDeleteDialog(true)}
                className="text-red-600 focus:text-red-600 cursor-pointer"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description */}
        {project.description && (
          <p className="text-sm text-[#667781] mb-4 line-clamp-2">
            {project.description}
          </p>
        )}

        {/* Metadata */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2">
            <div className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
              status.color
            )}>
              <StatusIcon className="h-3.5 w-3.5" />
              <span>{status.label}</span>
            </div>
          </div>
          
          {project.githubRepo && (
            <div className="flex items-center gap-2 text-sm">
              <GitBranch className="h-4 w-4 text-gray-400" />
              <a 
                href={project.githubRepo}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#128c7e] hover:text-[#075e54] flex items-center gap-1 transition-colors"
              >
                Repository
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
          
          <div className="flex items-center gap-2 text-sm text-[#667781]">
            <Calendar className="h-4 w-4" />
            <span>{new Date(project.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t border-gray-100">
          <Link href={`/projects/${project.id}`} className="flex-1">
            <Button 
              variant="outline" 
              className="w-full border-[#e9ebee] text-[#667781] hover:bg-[#f0f2f5] hover:border-[#667781]"
            >
              View Details
            </Button>
          </Link>
        </div>
      </div>
    </div>
    
    {/* Delete Confirmation Dialog */}
    <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Project</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{project.name}&quot;? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setShowDeleteDialog(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? "Deleting..." : "Delete Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}