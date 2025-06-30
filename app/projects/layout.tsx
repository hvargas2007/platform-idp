import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AppLayout } from "@/components/layout/app-layout"

export default async function ProjectsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  
  if (!session) {
    redirect("/auth/signin")
  }

  return (
    <AppLayout user={session.user}>
      {children}
    </AppLayout>
  )
}