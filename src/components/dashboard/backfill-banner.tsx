'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Database, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { logger } from '@/lib/logger'

interface BackfillStatus {
  hasBackfilled: boolean
  fitnessRecordCount: number
  oldestDate: string | null
  wellnessSynced: number
}

interface BackfillResult {
  success: boolean
  synced: number
  oldest_date: string
  newest_date: string
  duration_ms: number
  errors: string[]
}

export function BackfillBanner() {
  const [status, setStatus] = useState<BackfillStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<BackfillResult | null>(null)
  const [dismissed, setDismissed] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/sync/backfill')
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
      }
    } catch {
      // Silently fail - banner just won't show
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const runBackfill = async () => {
    setRunning(true)
    setResult(null)

    try {
      const res = await fetch('/api/sync/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 120 }),
      })

      if (res.ok) {
        const data = await res.json()
        setResult(data)
        // Refresh status
        await fetchStatus()
      }
    } catch (error) {
      logger.error('Backfill failed:', error)
      setResult({
        success: false,
        synced: 0,
        oldest_date: '',
        newest_date: '',
        duration_ms: 0,
        errors: ['Network error'],
      })
    } finally {
      setRunning(false)
    }
  }

  // Don't show if loading, already backfilled, or dismissed
  if (loading || dismissed) return null
  if (status?.hasBackfilled) return null

  // Show success state briefly after completing
  if (result?.success) {
    return (
      <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm dark:border-green-900 dark:bg-green-950">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="font-medium text-green-800 dark:text-green-200">
            Backfill complete: {result.synced} days of fitness history imported
          </span>
          <span className="text-green-600 dark:text-green-400">
            ({result.oldest_date} to {result.newest_date})
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setDismissed(true)}
          >
            Dismiss
          </Button>
        </div>
      </div>
    )
  }

  // Show error state
  if (result && !result.success) {
    return (
      <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <span className="font-medium text-red-800 dark:text-red-200">
            Backfill encountered errors: {result.errors.join(', ')}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={runBackfill}
          >
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      <div className="flex items-center gap-3">
        <Database className="h-4 w-4 shrink-0" />
        <div className="flex-1">
          <span className="font-medium text-foreground">Import historical data:</span>{' '}
          Pull 90+ days of fitness history from intervals.icu for richer charts and smarter coaching.
          {status && status.fitnessRecordCount > 0 && (
            <span className="text-muted-foreground"> ({status.fitnessRecordCount} days currently stored)</span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={runBackfill}
          disabled={running}
          className="shrink-0"
        >
          {running ? (
            <>
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              Importing...
            </>
          ) : (
            'Import History'
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDismissed(true)}
          className="shrink-0"
        >
          Dismiss
        </Button>
      </div>
    </div>
  )
}
