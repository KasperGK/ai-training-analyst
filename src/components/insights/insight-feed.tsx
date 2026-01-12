'use client'

/**
 * Insight Feed Component
 *
 * Displays proactive insights to the athlete with ability to
 * mark as read or dismiss.
 */

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  TrendingUp,
  AlertTriangle,
  Trophy,
  Lightbulb,
  Activity,
  Calendar,
  X,
  Check,
  RefreshCw,
  Bell,
} from 'lucide-react'

interface Insight {
  id: string
  insight_type: string
  priority: string
  title: string
  content: string
  data: Record<string, unknown>
  is_read: boolean
  created_at: string
}

interface InsightFeedProps {
  className?: string
  maxItems?: number
  showHeader?: boolean
  compact?: boolean
}

const INSIGHT_ICONS: Record<string, React.ElementType> = {
  trend: TrendingUp,
  warning: AlertTriangle,
  achievement: Trophy,
  suggestion: Lightbulb,
  pattern: Activity,
  event_prep: Calendar,
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'border-l-red-500 bg-red-500/5',
  high: 'border-l-orange-500 bg-orange-500/5',
  medium: 'border-l-blue-500 bg-blue-500/5',
  low: 'border-l-gray-400 bg-gray-500/5',
}

const TYPE_COLORS: Record<string, string> = {
  trend: 'text-green-500',
  warning: 'text-red-500',
  achievement: 'text-yellow-500',
  suggestion: 'text-blue-500',
  pattern: 'text-purple-500',
  event_prep: 'text-orange-500',
}

export function InsightFeed({
  className,
  maxItems = 10,
  showHeader = true,
  compact = false,
}: InsightFeedProps) {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchInsights = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/insights?limit=${maxItems}&includeRead=false`)
      if (!res.ok) throw new Error('Failed to fetch insights')
      const data = await res.json()
      setInsights(data.insights || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insights')
    } finally {
      setLoading(false)
    }
  }, [maxItems])

  const generateInsights = async () => {
    try {
      setGenerating(true)
      const res = await fetch('/api/insights/generate', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to generate insights')
      const data = await res.json()
      if (data.insightsCreated > 0) {
        await fetchInsights()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate insights')
    } finally {
      setGenerating(false)
    }
  }

  const markAsRead = async (insightId: string) => {
    try {
      await fetch('/api/insights', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insightId, action: 'read' }),
      })
      setInsights(prev => prev.filter(i => i.id !== insightId))
    } catch (err) {
      console.error('Failed to mark as read:', err)
    }
  }

  const dismissInsight = async (insightId: string) => {
    try {
      await fetch('/api/insights', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insightId, action: 'dismiss' }),
      })
      setInsights(prev => prev.filter(i => i.id !== insightId))
    } catch (err) {
      console.error('Failed to dismiss:', err)
    }
  }

  useEffect(() => {
    fetchInsights()
  }, [fetchInsights])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60))

    if (diffHrs < 1) return 'Just now'
    if (diffHrs < 24) return `${diffHrs}h ago`
    const diffDays = Math.floor(diffHrs / 24)
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <Card className={cn('h-full flex flex-col overflow-hidden animate-pulse', className)}>
        {showHeader && (
          <CardHeader className="pb-2 flex-shrink-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" />
              Insights
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className="flex-1 overflow-y-auto min-h-0">
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('h-full flex flex-col overflow-hidden', className)}>
      {showHeader && (
        <CardHeader className="pb-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" />
              Insights
              {insights.length > 0 && (
                <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  {insights.length}
                </span>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={generateInsights}
              disabled={generating}
              className="h-8 px-2"
            >
              <RefreshCw className={cn('h-4 w-4', generating && 'animate-spin')} />
            </Button>
          </div>
        </CardHeader>
      )}

      <CardContent className={cn('flex-1 overflow-y-auto min-h-0', showHeader ? '' : 'pt-4')}>
        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {insights.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Bell className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p className="text-sm">No new insights</p>
            <p className="text-xs mt-1">Check back after your next workout</p>
          </div>
        ) : (
          <div className="space-y-3">
            {insights.map(insight => {
              const Icon = INSIGHT_ICONS[insight.insight_type] || Activity
              const priorityClass = PRIORITY_COLORS[insight.priority] || PRIORITY_COLORS.medium
              const iconClass = TYPE_COLORS[insight.insight_type] || 'text-muted-foreground'

              return (
                <div
                  key={insight.id}
                  className={cn(
                    'relative rounded-md border-l-4 p-3 transition-colors',
                    priorityClass
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Icon className={cn('mt-0.5 h-5 w-5 flex-shrink-0', iconClass)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-sm leading-tight">
                          {insight.title}
                        </h4>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(insight.created_at)}
                        </span>
                      </div>
                      {!compact && (
                        <p className="mt-1 text-sm text-muted-foreground leading-snug">
                          {insight.content}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsRead(insight.id)}
                          className="h-7 px-2 text-xs"
                        >
                          <Check className="mr-1 h-3 w-3" />
                          Got it
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => dismissInsight(insight.id)}
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                        >
                          <X className="mr-1 h-3 w-3" />
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Compact insight badge for nav/header
 */
export function InsightBadge({ className }: { className?: string }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch('/api/insights?countsOnly=true')
        if (res.ok) {
          const data = await res.json()
          setCount(data.total || 0)
        }
      } catch {
        // Ignore errors for badge
      }
    }

    fetchCount()
    // Refresh every 5 minutes
    const interval = setInterval(fetchCount, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (count === 0) return null

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground',
        className
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
