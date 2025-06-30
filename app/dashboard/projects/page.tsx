import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { 
  Plus, 
  FolderOpen,
  Search,
  Filter
} from "lucide-react"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { ProjectCard } from "@/components/ui/project-card"

export default async function ProjectsPage() {
  const session = await auth()

  const projects = await prisma.project.findMany({
    where: {
      userId: session!.user?.id,
      status: { not: "DELETED" }
    },
    include: {
      githubTemplate: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#111b21] mb-2">Projects</h1>
            <p className="text-[#667781]">Manage and monitor your deployed projects</p>
          </div>
          <Link href="/projects/new">
            <Button className="bg-[#25d366] text-white hover:bg-[#128c7e] transition-colors shadow-sm hover:shadow-md">
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search projects..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#25d366] focus:border-transparent"
          />
        </div>
        <Button variant="outline" className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filter
        </Button>
      </div>

      {/* Projects Grid */}
      {projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-12">
          <div className="text-center">
            <FolderOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[#111b21] mb-2">No projects yet</h3>
            <p className="text-[#667781] mb-6">Get started by creating your first project from a template</p>
            <Link href="/projects/new">
              <Button className="bg-[#25d366] text-white hover:bg-[#128c7e] transition-colors shadow-sm hover:shadow-md">
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}