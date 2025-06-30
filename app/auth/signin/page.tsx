"use client"

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { GitBranch } from "lucide-react"

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Bienvenido a IDP Platform
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Inicia sesión para gestionar tu infraestructura
          </p>
        </div>
        
        <div className="mt-8 space-y-6">
          <Button
            onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
            className="w-full flex items-center justify-center gap-3"
            size="lg"
          >
            <GitBranch className="h-5 w-5" />
            Continuar con GitHub
          </Button>
        </div>
        
        <div className="text-center text-sm text-gray-600">
          <p>Al iniciar sesión, aceptas nuestros términos de servicio</p>
        </div>
      </div>
    </div>
  )
}