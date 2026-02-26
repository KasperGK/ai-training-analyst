'use client'

import React, { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getArticleBySlug, categories } from '@/lib/wiki/articles'
import { ConfidenceBadge } from '@/components/ui/confidence-badge'
import { FlagArticleDialog } from './flag-dialog'
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  CheckCircle2,
  BookOpen,
  Flag,
  AlertTriangle,
} from 'lucide-react'

const categoryColors: Record<string, string> = {
  fundamentals: 'bg-blue-100 text-blue-800',
  metrics: 'bg-green-100 text-green-800',
  concepts: 'bg-purple-100 text-purple-800',
  'app-guide': 'bg-orange-100 text-orange-800',
}

export default function ArticlePage() {
  const router = useRouter()
  const params = useParams()
  const slug = params.slug as string
  const article = getArticleBySlug(slug)
  const [showFlagDialog, setShowFlagDialog] = useState(false)

  if (!article) {
    return (
      <div className="min-h-screen bg-muted/40 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Article Not Found</h1>
            <p className="text-muted-foreground mb-4">
              The article you&apos;re looking for doesn&apos;t exist.
            </p>
            <Button onClick={() => router.push('/learn')}>
              Back to Knowledge Base
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Simple markdown-like rendering (handles headers, bold, lists, tables)
  const renderContent = (content: string) => {
    const lines = content.split('\n')
    const elements: React.ReactElement[] = []
    let inTable = false
    let tableRows: string[][] = []
    let tableHeaders: string[] = []

    const processLine = (line: string, index: number) => {
      // Skip empty lines at start
      if (!line.trim() && elements.length === 0) return null

      // Headers
      if (line.startsWith('## ')) {
        return <h2 key={index} className="text-xl font-semibold mt-6 mb-3">{line.slice(3)}</h2>
      }
      if (line.startsWith('### ')) {
        return <h3 key={index} className="text-lg font-medium mt-4 mb-2">{line.slice(4)}</h3>
      }

      // Table handling
      if (line.startsWith('|')) {
        const cells = line.split('|').slice(1, -1).map(c => c.trim())

        if (!inTable) {
          inTable = true
          tableHeaders = cells
          return null
        }

        // Skip separator row
        if (cells[0]?.startsWith('-')) return null

        tableRows.push(cells)
        return null
      } else if (inTable) {
        // End of table
        const table = (
          <div key={`table-${index}`} className="overflow-x-auto my-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  {tableHeaders.map((h, i) => (
                    <th key={i} className="text-left py-2 px-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, ri) => (
                  <tr key={ri} className="border-b">
                    {row.map((cell, ci) => (
                      <td key={ci} className="py-2 px-3">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
        inTable = false
        tableRows = []
        tableHeaders = []
        return table
      }

      // Lists
      if (line.startsWith('- **')) {
        const match = line.match(/^- \*\*(.+?)\*\*:?\s*(.*)/)
        if (match) {
          return (
            <li key={index} className="ml-4 mb-1">
              <strong>{match[1]}</strong>{match[2] ? `: ${match[2]}` : ''}
            </li>
          )
        }
      }
      if (line.startsWith('- ')) {
        return <li key={index} className="ml-4 mb-1">{line.slice(2)}</li>
      }
      if (line.match(/^\d+\. /)) {
        return <li key={index} className="ml-4 mb-1 list-decimal">{line.replace(/^\d+\. /, '')}</li>
      }

      // Empty line = paragraph break
      if (!line.trim()) {
        return <div key={index} className="h-3" />
      }

      // Regular paragraph with bold support
      const parts = line.split(/(\*\*[^*]+\*\*)/g)
      return (
        <p key={index} className="mb-2">
          {parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={i}>{part.slice(2, -2)}</strong>
            }
            return part
          })}
        </p>
      )
    }

    for (let i = 0; i < lines.length; i++) {
      const element = processLine(lines[i], i)
      if (element) elements.push(element)
    }

    // Handle table at end of content
    if (inTable && tableRows.length > 0) {
      elements.push(
        <div key="table-end" className="overflow-x-auto my-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                {tableHeaders.map((h, i) => (
                  <th key={i} className="text-left py-2 px-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, ri) => (
                <tr key={ri} className="border-b">
                  {row.map((cell, ci) => (
                    <td key={ci} className="py-2 px-3">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    return elements
  }

  return (
    <main className="flex-1 overflow-auto bg-muted/40">
      {/* Flag Dialog */}
      <FlagArticleDialog
        open={showFlagDialog}
        onOpenChange={setShowFlagDialog}
        articleSlug={article.slug}
        articleTitle={article.title}
      />

      {/* Main Content */}
      <div className="px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Article Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className={categoryColors[article.category]}>
                  {categories[article.category].label}
                </Badge>
                <ConfidenceBadge level={article.confidenceLevel} />
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {article.readingTime} min read
                </div>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {article.title}
              </h1>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => setShowFlagDialog(true)}
            >
              <Flag className="h-4 w-4 mr-1" />
              Report
            </Button>
          </div>
          {/* Consensus Note (if present) */}
          {article.consensusNote && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-4">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Note:</strong> {article.consensusNote}
              </div>
            </div>
          )}

          {/* Article Content */}
          <Card>
            <CardContent className="pt-6 prose prose-sm max-w-none">
              {renderContent(article.content)}
            </CardContent>
          </Card>

          {/* Key Takeaways */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Key Takeaways
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {article.keyTakeaways.map((takeaway, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-green-600 mt-0.5">&#10003;</span>
                    {takeaway}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Sources */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Sources ({article.sources.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {article.sources.map((source, i) => (
                  <li key={i} className="text-sm">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3 mt-1 flex-shrink-0" />
                      <span>
                        {source.title}
                        {source.author && (
                          <span className="text-muted-foreground"> — {source.author}</span>
                        )}
                        {source.year && (
                          <span className="text-muted-foreground"> ({source.year})</span>
                        )}
                      </span>
                    </a>
                    <Badge variant="outline" className="ml-5 mt-1 text-xs">
                      {source.type.replace('_', ' ')}
                    </Badge>
                  </li>
                ))}
              </ul>
              <div className="mt-4 text-xs text-muted-foreground">
                Last verified: {new Date(article.lastVerified).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>

          {/* Back Link */}
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => router.push('/learn')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Knowledge Base
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}
