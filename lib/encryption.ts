import crypto from 'crypto'

const algorithm = 'aes-256-gcm'
const keyLength = 32
const ivLength = 16
const tagLength = 16
const saltLength = 64

// Get encryption key from environment
const getEncryptionKey = (): string => {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required')
  }
  return key
}

/**
 * Derives a key from a password using PBKDF2
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100000, keyLength, 'sha256')
}

/**
 * Encrypts a text string
 */
export function encrypt(text: string): string {
  if (!text) return ''
  
  try {
    // Generate a random salt
    const salt = crypto.randomBytes(saltLength)
    
    // Derive key from password
    const key = deriveKey(getEncryptionKey(), salt)
    
    // Generate a random IV
    const iv = crypto.randomBytes(ivLength)
    
    // Create cipher
    const cipher = crypto.createCipheriv(algorithm, key, iv)
    
    // Encrypt the text
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final()
    ])
    
    // Get the authentication tag
    const tag = cipher.getAuthTag()
    
    // Combine salt, iv, tag, and encrypted data
    const combined = Buffer.concat([salt, iv, tag, encrypted])
    
    // Return base64 encoded
    return combined.toString('base64')
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypts a text string
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return ''
  
  try {
    // Decode from base64
    const combined = Buffer.from(encryptedText, 'base64')
    
    // Extract components
    const salt = combined.slice(0, saltLength)
    const iv = combined.slice(saltLength, saltLength + ivLength)
    const tag = combined.slice(saltLength + ivLength, saltLength + ivLength + tagLength)
    const encrypted = combined.slice(saltLength + ivLength + tagLength)
    
    // Derive key from password
    const key = deriveKey(getEncryptionKey(), salt)
    
    // Create decipher
    const decipher = crypto.createDecipheriv(algorithm, key, iv)
    decipher.setAuthTag(tag)
    
    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ])
    
    return decrypted.toString('utf8')
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt data')
  }
}

/**
 * Checks if a string is encrypted
 */
export function isEncrypted(text: string): boolean {
  if (!text) return false
  
  try {
    // Try to decode from base64
    const buffer = Buffer.from(text, 'base64')
    
    // Check if buffer has the minimum required length
    // salt (64) + iv (16) + tag (16) + at least 1 byte of encrypted data = 97 bytes
    if (buffer.length < saltLength + ivLength + tagLength + 1) {
      return false
    }
    
    // Additional check: try to decrypt and see if it works
    // This is a more expensive check but more reliable
    try {
      decrypt(text)
      return true
    } catch {
      return false
    }
  } catch {
    return false
  }
}

/**
 * Safely decrypts a text string, returns the original if not encrypted
 */
export function safeDecrypt(text: string): string {
  if (!text) return ''
  
  // Check if the text is encrypted
  if (isEncrypted(text)) {
    try {
      return decrypt(text)
    } catch (error) {
      console.error('Failed to decrypt, returning original text:', error)
      return text
    }
  }
  
  // Return as-is if not encrypted
  return text
}

/**
 * Validates that encryption/decryption is working correctly
 */
export function validateEncryption(): boolean {
  try {
    const testString = 'test-encryption-validation'
    const encrypted = encrypt(testString)
    const decrypted = decrypt(encrypted)
    return decrypted === testString
  } catch (error) {
    console.error('Encryption validation failed:', error)
    return false
  }
}