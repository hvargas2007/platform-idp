import { Octokit } from "@octokit/rest"
import { ProjectTemplate, FileStructure, GitflowConfig } from "@/lib/templates/project-templates"

export interface GitHubTemplateConfig {
  owner: string
  repo: string
  branch?: string
  path?: string // Ruta al archivo de configuración del template
}

export interface TemplateManifest {
  name: string
  description: string
  category: string
  icon?: string
  features: string[]
  gitflow: GitflowConfig
  excludeFiles?: string[] // Archivos a excluir del template
  replaceVariables?: boolean // Si debe reemplazar {{VARIABLES}}
}

export class GitHubTemplateFetcher {
  private octokit: Octokit
  
  constructor(token?: string) {
    this.octokit = new Octokit({ auth: token || process.env.GITHUB_TOKEN })
  }
  
  /**
   * Obtener template desde un repositorio de GitHub
   */
  async fetchTemplate(config: GitHubTemplateConfig): Promise<ProjectTemplate> {
    const { owner, repo, branch = 'main', path = '.template.json' } = config
    
    try {
      // 1. Obtener el manifest del template
      const manifest = await this.fetchManifest(owner, repo, branch, path)
      
      // 2. Obtener la estructura de archivos del repositorio
      const structure = await this.fetchRepoStructure(owner, repo, branch, manifest.excludeFiles)
      
      // 3. Construir el template completo
      const template: ProjectTemplate = {
        id: `github-${owner}-${repo}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        name: manifest.name,
        description: manifest.description,
        category: manifest.category,
        icon: manifest.icon || '📦',
        features: manifest.features,
        gitflow: manifest.gitflow,
        structure: structure
      }
      
      return template
    } catch (error) {
      console.error(`Error fetching template from ${owner}/${repo}:`, error)
      throw error
    }
  }
  
  /**
   * Obtener el archivo de configuración del template
   */
  private async fetchManifest(
    owner: string, 
    repo: string, 
    branch: string, 
    path: string
  ): Promise<TemplateManifest> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch
      })
      
      if ('content' in data && data.type === 'file') {
        const content = Buffer.from(data.content, 'base64').toString('utf-8')
        return JSON.parse(content)
      }
      
      throw new Error('Template manifest not found')
    } catch (error: any) {
      if (error.status === 404) {
        throw new Error(`Template manifest not found at ${path}. Create a ${path} file in your template repository.`)
      }
      throw error
    }
  }
  
  /**
   * Obtener todos los archivos del repositorio
   */
  private async fetchRepoStructure(
    owner: string,
    repo: string,
    branch: string,
    excludeFiles: string[] = []
  ): Promise<FileStructure> {
    const structure: FileStructure = {}
    
    // Archivos a excluir por defecto
    const defaultExcludes = [
      '.git',
      '.github/workflows', // Los workflows se manejan aparte
      '.template.json',
      'node_modules',
      '.env',
      '.env.local',
      '*.log',
      '.DS_Store'
    ]
    
    const allExcludes = [...defaultExcludes, ...excludeFiles]
    
    // Obtener el árbol de archivos
    const { data: tree } = await this.octokit.git.getTree({
      owner,
      repo,
      tree_sha: branch,
      recursive: 'true'
    })
    
    // Filtrar y obtener contenido de cada archivo
    for (const item of tree.tree) {
      if (item.type === 'blob' && item.path && !this.shouldExclude(item.path, allExcludes)) {
        try {
          const content = await this.fetchFileContent(owner, repo, item.sha!)
          structure[item.path] = content
        } catch (error) {
          console.error(`Error fetching ${item.path}:`, error)
        }
      }
    }
    
    return structure
  }
  
  /**
   * Obtener el contenido de un archivo específico
   */
  private async fetchFileContent(owner: string, repo: string, sha: string): Promise<string> {
    try {
      const { data } = await this.octokit.git.getBlob({
        owner,
        repo,
        file_sha: sha
      })
      
      // Decodificar según el encoding
      if (data.encoding === 'base64') {
        return Buffer.from(data.content, 'base64').toString('utf-8')
      }
      
      return data.content
    } catch (error) {
      console.error(`Error fetching blob ${sha}:`, error)
      return ''
    }
  }
  
  /**
   * Verificar si un archivo debe ser excluido
   */
  private shouldExclude(path: string, excludePatterns: string[]): boolean {
    return excludePatterns.some(pattern => {
      // Soporte básico para wildcards
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'))
        return regex.test(path)
      }
      // Coincidencia exacta o de prefijo
      return path === pattern || path.startsWith(pattern + '/')
    })
  }
  
  /**
   * Listar templates disponibles desde una organización
   */
  async listOrganizationTemplates(org: string, topic: string = 'idp-template'): Promise<GitHubTemplateConfig[]> {
    try {
      // Buscar repositorios con un topic específico
      const { data } = await this.octokit.search.repos({
        q: `org:${org} topic:${topic}`,
        sort: 'updated',
        order: 'desc'
      })
      
      return data.items.map(repo => ({
        owner: repo.owner.login,
        repo: repo.name,
        branch: repo.default_branch
      }))
    } catch (error) {
      console.error(`Error listing templates from ${org}:`, error)
      return []
    }
  }
  
  /**
   * Validar que un repositorio es un template válido
   */
  async validateTemplate(config: GitHubTemplateConfig): Promise<boolean> {
    try {
      await this.fetchManifest(
        config.owner, 
        config.repo, 
        config.branch || 'main', 
        config.path || '.template.json'
      )
      return true
    } catch (error) {
      return false
    }
  }
}