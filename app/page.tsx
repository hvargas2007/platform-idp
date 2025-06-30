import { Button } from "@/components/ui/button"
import { GitBranch, Cloud, Shield, Zap } from "lucide-react"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function HomePage() {
  const session = await auth()
  
  if (session) {
    redirect("/dashboard")
  }
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Internal Developer Portal
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Automatiza tu infraestructura con Terraform y estandariza tus proyectos en GitHub
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/auth/signin">
              <Button size="lg" className="bg-primary text-white hover:bg-primary-hover transition-colors">
                Empezar
              </Button>
            </Link>
            <Link href="/auth/signin">
              <Button size="lg" variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50">
                Ver Templates
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mt-16">
          <FeatureCard
            icon={<Cloud className="h-8 w-8" />}
            title="Infraestructura como Código"
            description="Despliega recursos en AWS, Azure o GCP con Terraform"
          />
          <FeatureCard
            icon={<GitBranch className="h-8 w-8" />}
            title="Automatización GitHub"
            description="Crea repos, configura CI/CD y protege branches automáticamente"
          />
          <FeatureCard
            icon={<Shield className="h-8 w-8" />}
            title="Templates Seguros"
            description="Usa templates pre-configurados con mejores prácticas"
          />
          <FeatureCard
            icon={<Zap className="h-8 w-8" />}
            title="Deploy Rápido"
            description="De la idea a producción en minutos, no días"
          />
        </div>
      </div>
    </main>
  )
}

function FeatureCard({ icon, title, description }: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 card-hover">
      <div className="text-primary mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  )
}