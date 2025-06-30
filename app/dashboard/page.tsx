import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { 
  Plus, 
  FileCode2, 
  Github, 
  FolderOpen,
  Activity,
  TrendingUp,
  Clock,
  CheckCircle2
} from "lucide-react"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { ExternalLinkButton } from "@/components/ui/external-link-button"
import { StatsCard } from "@/components/ui/stats-card"
import { ProjectCard } from "@/components/ui/project-card"

export default async function DashboardPage() {
  const session = await auth()

  // Get statistics
  const [
    projectCount,
    activeProjectCount,
    templateCount,
    recentProjects,
    recentTemplates
  ] = await Promise.all([
    prisma.project.count({
      where: {
        userId: session!.user?.id,
        status: { not: "DELETED" }
      }
    }),
    prisma.project.count({
      where: {
        userId: session!.user?.id,
        status: "ACTIVE"
      }
    }),
    prisma.gitHubTemplate.count({
      where: {
        createdBy: session!.user?.id,
        isActive: true
      }
    }),
    prisma.project.findMany({
      where: {
        userId: session!.user?.id,
        status: { not: "DELETED" }
      },
      include: {
        githubTemplate: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    }),
    prisma.gitHubTemplate.findMany({
      where: {
        createdBy: session!.user?.id,
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 3
    })
  ])

  const stats = [
    { 
      title: 'Total Projects', 
      value: projectCount, 
      icon: FolderOpen,
      color: 'primary' as const,
      description: 'All time projects'
    },
    { 
      title: 'Active Projects', 
      value: activeProjectCount, 
      icon: CheckCircle2,
      color: 'success' as const,
      description: 'Currently deployed'
    },
    { 
      title: 'Templates', 
      value: templateCount, 
      icon: FileCode2,
      color: 'warning' as const,
      description: 'Available templates'
    },
    { 
      title: 'Activity', 
      value: 'Active', 
      icon: Activity,
      color: 'error' as const,
      description: 'System status'
    },
  ]
  
  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome back, {session!.user?.name || session!.user?.email}</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <StatsCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            color={stat.color}
            description={stat.description}
          />
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/projects/new">
            <Button className="bg-primary text-white hover:bg-primary-hover transition-colors">
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </Link>
          <Link href="/dashboard/templates/import">
            <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50">
              <FileCode2 className="h-4 w-4 mr-2" />
              Import Template
            </Button>
          </Link>
          {session!.user?.role === 'ADMIN' && (
            <Link href="/admin/templates">
              <Button variant="outline">
                Manage Templates
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm h-full flex flex-col">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-500" />
                Recent Projects
              </h3>
            </div>
            <div className="p-6 flex-1">
              {recentProjects.length > 0 ? (
                <div className="grid gap-4">
                  {recentProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <FolderOpen className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600 mb-4">No projects yet</p>
                    <Link href="/projects/new">
                      <Button className="bg-primary text-white hover:bg-primary-hover transition-colors">
                        <Plus className="h-4 w-4 mr-2" />
                        Create your first project
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Templates Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm h-full flex flex-col">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <FileCode2 className="h-5 w-5 text-gray-500" />
                  Your Templates
                </h3>
                <Link 
                  href="/dashboard/templates"
                  className="text-sm text-primary hover:text-primary-hover font-medium"
                >
                  View all
                </Link>
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col">
              {recentTemplates.length > 0 ? (
                <div className="space-y-3">
                  {recentTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="p-4 border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all bg-gray-50 hover:bg-white"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{template.icon}</span>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">{template.name}</h4>
                          <p className="text-sm text-gray-600">{template.category}</p>
                          <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                            <Github className="h-3 w-3" />
                            <span className="truncate">
                              {template.githubUrl.replace('https://github.com/', '')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <FileCode2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-600 mb-3">No templates yet</p>
                    <Link href="/dashboard/templates/import">
                      <Button size="sm" variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50">
                        Import template
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}