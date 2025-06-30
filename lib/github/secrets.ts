import { Octokit } from "@octokit/rest"
import sodium from "libsodium-wrappers"

export interface GitHubSecretsConfig {
  secrets?: {
    ACCESS_TOKEN?: string
    USERNAME_GITHUB?: string
  }
  variables?: {
    AWS_ROLE?: string
    AWS_REGION?: string
    AWS_BACKEND?: string
    PROJECT_NAME?: string
  }
}

export class GitHubSecretsManager {
  private octokit: Octokit
  private owner: string
  private repo: string

  constructor(token: string, owner: string, repo: string) {
    this.octokit = new Octokit({ auth: token })
    this.owner = owner
    this.repo = repo
  }

  async configureSecretsAndVariables(config: GitHubSecretsConfig): Promise<void> {
    console.log(`Configuring GitHub secrets and variables for ${this.owner}/${this.repo}`)

    // Set secrets
    if (config.secrets) {
      for (const [name, value] of Object.entries(config.secrets)) {
        if (value) {
          await this.setSecret(name, value)
        }
      }
    }

    // Set variables
    if (config.variables) {
      for (const [name, value] of Object.entries(config.variables)) {
        if (value) {
          await this.setVariable(name, value)
        }
      }
    }
  }

  private async setSecret(secretName: string, secretValue: string): Promise<void> {
    try {
      // Get the repository public key
      const { data: publicKey } = await this.octokit.rest.actions.getRepoPublicKey({
        owner: this.owner,
        repo: this.repo
      })

      // Initialize libsodium
      await sodium.ready

      // Convert the public key from base64
      const publicKeyBytes = sodium.from_base64(
        publicKey.key,
        sodium.base64_variants.ORIGINAL
      )

      // Convert the secret value to bytes
      const secretBytes = sodium.from_string(secretValue)

      // Encrypt the secret using the public key
      const encryptedBytes = sodium.crypto_box_seal(secretBytes, publicKeyBytes)

      // Convert encrypted bytes to base64
      const encryptedValue = sodium.to_base64(
        encryptedBytes,
        sodium.base64_variants.ORIGINAL
      )

      // Create or update the secret
      await this.octokit.rest.actions.createOrUpdateRepoSecret({
        owner: this.owner,
        repo: this.repo,
        secret_name: secretName,
        encrypted_value: encryptedValue,
        key_id: publicKey.key_id
      })

      console.log(`Successfully set secret: ${secretName}`)
    } catch (error) {
      console.error(`Error setting secret ${secretName}:`, error)
      throw error
    }
  }

  private async setVariable(variableName: string, variableValue: string): Promise<void> {
    try {
      // Check if variable exists
      try {
        await this.octokit.rest.actions.getRepoVariable({
          owner: this.owner,
          repo: this.repo,
          name: variableName
        })

        // Update existing variable
        await this.octokit.rest.actions.updateRepoVariable({
          owner: this.owner,
          repo: this.repo,
          name: variableName,
          value: variableValue
        })
      } catch (error: any) {
        if (error.status === 404) {
          // Create new variable
          await this.octokit.rest.actions.createRepoVariable({
            owner: this.owner,
            repo: this.repo,
            name: variableName,
            value: variableValue
          })
        } else {
          throw error
        }
      }

      console.log(`Successfully set variable: ${variableName}`)
    } catch (error) {
      console.error(`Error setting variable ${variableName}:`, error)
      throw error
    }
  }

  static parseRepoUrl(githubUrl: string): { owner: string; repo: string } | null {
    const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/\?.]+)/)
    if (!match) {
      return null
    }

    return {
      owner: match[1],
      repo: match[2].replace('.git', '')
    }
  }
}