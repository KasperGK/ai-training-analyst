'use client'

/**
 * FormattedMessage Component
 *
 * Enhanced text formatting for AI Coach messages with:
 * - Metric highlighting (numbers + units)
 * - Term tooltips (FTP, TSS, CTL, etc.)
 * - Collapsible sections (:::collapse Title ... :::)
 * - Section headers (## or ###)
 */

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { TermTooltip } from './term-tooltip'
import { TERM_PATTERN, CYCLING_TERMS } from '@/lib/cycling-terms'

interface FormattedMessageProps {
  text: string
  className?: string
}

/**
 * Regex for metric values with units
 * Matches: 285 TSS, 150 bpm, 300 W, 75.5 kg, 0.95 IF, etc.
 * Uses word boundary or whitespace at start to avoid matching "v2", dates like "2024", etc.
 */
const METRIC_PATTERN = /(?:^|[\s(])(\d+(?:\.\d+)?)\s*(W|bpm|kg|%|TSS|CTL|ATL|TSB|FTP|IF|NP|rpm|kJ|km|hr|min|s)\b/g

/**
 * Regex for URLs
 * Matches http:// and https:// URLs
 */
const URL_PATTERN = /https?:\/\/[^\s<>[\]{}|\\^`"']+/g

/**
 * Regex for collapsible sections
 * Matches: :::collapse Title\ncontent\n:::
 */
const COLLAPSE_PATTERN = /:::collapse\s+(.+?)\n([\s\S]*?):::/g

/**
 * Regex patterns for inline styles
 * Bold: **text** (non-greedy)
 * Italic: *text* (single asterisks, after bold is processed)
 */
const BOLD_PATTERN = /\*\*(.+?)\*\*/g
const ITALIC_PATTERN = /\*([^*]+)\*/g

/**
 * Parse and highlight metric values and URLs
 */
function formatMetricsAndUrls(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let remaining = text
  let keyIndex = 0

  // First pass: extract URLs and create segments
  const urlRegex = new RegExp(URL_PATTERN.source, 'g')
  const segments: { type: 'text' | 'url'; content: string }[] = []
  let lastUrlEnd = 0
  let urlMatch: RegExpExecArray | null

  while ((urlMatch = urlRegex.exec(text)) !== null) {
    // Add text before URL
    if (urlMatch.index > lastUrlEnd) {
      segments.push({ type: 'text', content: text.slice(lastUrlEnd, urlMatch.index) })
    }
    // Add URL
    segments.push({ type: 'url', content: urlMatch[0] })
    lastUrlEnd = urlMatch.index + urlMatch[0].length
  }

  // Add remaining text after last URL
  if (lastUrlEnd < text.length) {
    segments.push({ type: 'text', content: text.slice(lastUrlEnd) })
  }

  // If no URLs found, just process text
  if (segments.length === 0) {
    segments.push({ type: 'text', content: text })
  }

  // Second pass: process each segment
  for (const segment of segments) {
    if (segment.type === 'url') {
      // Render URL as link
      parts.push(
        <a
          key={`url-${keyIndex++}`}
          href={segment.content}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:text-primary/80 break-all"
        >
          {segment.content}
        </a>
      )
    } else {
      // Process text for metrics
      const metricParts = formatMetrics(segment.content, keyIndex)
      parts.push(...metricParts)
      keyIndex += metricParts.length
    }
  }

  return parts.length > 0 ? parts : [text]
}

/**
 * Parse and highlight metric values, then add term tooltips to remaining text
 */
function formatMetrics(text: string, startKey: number = 0): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let keyIndex = startKey

  const regex = new RegExp(METRIC_PATTERN.source, 'g')
  while ((match = regex.exec(text)) !== null) {
    // The full match includes the leading whitespace/boundary, extract just the number+unit
    const fullMatch = match[0]
    const leadingChar = fullMatch.match(/^[\s(]/) ? fullMatch[0] : ''
    const value = match[1]
    const unit = match[2]

    // Add text before match (including any leading char that was part of the pattern)
    // Process this text for term tooltips
    const textBeforeMatch = text.slice(lastIndex, match.index) + leadingChar
    if (textBeforeMatch) {
      const termParts = formatTerms(textBeforeMatch, keyIndex)
      parts.push(...termParts)
      keyIndex += termParts.length
    }

    // Add highlighted metric with badge-like styling
    // The unit gets a tooltip if it's a known term
    const termDef = CYCLING_TERMS[unit]
    parts.push(
      <span
        key={`metric-${keyIndex++}`}
        className="inline-flex items-baseline px-1 py-0.5 mx-0.5 rounded bg-primary/10 text-primary"
      >
        <span className="font-semibold">{value}</span>
        {termDef ? (
          <TermTooltip term={unit}>
            <span className="text-primary/70 text-[0.85em] ml-0.5 cursor-help border-b border-dotted border-primary/30">{unit}</span>
          </TermTooltip>
        ) : (
          <span className="text-primary/70 text-[0.85em] ml-0.5">{unit}</span>
        )}
      </span>
    )

    lastIndex = match.index + match[0].length
  }

  // Add remaining text with term tooltips
  if (lastIndex < text.length) {
    const termParts = formatTerms(text.slice(lastIndex), keyIndex)
    parts.push(...termParts)
  }

  return parts.length > 0 ? parts : [text]
}

/**
 * Parse bold and italic markdown
 * Processes **bold** first, then *italic* on remaining text
 */
function formatInlineStyles(text: string, startKey: number = 0): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let keyIndex = startKey

  // Process bold first (**text**)
  const boldRegex = new RegExp(BOLD_PATTERN.source, 'g')
  let lastBoldIndex = 0
  let boldMatch: RegExpExecArray | null
  const boldSegments: { type: 'text' | 'bold'; content: string }[] = []

  while ((boldMatch = boldRegex.exec(text)) !== null) {
    if (boldMatch.index > lastBoldIndex) {
      boldSegments.push({ type: 'text', content: text.slice(lastBoldIndex, boldMatch.index) })
    }
    boldSegments.push({ type: 'bold', content: boldMatch[1] })
    lastBoldIndex = boldMatch.index + boldMatch[0].length
  }

  if (lastBoldIndex < text.length) {
    boldSegments.push({ type: 'text', content: text.slice(lastBoldIndex) })
  }

  if (boldSegments.length === 0) {
    boldSegments.push({ type: 'text', content: text })
  }

  // Process each segment for italic
  for (const segment of boldSegments) {
    if (segment.type === 'bold') {
      parts.push(
        <strong key={`bold-${keyIndex++}`} className="font-semibold">
          {segment.content}
        </strong>
      )
    } else {
      // Process italic in text segments
      const italicRegex = new RegExp(ITALIC_PATTERN.source, 'g')
      let lastItalicIndex = 0
      let italicMatch: RegExpExecArray | null
      let hasItalic = false

      while ((italicMatch = italicRegex.exec(segment.content)) !== null) {
        hasItalic = true
        if (italicMatch.index > lastItalicIndex) {
          parts.push(segment.content.slice(lastItalicIndex, italicMatch.index))
        }
        parts.push(
          <em key={`italic-${keyIndex++}`} className="italic">
            {italicMatch[1]}
          </em>
        )
        lastItalicIndex = italicMatch.index + italicMatch[0].length
      }

      if (hasItalic && lastItalicIndex < segment.content.length) {
        parts.push(segment.content.slice(lastItalicIndex))
      } else if (!hasItalic) {
        parts.push(segment.content)
      }
    }
  }

  return parts.length > 0 ? parts : [text]
}

/**
 * Parse and add tooltips to standalone cycling terms
 * Also processes bold/italic on non-term text
 */
function formatTerms(text: string, startKey: number = 0): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let keyIndex = startKey

  const regex = new RegExp(TERM_PATTERN.source, 'g')
  while ((match = regex.exec(text)) !== null) {
    const term = match[1]

    // Add text before match (with inline styles)
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index)
      const styledParts = formatInlineStyles(textBefore, keyIndex)
      parts.push(...styledParts)
      keyIndex += styledParts.length
    }

    // Add term with tooltip
    parts.push(
      <TermTooltip key={`term-${keyIndex++}`} term={term}>
        {term}
      </TermTooltip>
    )

    lastIndex = match.index + match[0].length
  }

  // Add remaining text (with inline styles)
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex)
    const styledParts = formatInlineStyles(remaining, keyIndex)
    parts.push(...styledParts)
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
 * Format a single paragraph with metrics and URLs
 */
function FormattedParagraph({ text }: { text: string }) {
  const formatted = useMemo(() => formatMetricsAndUrls(text), [text])
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
