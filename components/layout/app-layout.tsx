"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  LayoutDashboard, 
  FileCode2, 
  FolderOpen, 
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  User
} from "lucide-react"
import { useState } from "react"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"

interface AppLayoutProps {
  children: React.ReactNode
  user?: {
    name?: string | null
    email?: string | null
    image?: string | null
    role?: string | null
  }
}

const navigation = [
  { 
    name: "Dashboard", 
    href: "/dashboard", 
    icon: LayoutDashboard,
    description: "Overview and statistics"
  },
  { 
    name: "Templates", 
    href: "/dashboard/templates", 
    icon: FileCode2,
    description: "Manage your templates" 
  },
  { 
    name: "Projects", 
    href: "/dashboard/projects", 
    icon: FolderOpen,
    description: "View all projects"
  },
  { 
    name: "Settings", 
    href: "/dashboard/settings", 
    icon: Settings,
    description: "Account settings"
  },
]

export function AppLayout({ children, user }: AppLayoutProps) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar transition-all duration-300 lg:static lg:z-auto",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        sidebarCollapsed ? "w-20" : "w-64"
      )}>
        {/* Logo Section */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-gray-700/30">
          <div className={cn(
            "flex items-center gap-3 transition-opacity duration-200",
            sidebarCollapsed && "lg:opacity-0"
          )}>
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm">IDP</span>
            </div>
            <h1 className="text-lg font-semibold text-white">Platform</h1>
          </div>
          
          {/* Mobile close button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-300 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          
          {/* Desktop collapse button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:block text-gray-300 hover:text-white transition-colors"
          >
            <ChevronRight className={cn(
              "h-5 w-5 transition-transform duration-200",
              sidebarCollapsed ? "rotate-0" : "rotate-180"
            )} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href || 
                           (item.href !== '/dashboard' && pathname.startsWith(item.href))
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
                  isActive 
                    ? "bg-sidebar-dark text-white shadow-sm" 
                    : "text-gray-300 hover:bg-sidebar-dark/50 hover:text-white",
                  sidebarCollapsed && "lg:justify-center lg:px-2"
                )}
                title={sidebarCollapsed ? item.name : undefined}
              >
                <item.icon className={cn(
                  "h-5 w-5 transition-colors",
                  isActive ? "text-white" : "text-gray-400 group-hover:text-white"
                )} />
                <div className={cn(
                  "flex flex-col transition-opacity duration-200",
                  sidebarCollapsed && "lg:hidden"
                )}>
                  <span>{item.name}</span>
                  {!sidebarCollapsed && (
                    <span className="text-xs text-gray-400 group-hover:text-gray-300">
                      {item.description}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-gray-700/30 p-3">
          <div className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg mb-2",
            sidebarCollapsed && "lg:justify-center lg:px-2"
          )}>
            {user?.image ? (
              <img
                className="h-8 w-8 rounded-full ring-2 ring-primary"
                src={user.image}
                alt={user.name || "User"}
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                <User className="h-4 w-4 text-white" />
              </div>
            )}
            <div className={cn(
              "flex-1 min-w-0 transition-opacity duration-200",
              sidebarCollapsed && "lg:hidden"
            )}>
              <p className="text-sm font-medium text-white truncate">
                {user?.name || user?.email}
              </p>
              {user?.role && (
                <p className="text-xs text-gray-400 capitalize">
                  {user.role.toLowerCase()}
                </p>
              )}
            </div>
          </div>
          
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-300 rounded-lg hover:bg-sidebar-dark/50 hover:text-white transition-all duration-200",
              sidebarCollapsed && "lg:justify-center lg:px-2"
            )}
            title={sidebarCollapsed ? "Sign out" : undefined}
          >
            <LogOut className="h-5 w-5 text-gray-400" />
            <span className={cn(
              "transition-opacity duration-200",
              sidebarCollapsed && "lg:hidden"
            )}>
              Sign out
            </span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-white font-bold text-xs">IDP</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Platform</h2>
            </div>
            <div className="w-6" />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="min-h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}