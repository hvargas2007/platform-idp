"use client"

import { ExternalLink } from "lucide-react"

interface ExternalLinkButtonProps {
  href: string
  className?: string
}

export function ExternalLinkButton({ href, className }: ExternalLinkButtonProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={(e) => e.stopPropagation()}
    >
      <ExternalLink className="h-4 w-4" />
    </a>
  )
}