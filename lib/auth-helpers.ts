import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function requireAdmin() {
  const session = await auth()
  
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  // Get user with role from database
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  })

  if (!user || user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 }) }
  }

  return { userId: session.user.id }
}

export async function getSessionUser() {
  const session = await auth()
  
  if (!session?.user?.id) {
    return null
  }

  return session.user
}