import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AppLayout } from "@/components/layout/app-layout"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  
  if (!session) {
    redirect("/auth/signin")
  }
  
  // Check if user is admin
  if (session.user?.role !== 'ADMIN') {
    redirect("/dashboard")
  }

  return (
    <AppLayout user={session.user}>
      {children}
    </AppLayout>
  )
}