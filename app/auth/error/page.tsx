"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"

export default function AuthError() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  const errorMessages: Record<string, string> = {
    Configuration: "There is a problem with the server configuration.",
    AccessDenied: "You do not have permission to sign in.",
    Verification: "The sign in link is no longer valid.",
    OAuthSignin: "Error in constructing an authorization URL.",
    OAuthCallback: "Error in handling the response from OAuth provider.",
    OAuthCreateAccount: "Could not create OAuth provider user in the database.",
    EmailCreateAccount: "Could not create email provider user in the database.",
    Callback: "Error in the OAuth callback handler route.",
    OAuthAccountNotLinked: "This account is already linked with another user.",
    EmailSignin: "Check your email for the magic link.",
    CredentialsSignin: "Sign in failed. Check the details you provided are correct.",
    Default: "Unable to sign in.",
  }

  const errorMessage = error ? errorMessages[error] || errorMessages.Default : errorMessages.Default

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Authentication Error</h2>
          <p className="mt-2 text-sm text-gray-600">
            {errorMessage}
          </p>
          {error === "Configuration" && (
            <p className="mt-2 text-xs text-gray-500">
              Check your environment variables and database connection.
            </p>
          )}
          <Link 
            href="/auth/signin" 
            className="mt-4 inline-block text-blue-600 hover:text-blue-500"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}