import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/encryption"

export interface GitHubTemplate {
  id: string
  templateId: string
  name: string
  description: string
  category: string
  icon: string
  githubUrl: string
  branch: string
  features: string[]
  includeBranches: boolean
  isPrivate: boolean
  owner?: string | null
  repoName?: string | null
  githubOrganization?: string | null
}

export interface GitHubTemplateWithToken extends GitHubTemplate {
  githubToken?: string | null
}

// Get all active GitHub templates from database
export async function getGitHubTemplates(): Promise<GitHubTemplate[]> {
  const templates = await prisma.gitHubTemplate.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" }
  })
  
  return templates.map(template => ({
    id: template.templateId,
    templateId: template.templateId,
    name: template.name,
    description: template.description,
    category: template.category,
    icon: template.icon,
    githubUrl: template.githubUrl,
    branch: template.branch,
    features: template.features,
    includeBranches: template.includeBranches,
    isPrivate: template.isPrivate
  }))
}

// Get a template by templateId
export async function getGitHubTemplateById(templateId: string): Promise<GitHubTemplate | null> {
  const template = await prisma.gitHubTemplate.findFirst({
    where: { 
      templateId,
      isActive: true 
    }
  })
  
  if (!template) return null
  
  return {
    id: template.templateId,
    templateId: template.templateId,
    name: template.name,
    description: template.description,
    category: template.category,
    icon: template.icon,
    githubUrl: template.githubUrl,
    branch: template.branch,
    features: template.features,
    includeBranches: template.includeBranches,
    isPrivate: template.isPrivate
  }
}

// Get templates by category
export async function getGitHubTemplatesByCategory(category: string): Promise<GitHubTemplate[]> {
  const templates = await prisma.gitHubTemplate.findMany({
    where: { 
      category,
      isActive: true 
    },
    orderBy: { createdAt: "desc" }
  })
  
  return templates.map(template => ({
    id: template.templateId,
    templateId: template.templateId,
    name: template.name,
    description: template.description,
    category: template.category,
    icon: template.icon,
    githubUrl: template.githubUrl,
    branch: template.branch,
    features: template.features,
    includeBranches: template.includeBranches,
    isPrivate: template.isPrivate
  }))
}

// Get a template by templateId with decrypted token (for internal use only)
export async function getGitHubTemplateWithToken(templateId: string): Promise<GitHubTemplateWithToken | null> {
  const template = await prisma.gitHubTemplate.findFirst({
    where: { 
      templateId,
      isActive: true 
    }
  })
  
  if (!template) return null
  
  let decryptedToken: string | null = null
  if (template.githubToken) {
    try {
      decryptedToken = decrypt(template.githubToken)
    } catch (error) {
      console.error("Failed to decrypt template token:", error)
    }
  }
  
  return {
    id: template.templateId,
    templateId: template.templateId,
    name: template.name,
    description: template.description,
    category: template.category,
    icon: template.icon,
    githubUrl: template.githubUrl,
    branch: template.branch,
    features: template.features,
    includeBranches: template.includeBranches,
    isPrivate: template.isPrivate,
    owner: template.owner,
    repoName: template.repoName,
    githubOrganization: template.githubOrganization,
    githubToken: decryptedToken
  }
}

// Seed initial templates if database is empty
export async function seedGitHubTemplates() {
  const count = await prisma.gitHubTemplate.count()
  
  if (count === 0) {
    console.log("No templates found, skipping seed. Use the admin interface to add templates.")
  }
}