import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Octokit } from "@octokit/rest"

export async function GET() {
  const results = {
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hasGithubToken: !!process.env.GITHUB_TOKEN,
      hasGithubId: !!process.env.GITHUB_ID,
      hasGithubSecret: !!process.env.GITHUB_SECRET,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      githubTokenLength: process.env.GITHUB_TOKEN?.length || 0
    },
    database: {
      connected: false,
      error: null as string | null
    },
    github: {
      authenticated: false,
      user: null as string | null,
      error: null as string | null,
      tokenScopes: null as string | null
    },
    auth: {
      sessionExists: false,
      user: null as any
    }
  }

  // Test database connection
  try {
    await prisma.$connect()
    const count = await prisma.user.count()
    results.database.connected = true
    results.database.error = null
  } catch (error: any) {
    results.database.connected = false
    results.database.error = error.message
  }

  // Test GitHub API
  if (process.env.GITHUB_TOKEN) {
    try {
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })
      const { data, headers } = await octokit.users.getAuthenticated()
      results.github.authenticated = true
      results.github.user = data.login
      results.github.tokenScopes = headers['x-oauth-scopes'] || 'unknown'
    } catch (error: any) {
      results.github.authenticated = false
      results.github.error = error.message
    }
  }

  // Test auth session
  try {
    const session = await auth()
    results.auth.sessionExists = !!session
    results.auth.user = session?.user ? {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name
    } : null
  } catch (error: any) {
    results.auth.sessionExists = false
  }

  return NextResponse.json(results, { status: 200 })
}