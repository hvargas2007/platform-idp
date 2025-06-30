"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { X, Loader2, Plus, Minus, RefreshCw, FileText, AlertTriangle } from "lucide-react"

interface TerraformPlanModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  runId: number
  runName?: string
}

interface PlanData {
  workflowRun: {
    id: number
    name: string
    status: string
    conclusion: string | null
    html_url: string
    created_at: string
    updated_at: string
  }
  plan: {
    planText: string
    summary: {
      toAdd: number
      toChange: number
      toDestroy: number
    }
  }
}

export function TerraformPlanModal({ 
  isOpen, 
  onClose, 
  projectId, 
  runId,
  runName 
}: TerraformPlanModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [planData, setPlanData] = useState<PlanData | null>(null)

  useEffect(() => {
    if (isOpen && runId) {
      fetchPlanLogs()
    }
  }, [isOpen, runId])

  const fetchPlanLogs = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/projects/${projectId}/deployment/${runId}/logs`)
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to fetch plan logs")
      }
      
      const data = await response.json()
      setPlanData(data)
    } catch (err: any) {
      setError(err.message || "Failed to load Terraform plan")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold">Terraform Plan Output</h2>
            {runName && (
              <p className="text-sm text-gray-600 mt-1">{runName}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600">{error}</p>
              <Button
                variant="outline"
                onClick={fetchPlanLogs}
                className="mt-4"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          ) : planData ? (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-600" />
                  Plan Summary
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Plus className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-900">To Add</span>
                    </div>
                    <p className="text-2xl font-bold text-green-700">
                      {planData.plan.summary.toAdd}
                    </p>
                    <p className="text-xs text-green-600 mt-1">resources</p>
                  </div>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <RefreshCw className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-900">To Change</span>
                    </div>
                    <p className="text-2xl font-bold text-yellow-700">
                      {planData.plan.summary.toChange}
                    </p>
                    <p className="text-xs text-yellow-600 mt-1">resources</p>
                  </div>
                  
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Minus className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium text-red-900">To Destroy</span>
                    </div>
                    <p className="text-2xl font-bold text-red-700">
                      {planData.plan.summary.toDestroy}
                    </p>
                    <p className="text-xs text-red-600 mt-1">resources</p>
                  </div>
                </div>
              </div>

              {/* Plan Details */}
              <div>
                <h3 className="font-semibold mb-3">Full Plan Output</h3>
                <div className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm font-mono whitespace-pre-wrap">
                    {planData.plan.planText}
                  </pre>
                </div>
              </div>

              {/* Workflow Info */}
              <div className="text-sm text-gray-600 flex items-center justify-between">
                <span>
                  Workflow run #{planData.workflowRun.id} • {new Date(planData.workflowRun.created_at).toLocaleString()}
                </span>
                <a
                  href={planData.workflowRun.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700"
                >
                  View on GitHub →
                </a>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}