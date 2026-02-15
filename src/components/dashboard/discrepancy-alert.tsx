'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Discrepancy {
  id: string
  date: string
  local_ctl: number
  local_atl: number
  remote_ctl: number
  remote_atl: number
  ctl_delta: number
  atl_delta: number
  detected_at: string
}

interface DiscrepancyAlertProps {
  className?: string
}

export function DiscrepancyAlert({ className }: DiscrepancyAlertProps) {
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([])
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchDiscrepancies = useCallback(async () => {
    try {
      const res = await fetch('/api/fitness/discrepancies')
      if (!res.ok) return
      const data = await res.json()
      setDiscrepancies(data.discrepancies || [])
    } catch {
      // Silently fail - this is non-critical UI
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDiscrepancies()
  }, [fetchDiscrepancies])

  const handleAcknowledge = async () => {
    try {
      await fetch('/api/fitness/discrepancies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'acknowledge_all' }),
      })
      setDismissed(true)
    } catch {
      // Silently fail
    }
  }

  if (loading || dismissed || discrepancies.length === 0) return null

  const largest = discrepancies.reduce((max, d) =>
    Math.abs(d.ctl_delta) > Math.abs(max.ctl_delta) ? d : max
  )
  const absDelta = Math.abs(Math.round(largest.ctl_delta))
  const direction = largest.ctl_delta > 0 ? 'higher' : 'lower'

  return (
    <div
      className={cn(
        'rounded-lg border border-amber-500/50 bg-amber-500/10 p-4',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium text-sm text-amber-900 dark:text-amber-200">
              Fitness Data Recalculated Upstream
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAcknowledge}
              className="h-7 px-2 text-xs text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-300/80">
            intervals.icu recalculated your fitness history. Your CTL is now{' '}
            <strong>{absDelta} points {direction}</strong> than what we had locally
            ({Math.round(largest.local_ctl)} &rarr; {Math.round(largest.remote_ctl)}).
            Local data has been updated to match.
          </p>

          {discrepancies.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="mt-1 h-7 px-2 text-xs text-amber-700 dark:text-amber-300"
            >
              {expanded ? (
                <>
                  <ChevronUp className="mr-1 h-3 w-3" />
                  Hide details
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1 h-3 w-3" />
                  {discrepancies.length} dates affected
                </>
              )}
            </Button>
          )}

          {expanded && (
            <div className="mt-2 space-y-1">
              {discrepancies.map(d => {
                const delta = Math.round(d.ctl_delta)
                return (
                  <div
                    key={d.id}
                    className="flex items-center justify-between text-xs text-amber-800/70 dark:text-amber-300/70"
                  >
                    <span>{d.date}</span>
                    <span>
                      CTL: {Math.round(d.local_ctl)} &rarr; {Math.round(d.remote_ctl)}{' '}
                      ({delta > 0 ? '+' : ''}{delta})
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
