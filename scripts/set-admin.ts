import { prisma } from "../lib/prisma"

async function main() {
  const email = process.argv[2]
  
  if (!email) {
    console.error("Usage: npx tsx scripts/set-admin.ts <email>")
    process.exit(1)
  }
  
  try {
    const user = await prisma.user.update({
      where: { email },
      data: { role: "ADMIN" }
    })
    
    console.log(`User ${user.email} is now an admin!`)
  } catch (error) {
    console.error("Error setting admin role:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()