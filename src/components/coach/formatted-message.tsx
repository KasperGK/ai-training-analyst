'use client'

/**
 * FormattedMessage Component
 *
 * Enhanced text formatting for AI Coach messages with:
 * - Metric highlighting (numbers + units)
 * - Collapsible sections (:::collapse Title ... :::)
 * - Section headers (## or ###)
 */

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface FormattedMessageProps {
  text: string
  className?: string
}

/**
 * Regex for metric values with units
 * Matches: 285 TSS, 150 bpm, 300 W, 75.5 kg, 0.95 IF, etc.
 */
const METRIC_PATTERN = /(\d+(?:\.\d+)?)\s*(W|bpm|kg|%|TSS|CTL|ATL|TSB|FTP|IF|NP|rpm|kJ|m|km|hr|min|s)\b/g

/**
 * Regex for collapsible sections
 * Matches: :::collapse Title\ncontent\n:::
 */
const COLLAPSE_PATTERN = /:::collapse\s+(.+?)\n([\s\S]*?):::/g

/**
 * Parse and highlight metric values
 */
function formatMetrics(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  const regex = new RegExp(METRIC_PATTERN.source, 'g')
  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    // Add highlighted metric with badge-like styling
    const [, value, unit] = match
    parts.push(
      <span
        key={match.index}
        className="inline-flex items-baseline px-1 py-0.5 mx-0.5 rounded bg-primary/10 text-primary"
      >
        <span className="font-semibold">{value}</span>
        <span className="text-primary/70 text-[0.85em] ml-0.5">{unit}</span>
      </span>
    )

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : [text]
}

/**
 * Collapsible section component
 */
function CollapsibleSection({
  title,
  content,
}: {
  title: string
  content: string
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="my-2 border rounded-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
        {title}
      </button>
      {isOpen && (
        <div className="px-3 pb-3 pt-1 text-sm">
          <FormattedParagraph text={content} />
        </div>
      )}
    </div>
  )
}

/**
 * Format a single paragraph with metrics
 */
function FormattedParagraph({ text }: { text: string }) {
  const formatted = useMemo(() => formatMetrics(text), [text])
  return <>{formatted}</>
}

/**
 * Parse content into blocks (headers, paragraphs, lists, collapsibles)
 */
function parseBlocks(text: string): React.ReactNode[] {
  // Remove canvas commands
  const cleanText = text.replace(/\[CANVAS:[^\]]+\]/g, '').trim()
  if (!cleanText) return []

  const blocks: React.ReactNode[] = []
  let blockKey = 0

  // First, extract collapsible sections
  const collapseMatches: Array<{ start: number; end: number; title: string; content: string }> = []
  let match: RegExpExecArray | null
  const collapseRegex = new RegExp(COLLAPSE_PATTERN.source, 'g')

  while ((match = collapseRegex.exec(cleanText)) !== null) {
    collapseMatches.push({
      start: match.index,
      end: match.index + match[0].length,
      title: match[1].trim(),
      content: match[2].trim(),
    })
  }

  // Process text, inserting collapsibles at their positions
  let lastEnd = 0
  for (const collapse of collapseMatches) {
    // Process text before this collapsible
    if (collapse.start > lastEnd) {
      const textBefore = cleanText.slice(lastEnd, collapse.start)
      blocks.push(...parseTextBlocks(textBefore, blockKey))
      blockKey += 100 // Ensure unique keys
    }

    // Add collapsible
    blocks.push(
      <CollapsibleSection
        key={`collapse-${blockKey++}`}
        title={collapse.title}
        content={collapse.content}
      />
    )

    lastEnd = collapse.end
  }

  // Process remaining text
  if (lastEnd < cleanText.length) {
    const remaining = cleanText.slice(lastEnd)
    blocks.push(...parseTextBlocks(remaining, blockKey))
  }

  return blocks
}

/**
 * Parse text into blocks (no collapsibles)
 */
function parseTextBlocks(text: string, startKey: number): React.ReactNode[] {
  const blocks: React.ReactNode[] = []
  let blockKey = startKey

  // Split by double newlines (paragraphs)
  const paragraphs = text.split(/\n\n+/)

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue

    // Check for headers
    if (trimmed.startsWith('### ')) {
      blocks.push(
        <h4 key={blockKey++} className="font-semibold text-sm mt-3 mb-1">
          <FormattedParagraph text={trimmed.slice(4)} />
        </h4>
      )
      continue
    }

    if (trimmed.startsWith('## ')) {
      blocks.push(
        <h3 key={blockKey++} className="font-semibold mt-3 mb-1">
          <FormattedParagraph text={trimmed.slice(3)} />
        </h3>
      )
      continue
    }

    // Check for lists
    const lines = trimmed.split('\n')
    const isNumberedList = lines.every(l => /^\d+\.\s/.test(l.trim()) || l.trim() === '')
    const isBulletList = lines.every(l => /^[-*]\s/.test(l.trim()) || l.trim() === '')

    if (isNumberedList || isBulletList) {
      blocks.push(
        <ul
          key={blockKey++}
          className={cn(
            'space-y-1 pl-4',
            isNumberedList ? 'list-decimal' : 'list-disc'
          )}
        >
          {lines
            .filter(l => l.trim())
            .map((line, lIdx) => (
              <li key={lIdx} className="text-sm leading-relaxed">
                <FormattedParagraph text={line.replace(/^(\d+\.|-|\*)\s*/, '')} />
              </li>
            ))}
        </ul>
      )
      continue
    }

    // Regular paragraph
    blocks.push(
      <p key={blockKey++} className="text-sm leading-relaxed">
        <FormattedParagraph text={trimmed.replace(/\n/g, ' ')} />
      </p>
    )
  }

  return blocks
}

export function FormattedMessage({ text, className }: FormattedMessageProps) {
  const blocks = useMemo(() => parseBlocks(text), [text])

  if (blocks.length === 0) return null

  return <div className={cn('space-y-2', className)}>{blocks}</div>
}
