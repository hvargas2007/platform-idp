import { Octokit } from "@octokit/rest"

export interface RepoCloneOptions {
  sourceOwner: string
  sourceRepo: string
  targetName: string
  targetDescription?: string
  isPrivate?: boolean
  includeBranches?: boolean
  sourceToken?: string // Token for accessing the source repository
  targetUsername?: string // Optional custom username for target repository
}

export class GitHubRepoCloner {
  private octokit: Octokit
  private sourceOctokit: Octokit
  
  constructor(token?: string, sourceToken?: string) {
    // Main octokit instance for creating the new repository
    this.octokit = new Octokit({ auth: token || process.env.GITHUB_TOKEN })
    // Source octokit instance for reading from the source repository
    this.sourceOctokit = sourceToken 
      ? new Octokit({ auth: sourceToken })
      : this.octokit
  }
  
  /**
   * Clone a repository using the Contents API (primary method)
   */
  async cloneAsTemplate(options: RepoCloneOptions) {
    try {
      // Try the Contents API approach first (more reliable)
      return await this.cloneUsingContentsAPI(options)
    } catch (error: any) {
      console.warn('Contents API approach failed, trying Git API fallback:', error.message)
      
      // Fall back to the Git API approach if Contents API fails
      try {
        return await this.cloneUsingGitAPI(options)
      } catch (fallbackError: any) {
        console.error('Both approaches failed')
        throw new Error(`Failed to clone repository using both methods. Last error: ${fallbackError.message}`)
      }
    }
  }

