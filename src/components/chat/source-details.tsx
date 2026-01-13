'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, BookOpen } from 'lucide-react'
import { ConfidenceBadge } from '@/components/ui/confidence-badge'
import type { ConfidenceLevel, WikiSource } from '@/lib/wiki/articles'

interface SourceDetailsProps {
  articleSlug: string
  articleTitle?: string
  confidenceLevel?: ConfidenceLevel
  consensusNote?: string
  sources?: WikiSource[]
  lastVerified?: string
}

export function SourceDetails({
  articleSlug,
  articleTitle,
  confidenceLevel,
  consensusNote,
  sources,
  lastVerified,
}: SourceDetailsProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="mt-2 rounded-lg border border-muted bg-muted/30 text-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/50"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {articleTitle || articleSlug}
          </span>
          {confidenceLevel && <ConfidenceBadge level={confidenceLevel} showLabel={false} />}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-muted px-3 py-2 space-y-3">
          {/* Confidence Level */}
          {confidenceLevel && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Evidence Level</div>
              <ConfidenceBadge level={confidenceLevel} />
            </div>
          )}

          {/* Consensus Note */}
          {consensusNote && (
            <div className="rounded bg-amber-50 dark:bg-amber-900/20 p-2 text-xs text-amber-800 dark:text-amber-200">
              <strong>Note:</strong> {consensusNote}
            </div>
          )}

          {/* Sources */}
          {sources && sources.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Sources ({sources.length})
              </div>
              <ul className="space-y-1">
                {sources.map((source, index) => (
                  <li key={index} className="flex items-start gap-1 text-xs">
                    <ExternalLink className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {source.title}
                      {source.author && (
                        <span className="text-muted-foreground"> — {source.author}</span>
                      )}
                      {source.year && (
                        <span className="text-muted-foreground"> ({source.year})</span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Last Verified */}
          {lastVerified && (
            <div className="text-xs text-muted-foreground">
              Last verified: {new Date(lastVerified).toLocaleDateString()}
            </div>
          )}

          {/* Link to full article */}
          <a
            href={`/learn/${articleSlug}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Read full article
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  )
}
