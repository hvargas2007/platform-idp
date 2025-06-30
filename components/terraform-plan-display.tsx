"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, Minus, RefreshCw, FileText, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react"

interface TerraformPlanDisplayProps {
  projectId: string
  runId: number
  runName?: string
  expandedByDefault?: boolean
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

export function TerraformPlanDisplay({ 
  projectId, 
  runId,
  runName,
  expandedByDefault = false
}: TerraformPlanDisplayProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [planData, setPlanData] = useState<PlanData | null>(null)
  const [expanded, setExpanded] = useState(expandedByDefault)
  const [hasLoaded, setHasLoaded] = useState(false)

  useEffect(() => {
    // Auto-load if expanded by default
    if (expandedByDefault && !hasLoaded) {
      fetchPlanLogs()
    }
  }, [expandedByDefault])

  const fetchPlanLogs = async () => {
    setLoading(true)
    setError(null)
    setHasLoaded(true)
    
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

  const handleToggle = () => {
    if (!expanded && !hasLoaded) {
      fetchPlanLogs()
    }
    setExpanded(!expanded)
  }

  return (
    <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={handleToggle}
        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-600" />
          <span className="font-medium text-gray-900">Terraform Plan Output</span>
          {planData && !loading && (
            <div className="flex items-center gap-2 ml-3">
              {planData.plan.summary.toAdd > 0 && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1">
                  <Plus className="h-3 w-3" />
                  {planData.plan.summary.toAdd}
                </span>
              )}
              {planData.plan.summary.toChange > 0 && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" />
                  {planData.plan.summary.toChange}
                </span>
              )}
              {planData.plan.summary.toDestroy > 0 && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full flex items-center gap-1">
                  <Minus className="h-3 w-3" />
                  {planData.plan.summary.toDestroy}
                </span>
              )}
            </div>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-600" />
        )}
      </button>

      {/* Content */}
      {expanded && (
        <div className="p-4 bg-white">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
              <p className="text-red-600 text-sm mb-3">{error}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={fetchPlanLogs}
              >
                <RefreshCw className="h-3 w-3 mr-2" />
                Retry
              </Button>
            </div>
          ) : planData ? (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Plus className="h-3 w-3 text-green-600" />
                    <span className="text-xs font-medium text-green-900">To Add</span>
                  </div>
                  <p className="text-xl font-bold text-green-700">
                    {planData.plan.summary.toAdd}
                  </p>
                  <p className="text-xs text-green-600">resources</p>
                </div>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <RefreshCw className="h-3 w-3 text-yellow-600" />
                    <span className="text-xs font-medium text-yellow-900">To Change</span>
                  </div>
                  <p className="text-xl font-bold text-yellow-700">
                    {planData.plan.summary.toChange}
                  </p>
                  <p className="text-xs text-yellow-600">resources</p>
                </div>
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Minus className="h-3 w-3 text-red-600" />
                    <span className="text-xs font-medium text-red-900">To Destroy</span>
                  </div>
                  <p className="text-xl font-bold text-red-700">
                    {planData.plan.summary.toDestroy}
                  </p>
                  <p className="text-xs text-red-600">resources</p>
                </div>
              </div>

              {/* Plan Details */}
              <div>
                <h4 className="text-sm font-semibold mb-2 text-gray-700">Full Plan Output</h4>
                {planData.plan.planText ? (
                  <div className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto max-h-96 overflow-y-auto">
                    <pre className="text-xs font-mono whitespace-pre-wrap">
                      {planData.plan.planText}
                    </pre>
                  </div>
                ) : (
                  <div className="bg-gray-100 text-gray-600 rounded-lg p-4 text-center text-sm">
                    {(planData.plan.summary.toAdd === 0 && 
                      planData.plan.summary.toChange === 0 && 
                      planData.plan.summary.toDestroy === 0) 
                      ? "No changes. Infrastructure is up-to-date." 
                      : "Plan output not available"}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}