  /**
   * Clone using Contents API (primary approach - more reliable)
   * Files are created sequentially to avoid SHA conflicts that occur when
   * multiple files are created concurrently, causing stale SHA references.
   */
  private async cloneUsingContentsAPI(options: RepoCloneOptions) {
    const { 
      sourceOwner, 
      sourceRepo, 
      targetName, 
      targetDescription,
      isPrivate = false,
      includeBranches = false // Disable branches for Contents API approach for simplicity
    } = options
    
    console.log(`Cloning ${sourceOwner}/${sourceRepo} as ${targetName} using Contents API...`)
    
    // Validate authentication and get target owner
    let targetOwner: string
    try {
      const { data: authUser } = await this.octokit.users.getAuthenticated()
      targetOwner = options.targetUsername || authUser.login
      console.log(`Authenticated as: ${authUser.login}, target owner: ${targetOwner}`)
    } catch (error) {
      throw new Error('GitHub authentication failed. Please ensure you have a valid GitHub token.')
    }
    
    // 1. Get source repository information
    const { data: sourceRepoData } = await this.sourceOctokit.repos.get({
      owner: sourceOwner,
      repo: sourceRepo
    })
    
    // 2. Create new repository with auto_init to ensure it's not empty
    const { data: newRepo } = await this.octokit.repos.createForAuthenticatedUser({
      name: targetName,
      description: targetDescription || sourceRepoData.description || `Cloned from ${sourceOwner}/${sourceRepo}`,
      private: isPrivate,
      auto_init: true // Initialize with README to avoid empty repository issues
    })
    
    console.log(`Created repository: ${newRepo.html_url}`)
    
    // Wait for repository to be fully initialized
    console.log('Waiting for repository to be fully initialized...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // 3. Get default branch
    const defaultBranch = sourceRepoData.default_branch || 'main'
    
    // 4. Get all files from source repository
    const files = await this.getAllFiles(sourceOwner, sourceRepo, defaultBranch)
    
    if (files.length === 0) {
      console.warn(`Source repository ${sourceOwner}/${sourceRepo} appears to be empty`)
      return {
        success: true,
        repository: newRepo,
        filesCount: 0,
        message: `Successfully created repository ${targetName} (source was empty)`
      }
    }
    
    // 5. Create files using Contents API
    console.log(`Creating ${files.length} files using Contents API...`)
    
    // Remove the auto-generated README.md first if it exists and we have files to replace it
    if (files.some(f => f.path === 'README.md')) {
      try {
        const { data: existingReadme } = await this.octokit.repos.getContent({
          owner: targetOwner,
          repo: targetName,
          path: 'README.md'
        })
        
        if ('sha' in existingReadme) {
          await this.octokit.repos.deleteFile({
            owner: targetOwner,
            repo: targetName,
            path: 'README.md',
            message: 'Remove auto-generated README',
            sha: existingReadme.sha
          })
          console.log('Removed auto-generated README.md')
        }
      } catch (error) {
        // Ignore errors if README doesn't exist
        console.log('No existing README to remove')
      }
    }
    
    // Create files sequentially to avoid SHA conflicts
    let createdFiles = 0
    
    for (const file of files) {
      try {
        await this.octokit.repos.createOrUpdateFileContents({
          owner: targetOwner,
          repo: targetName,
          path: file.path,
          message: `Add ${file.path}`,
          content: Buffer.from(file.content).toString('base64'),
          committer: {
            name: 'GitHub Repo Cloner',
            email: 'noreply@github.com'
          }
        })
        createdFiles++
        console.log(`Created: ${file.path}`)
        
        // Add a small delay between each file to avoid rate limiting and SHA conflicts
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error: any) {
        // If it's a SHA conflict, the repository state has changed - this shouldn't happen 
        // with sequential processing, but we'll handle it gracefully
        if (error.message?.includes('sha') || error.status === 409) {
          console.warn(`SHA conflict detected for ${file.path}, retrying...`)
          
          // Wait a bit longer and retry once
          await new Promise(resolve => setTimeout(resolve, 1000))
          try {
            await this.octokit.repos.createOrUpdateFileContents({
              owner: targetOwner,
              repo: targetName,
              path: file.path,
              message: `Add ${file.path}`,
              content: Buffer.from(file.content).toString('base64'),
              committer: {
                name: 'GitHub Repo Cloner',
                email: 'noreply@github.com'
              }
            })
            createdFiles++
            console.log(`Created: ${file.path} (after retry)`)
          } catch (retryError: any) {
            console.error(`Failed to create ${file.path} after retry:`, retryError.message)
            // Continue with other files rather than failing completely
          }
        } else {
          console.error(`Failed to create ${file.path}:`, error.message)
          // Continue with other files rather than failing completely
        }
      }
    }
    
    // 6. Copy branch protection if possible
    try {
      const { data: protectionRules } = await this.sourceOctokit.repos.getBranchProtection({
        owner: sourceOwner,
        repo: sourceRepo,
        branch: defaultBranch
      })
      
      // Simplify protection rules to avoid type conflicts
      const simplifiedReviews = protectionRules.required_pull_request_reviews ? {
        dismiss_stale_reviews: protectionRules.required_pull_request_reviews.dismiss_stale_reviews || false,
        require_code_owner_reviews: protectionRules.required_pull_request_reviews.require_code_owner_reviews || false,
        required_approving_review_count: protectionRules.required_pull_request_reviews.required_approving_review_count || 1
      } : null
      
      await this.octokit.repos.updateBranchProtection({
        owner: targetOwner,
        repo: targetName,
        branch: defaultBranch,
        required_status_checks: null,
        enforce_admins: false,
        required_pull_request_reviews: simplifiedReviews,
        restrictions: null,
        allow_force_pushes: false,
        allow_deletions: false
      })
      
      console.log(`Applied branch protection to ${defaultBranch}`)
    } catch (error) {
      console.log("Could not copy branch protection rules")
    }
    
    return {
      success: true,
      repository: newRepo,
      filesCount: createdFiles,
      message: `Successfully cloned ${sourceOwner}/${sourceRepo} to ${targetName} using Contents API`
    }
  }

  /**
   * Clone using Git API (fallback method)
   */
  private async cloneUsingGitAPI(options: RepoCloneOptions) {
    const { 
      sourceOwner, 
      sourceRepo, 
      targetName, 
      targetDescription,
      isPrivate = false,
      includeBranches = true 
    } = options
    
    console.log(`Cloning ${sourceOwner}/${sourceRepo} as ${targetName} using Git API...`)
    
    // Validate authentication and get target owner
    let targetOwner: string
    try {
      const { data: authUser } = await this.octokit.users.getAuthenticated()
      targetOwner = options.targetUsername || authUser.login
      console.log(`Authenticated as: ${authUser.login}, target owner: ${targetOwner}`)
    } catch (error) {
      throw new Error('GitHub authentication failed. Please ensure you have a valid GitHub token.')
    }
    
    // 1. Get source repository information
    const { data: sourceRepoData } = await this.sourceOctokit.repos.get({
      owner: sourceOwner,
      repo: sourceRepo
    })
    
    // 2. Create new repository with auto_init to avoid empty repo issues
    const { data: newRepo } = await this.octokit.repos.createForAuthenticatedUser({
      name: targetName,
      description: targetDescription || sourceRepoData.description || `Cloned from ${sourceOwner}/${sourceRepo}`,
      private: isPrivate,
      auto_init: true // Initialize with README to have a base commit
    })
    
    console.log(`Created repository: ${newRepo.html_url}`)
    
    // Wait for repository to be fully initialized
    console.log('Waiting for repository to be fully initialized...')
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Verify repository is accessible with retries
    let repoReady = false
    for (let i = 0; i < 5; i++) {
      try {
        await this.octokit.repos.get({
          owner: targetOwner,
          repo: targetName
        })
        repoReady = true
        console.log('Repository is ready')
        break
      } catch (error) {
        console.log(`Repository not ready yet, attempt ${i + 1}/5`)
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    if (!repoReady) {
      throw new Error('Repository creation timed out. Please try again.')
    }
    
    // 3. Get default branch
    const defaultBranch = sourceRepoData.default_branch || 'main'
    
    // 4. Get all files from source repository
    const files = await this.getAllFiles(sourceOwner, sourceRepo, defaultBranch)
    
    // Check if source repository is empty
    if (files.length === 0) {
      console.warn(`Source repository ${sourceOwner}/${sourceRepo} appears to be empty`)
      return {
        success: true,
        repository: newRepo,
        filesCount: 0,
        message: `Successfully created repository ${targetName} (source was empty)`
      }
    }
    
    // 5. Get the current HEAD commit to use as parent
    let parentSha: string | undefined
    let baseTreeSha: string | undefined
    try {
      const { data: ref } = await this.octokit.git.getRef({
        owner: targetOwner,
        repo: targetName,
        ref: `heads/${defaultBranch}`
      })
      parentSha = ref.object.sha
      
      // Get the tree SHA from the parent commit
      const { data: parentCommit } = await this.octokit.git.getCommit({
        owner: targetOwner,
        repo: targetName,
        commit_sha: parentSha
      })
      baseTreeSha = parentCommit.tree.sha
    } catch (error) {
      console.log('No existing HEAD found, creating initial commit')
    }
    
    // Create all files in the new repo
    console.log(`Copying ${files.length} files using Git API...`)
    
    const tree = await this.createTree(targetOwner, targetName, files, baseTreeSha)
    const commit = await this.createCommit(
      targetOwner, 
      targetName, 
      tree.sha, 
      `Initial commit - Cloned from ${sourceOwner}/${sourceRepo}`,
      parentSha ? [parentSha] : []
    )
    
    // Update the main branch reference
    await this.octokit.git.updateRef({
      owner: targetOwner,
      repo: targetName,
      ref: `heads/${defaultBranch}`,
      sha: commit.sha,
      force: true
    })
    
    // 6. Copy other branches if requested
    if (includeBranches) {
      const branches = await this.getBranches(sourceOwner, sourceRepo)
      
      for (const branch of branches) {
        if (branch.name !== defaultBranch) {
          try {
            const branchFiles = await this.getAllFiles(sourceOwner, sourceRepo, branch.name)
            const branchTree = await this.createTree(targetOwner, targetName, branchFiles)
            const branchCommit = await this.createCommit(
              targetOwner,
              targetName,
              branchTree.sha,
              `Branch ${branch.name} - Cloned from ${sourceOwner}/${sourceRepo}`,
              [commit.sha]
            )
            
            await this.octokit.git.createRef({
              owner: targetOwner,
              repo: targetName,
              ref: `refs/heads/${branch.name}`,
              sha: branchCommit.sha
            })
            
            console.log(`Created branch: ${branch.name}`)
          } catch (error) {
            console.error(`Error creating branch ${branch.name}:`, error)
          }
        }
      }
    }
    
    // 7. Copy branch protection if possible
    try {
      const { data: protectionRules } = await this.sourceOctokit.repos.getBranchProtection({
        owner: sourceOwner,
        repo: sourceRepo,
        branch: defaultBranch
      })
      
      // Simplify protection rules to avoid type conflicts
      const simplifiedReviews = protectionRules.required_pull_request_reviews ? {
        dismiss_stale_reviews: protectionRules.required_pull_request_reviews.dismiss_stale_reviews || false,
        require_code_owner_reviews: protectionRules.required_pull_request_reviews.require_code_owner_reviews || false,
        required_approving_review_count: protectionRules.required_pull_request_reviews.required_approving_review_count || 1
      } : null
      
      await this.octokit.repos.updateBranchProtection({
        owner: targetOwner,
        repo: targetName,
        branch: defaultBranch,
        required_status_checks: null,
        enforce_admins: false,
        required_pull_request_reviews: simplifiedReviews,
        restrictions: null,
        allow_force_pushes: false,
        allow_deletions: false
      })
      
      console.log(`Applied branch protection to ${defaultBranch}`)
    } catch (error) {
      console.log("Could not copy branch protection rules")
    }
    
    return {
      success: true,
      repository: newRepo,
      filesCount: files.length,
      message: `Successfully cloned ${sourceOwner}/${sourceRepo} to ${targetName} using Git API`
    }
  }
  
  /**
   * Obtener todos los archivos de un repositorio
   */
  private async getAllFiles(owner: string, repo: string, ref: string) {
    const files: Array<{ path: string; content: string }> = []
    
    try {
      // First, try to get the commit to ensure the ref exists
      let commitSha: string
      try {
        const { data: refData } = await this.sourceOctokit.git.getRef({
          owner,
          repo,
          ref: `heads/${ref}`
        })
        commitSha = refData.object.sha
      } catch (error) {
        // If ref not found, try to get it as a commit SHA directly
        try {
          const { data: commit } = await this.sourceOctokit.git.getCommit({
            owner,
            repo,
            commit_sha: ref
          })
          commitSha = commit.sha
        } catch {
          console.error(`Reference ${ref} not found in ${owner}/${repo}`)
          return []
        }
      }
      
      // Obtener el árbol de archivos
      const { data: tree } = await this.sourceOctokit.git.getTree({
        owner,
        repo,
        tree_sha: commitSha,
        recursive: 'true'
      })
      
      // Filtrar solo archivos (no directorios)
      const blobs = tree.tree.filter(item => item.type === 'blob')
      
      // Batch process files to avoid rate limiting
      const batchSize = 5 // Reduced batch size for better reliability
      for (let i = 0; i < blobs.length; i += batchSize) {
        const batch = blobs.slice(i, i + batchSize)
        await Promise.all(
          batch.map(async (item) => {
            if (item.sha && item.path) {
              try {
                const { data: blob } = await this.sourceOctokit.git.getBlob({
                  owner,
                  repo,
                  file_sha: item.sha
                })
                
                // Decodificar contenido
                const content = blob.encoding === 'base64' 
                  ? Buffer.from(blob.content, 'base64').toString('utf-8')
                  : blob.content
                
                files.push({
                  path: item.path,
                  content
                })
              } catch (error: any) {
                console.error(`Error fetching ${item.path}:`, error.message)
                // Skip binary files or files that can't be decoded
                if (error.message?.includes('is not valid UTF-8')) {
                  console.log(`Skipping binary file: ${item.path}`)
                }
                // Continue with other files
              }
            }
          })
        )
        
        // Add delay between batches to avoid rate limiting
        if (i + batchSize < blobs.length) {
          await new Promise(resolve => setTimeout(resolve, 300))
        }
      }
      
      return files
    } catch (error: any) {
      console.error("Error getting files:", error.message)
      // Check if it's an empty repository error
      if (error.status === 409 && error.message?.includes('Git Repository is empty')) {
        console.log('Repository is empty, returning empty file list')
        return []
      }
      throw error
    }
  }
  
  /**
   * Obtener lista de branches
   */
  private async getBranches(owner: string, repo: string) {
    try {
      const { data: branches } = await this.sourceOctokit.repos.listBranches({
        owner,
        repo,
        per_page: 100
      })
      
      return branches
    } catch (error) {
      console.error("Error getting branches:", error)
      return []
    }
  }
  
  /**
   * Crear un tree con todos los archivos
   */
  private async createTree(owner: string, repo: string, files: Array<{ path: string; content: string }>, baseTree?: string) {
    // Wait a bit before creating blobs to ensure repository is ready
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Helper function to create blob with retry
    const createBlobWithRetry = async (file: { path: string; content: string }, retries = 3): Promise<string> => {
      for (let i = 0; i < retries; i++) {
        try {
          const { data: blob } = await this.octokit.git.createBlob({
            owner,
            repo,
            content: Buffer.from(file.content).toString('base64'),
            encoding: 'base64'
          })
          return blob.sha
        } catch (error: any) {
          if (i === retries - 1) {
            console.error(`Failed to create blob for ${file.path}:`, error.message)
            throw error
          }
          console.log(`Retry ${i + 1} for creating blob ${file.path} (${error.status || 'unknown error'})`)
          await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)))
        }
      }
      throw new Error(`Failed to create blob for ${file.path}`)
    }
    
    // Crear blobs para cada archivo con reintentos
    // Process in smaller batches to avoid rate limiting
    const batchSize = 5
    const tree: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string }> = []
    
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map(async (file) => {
          const sha = await createBlobWithRetry(file)
          return {
            path: file.path,
            mode: '100644' as const,
            type: 'blob' as const,
            sha
          }
        })
      )
      tree.push(...batchResults)
      
      // Add a small delay between batches
      if (i + batchSize < files.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    // Create the tree with optional base tree
    const createTreeOptions: any = {
      owner,
      repo,
      tree
    }
    
    if (baseTree) {
      createTreeOptions.base_tree = baseTree
    }
    
    try {
      const { data: treeData } = await this.octokit.git.createTree(createTreeOptions)
      return treeData
    } catch (error: any) {
      console.error('Error creating tree:', error.message)
      if (error.status === 404 && baseTree) {
        // If the base tree is not found, it might be invalid or deleted
        throw new Error(`Base tree SHA ${baseTree} not found. The repository state may have changed.`)
      }
      throw error
    }
  }
  
  /**
   * Crear un commit
   */
  private async createCommit(owner: string, repo: string, treeSha: string, message: string, parents: string[] = []) {
    const { data: commit } = await this.octokit.git.createCommit({
      owner,
      repo,
      message,
      tree: treeSha,
      parents
    })
    
    return commit
  }

  /**
   * Sync an existing repository with updates from a template
   * This method reuses the proven logic from cloneAsTemplate but updates an existing repo
   */
  async syncWithTemplate(options: {
    sourceOwner: string
    sourceRepo: string
    targetOwner: string
    targetRepo: string
    targetBranch?: string // Branch to update (if not provided, creates a sync branch)
    createPullRequest?: boolean
    sourceToken?: string
    commitMessage?: string
    directToMain?: boolean // If true, syncs directly to the default branch
  }) {
    const {
      sourceOwner,
      sourceRepo,
      targetOwner,
      targetRepo,
      targetBranch,
      createPullRequest = true,
      sourceToken,
      commitMessage,
      directToMain = false
    } = options

    console.log(`Syncing ${targetOwner}/${targetRepo} with template ${sourceOwner}/${sourceRepo}...`)

    // Use source token if provided for private templates
    const sourceOctokit = sourceToken 
      ? new Octokit({ auth: sourceToken })
      : this.sourceOctokit

    try {
      // 1. Get target repository information
      const { data: targetRepoData } = await this.octokit.repos.get({
        owner: targetOwner,
        repo: targetRepo
      })
      const defaultBranch = targetRepoData.default_branch || 'main'

      // 2. Get source repository information
      const { data: sourceRepoData } = await sourceOctokit.repos.get({
        owner: sourceOwner,
        repo: sourceRepo
      })

      // 3. Get latest template commit SHA
      const { data: templateCommits } = await sourceOctokit.repos.listCommits({
        owner: sourceOwner,
        repo: sourceRepo,
        sha: sourceRepoData.default_branch || 'main',
        per_page: 1
      })
      
      const latestTemplateCommit = templateCommits[0]
      if (!latestTemplateCommit) {
        throw new Error('No commits found in template repository')
      }

      // 4. Determine target branch name
      let syncBranchName: string
      if (directToMain) {
        syncBranchName = defaultBranch
      } else if (targetBranch) {
        syncBranchName = targetBranch
      } else {
        // Create a unique branch name for the sync
        const now = new Date()
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
        syncBranchName = `sync-template-${timestamp}`
      }

      // 5. Get all files from template repository
      const files = await this.getAllFiles(sourceOwner, sourceRepo, sourceRepoData.default_branch || 'main')
      
      if (files.length === 0) {
        return {
          success: true,
          filesCount: 0,
          message: 'Template repository is empty, nothing to sync'
        }
      }

      console.log(`Found ${files.length} files in template repository`)

      // 6. Create or checkout the sync branch
      const { data: defaultBranchRef } = await this.octokit.git.getRef({
        owner: targetOwner,
        repo: targetRepo,
        ref: `heads/${defaultBranch}`
      })

      // Check if branch exists
      let branchExists = false
      try {
        await this.octokit.git.getRef({
          owner: targetOwner,
          repo: targetRepo,
          ref: `heads/${syncBranchName}`
        })
        branchExists = true
      } catch (error: any) {
        if (error.status !== 404) throw error
      }

      if (!branchExists && syncBranchName !== defaultBranch) {
        // Create new branch from default branch
        await this.octokit.git.createRef({
          owner: targetOwner,
          repo: targetRepo,
          ref: `refs/heads/${syncBranchName}`,
          sha: defaultBranchRef.object.sha
        })
        console.log(`Created sync branch: ${syncBranchName}`)
        
        // Wait a moment for the branch to be fully created
        await new Promise(resolve => setTimeout(resolve, 1000))
      } else if (syncBranchName === defaultBranch) {
        console.log(`Syncing directly to ${defaultBranch} branch`)
      }

      // 7. Get the current commit of the sync branch
      let branchRef: any
      let currentCommit: any
      
      try {
        // Get the branch reference
        const { data: ref } = await this.octokit.git.getRef({
          owner: targetOwner,
          repo: targetRepo,
          ref: `heads/${syncBranchName}`
        })
        branchRef = ref

        // Get the commit details
        const { data: commit } = await this.octokit.git.getCommit({
          owner: targetOwner,
          repo: targetRepo,
          commit_sha: ref.object.sha
        })
        currentCommit = commit
      } catch (error: any) {
        console.error(`Error getting branch reference for ${syncBranchName}:`, error.message)
        throw new Error(`Failed to get current state of branch ${syncBranchName}`)
      }

      // 8. Filter files to sync (exclude certain files)
      const filesToSync = files.filter(file => {
        const skipPatterns = [
          /^\.git\//,
          /^node_modules\//,
          /^\.env/,
          /^README\.md$/i,
          /^LICENSE$/i,
        ]
        return !skipPatterns.some(pattern => pattern.test(file.path))
      })

      console.log(`Syncing ${filesToSync.length} files (excluded ${files.length - filesToSync.length} files)`)

      // 9. Create tree with all files from template
      console.log(`Creating tree with ${filesToSync.length} files...`)
      
      // Try to use the current tree as base, but fall back to creating a new tree if it fails
      let tree: any
      try {
        tree = await this.createTree(targetOwner, targetRepo, filesToSync, currentCommit.tree.sha)
      } catch (error: any) {
        console.warn('Failed to create tree with base tree, trying without base tree:', error.message)
        // If creating with base tree fails, create a new tree without base
        tree = await this.createTree(targetOwner, targetRepo, filesToSync)
      }
      
      // 10. Create commit with the new tree
      const commit = await this.createCommit(
        targetOwner,
        targetRepo,
        tree.sha,
        commitMessage || `Sync with template ${sourceOwner}/${sourceRepo}

template-sha: ${latestTemplateCommit.sha}`,
        [branchRef.object.sha]
      )

      // 11. Update the branch reference
      await this.octokit.git.updateRef({
        owner: targetOwner,
        repo: targetRepo,
        ref: `heads/${syncBranchName}`,
        sha: commit.sha
      })

      console.log(`Successfully updated branch ${syncBranchName} with template changes`)

      // 12. Create pull request if requested and not updating default branch
      let pullRequestUrl: string | undefined
      if (createPullRequest && syncBranchName !== defaultBranch) {
        try {
          const { data: pr } = await this.octokit.pulls.create({
            owner: targetOwner,
            repo: targetRepo,
            title: `[sync-template] Update from ${sourceOwner}/${sourceRepo}`,
            body: `This pull request syncs your project with the latest changes from the template repository.

## Template Information
- **Template**: ${sourceOwner}/${sourceRepo}
- **Template Commit**: ${latestTemplateCommit.sha}
- **Files Updated**: ${filesToSync.length}

## Latest Template Commit
- **Message**: ${latestTemplateCommit.commit.message}
- **Author**: ${latestTemplateCommit.commit.author?.name || 'Unknown'}
- **Date**: ${latestTemplateCommit.commit.author?.date || 'Unknown'}

## Review Guidelines
Please review the changes carefully before merging:
1. Check for any conflicts with your local modifications
2. Ensure the updates don't break your existing functionality
3. Test the changes in a development environment if possible

<!-- template-sha: ${latestTemplateCommit.sha} -->`,
            head: syncBranchName,
            base: defaultBranch
          })

          pullRequestUrl = pr.html_url
          console.log(`Created pull request: ${pullRequestUrl}`)
        } catch (error) {
          console.error('Error creating pull request:', error)
        }
      }

      return {
        success: true,
        filesCount: filesToSync.length,
        syncBranch: syncBranchName,
        pullRequestUrl,
        message: `Successfully synced with template ${sourceOwner}/${sourceRepo}`
      }

    } catch (error: any) {
      console.error('Error syncing with template:', error)
      throw new Error(`Failed to sync with template: ${error.message}`)
    }
  }
}