'use client'

/**
 * Insights Dropdown Component
 *
 * YouTube-inspired notification panel that displays proactive insights.
 * Features:
 * - Dropdown panel positioned below trigger (not full-height sheet)
 * - Clean header with title and refresh button
 * - Section grouping (Important / Recent)
 * - Readable content with visible action buttons
 * - Hover effects and smooth animations
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  RefreshCw,
  Check,
  X,
  TrendingUp,
  AlertTriangle,
  Trophy,
  Lightbulb,
  Activity,
  Calendar,
  MessageSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

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

const INSIGHT_ICONS: Record<string, React.ElementType> = {
  trend: TrendingUp,
  warning: AlertTriangle,
  achievement: Trophy,
  suggestion: Lightbulb,
  pattern: Activity,
  event_prep: Calendar,
}

const ICON_BG_COLORS: Record<string, string> = {
  trend: 'bg-green-500/15 text-green-600 dark:text-green-400',
  warning: 'bg-red-500/15 text-red-600 dark:text-red-400',
  achievement: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
  suggestion: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  pattern: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  event_prep: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
}

function formatDate(dateStr: string): string {
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

interface InsightItemProps {
  insight: Insight
  onMarkRead: (id: string) => void
  onDismiss: (id: string) => void
  onAskCoach: (insight: Insight) => void
}

function InsightItem({ insight, onMarkRead, onDismiss, onAskCoach }: InsightItemProps) {
  const Icon = INSIGHT_ICONS[insight.insight_type] || Activity
  const iconColorClass = ICON_BG_COLORS[insight.insight_type] || 'bg-muted text-muted-foreground'

  return (
    <div className="px-3 py-3 hover:bg-accent/50 rounded-lg transition-colors border-b border-border/50 last:border-b-0">
      <div className="flex items-start gap-3">
        {/* Circular icon */}
        <div
          className={cn(
            'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
            iconColorClass
          )}
        >
          <Icon className="h-5 w-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-medium leading-tight">
              {insight.title}
            </h4>
            <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
              {formatDate(insight.created_at)}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            {insight.content}
          </p>

          {/* Action buttons */}
          <div className="mt-2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onMarkRead(insight.id)
              }}
              className="h-7 px-2 text-xs hover:bg-primary/10 hover:text-primary"
            >
              <Check className="mr-1 h-3 w-3" />
              Got it
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onDismiss(insight.id)
              }}
              className="h-7 px-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="mr-1 h-3 w-3" />
              Dismiss
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onAskCoach(insight)
              }}
              className="h-7 px-2 text-xs hover:bg-blue-500/10"
            >
              <MessageSquare className="mr-1 h-3 w-3" />
              Ask Coach
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function InsightsDropdown() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [insights, setInsights] = useState<Insight[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchInsights = useCallback(async () => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    try {
      setLoading(true)
      const res = await fetch('/api/insights?limit=20&includeRead=false', {
        signal: abortControllerRef.current.signal,
      })
      if (!res.ok) throw new Error('Failed to fetch insights')
      const data = await res.json()
      setInsights(data.insights || [])
      setUnreadCount(data.total || data.insights?.length || 0)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('Failed to fetch insights:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch('/api/insights?countsOnly=true')
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.total || 0)
      }
    } catch {
      // Ignore errors for badge
    }
  }, [])

  const refreshInsights = async () => {
    try {
      setRefreshing(true)
      const res = await fetch('/api/insights/generate', { method: 'POST' })
      if (res.ok) {
        await fetchInsights()
      }
    } catch (err) {
      console.error('Failed to refresh insights:', err)
    } finally {
      setRefreshing(false)
    }
  }

  const markAsRead = async (insightId: string) => {
    try {
      await fetch('/api/insights', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insightId, action: 'read' }),
      })
      setInsights((prev) => prev.filter((i) => i.id !== insightId))
      setUnreadCount((prev) => Math.max(0, prev - 1))
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
      setInsights((prev) => prev.filter((i) => i.id !== insightId))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Failed to dismiss:', err)
    }
  }

  const askCoach = (insight: Insight) => {
    // Mark as read
    markAsRead(insight.id)
    // Close dropdown
    setOpen(false)
    // Navigate to coach with pre-filled message
    const message = `Regarding the insight "${insight.title}": ${insight.content}`
    router.push(`/coach?message=${encodeURIComponent(message)}`)
  }

  // Initial count fetch
  useEffect(() => {
    fetchCount()
    const interval = setInterval(fetchCount, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchCount])

  // Fetch full insights when dropdown opens
  useEffect(() => {
    if (open) {
      fetchInsights()
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [open, fetchInsights])

  // Group insights by priority
  const importantInsights = insights.filter(
    (i) => i.priority === 'urgent' || i.priority === 'high'
  )
  const recentInsights = insights.filter(
    (i) => i.priority !== 'urgent' && i.priority !== 'high'
  )

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-xs text-primary-foreground flex items-center justify-center font-medium">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <span className="sr-only">
            {unreadCount > 0 ? `${unreadCount} unread insights` : 'Insights'}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[420px] p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-base">Insights</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.preventDefault()
              refreshInsights()
            }}
            disabled={refreshing}
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            <span className="sr-only">Refresh insights</span>
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="max-h-[500px]">
          {loading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : insights.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Bell className="mx-auto mb-3 h-10 w-10 opacity-40" />
              <p className="text-sm font-medium">No new insights</p>
              <p className="text-xs mt-1 text-muted-foreground/80">
                Check back after your next workout
              </p>
            </div>
          ) : (
            <div className="py-1">
              {/* Important section */}
              {importantInsights.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-medium uppercase tracking-wider px-4 py-2">
                    Important
                  </DropdownMenuLabel>
                  {importantInsights.map((insight) => (
                    <InsightItem
                      key={insight.id}
                      insight={insight}
                      onMarkRead={markAsRead}
                      onDismiss={dismissInsight}
                      onAskCoach={askCoach}
                    />
                  ))}
                </>
              )}

              {/* Separator if both sections exist */}
              {importantInsights.length > 0 && recentInsights.length > 0 && (
                <DropdownMenuSeparator className="my-1" />
              )}

              {/* Recent section */}
              {recentInsights.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-medium uppercase tracking-wider px-4 py-2">
                    Recent
                  </DropdownMenuLabel>
                  {recentInsights.map((insight) => (
                    <InsightItem
                      key={insight.id}
                      insight={insight}
                      onMarkRead={markAsRead}
                      onDismiss={dismissInsight}
                      onAskCoach={askCoach}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
