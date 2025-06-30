import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface StatsCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  description?: string
  trend?: {
    value: number
    isPositive: boolean
  }
  color?: "primary" | "success" | "warning" | "error"
  className?: string
}

const colorClasses = {
  primary: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    icon: "text-blue-600"
  },
  success: {
    bg: "bg-green-50",
    text: "text-green-700",
    icon: "text-green-600"
  },
  warning: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    icon: "text-amber-600"
  },
  error: {
    bg: "bg-red-50",
    text: "text-red-700",
    icon: "text-red-600"
  }
}

export function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  description,
  trend,
  color = "primary",
  className 
}: StatsCardProps) {
  const colors = colorClasses[color]
  
  return (
    <div className={cn(
      "bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 p-6 h-full flex flex-col",
      className
    )}>
      <div className="flex items-start justify-between flex-1">
        <div className="flex-1 flex flex-col">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            {trend && (
              <span className={cn(
                "text-sm font-medium",
                trend.isPositive ? "text-green-600" : "text-red-600"
              )}>
                {trend.isPositive ? "+" : "-"}{Math.abs(trend.value)}%
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500 min-h-[1.25rem]">
            {description || '\u00A0'}
          </p>
        </div>
        <div className={cn(
          "p-3 rounded-xl",
          colors.bg
        )}>
          <Icon className={cn("h-6 w-6", colors.icon)} />
        </div>
      </div>
    </div>
  )
}