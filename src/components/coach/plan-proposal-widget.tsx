'use client'

/**
 * Plan Proposal Widget
 *
 * Vertical collapsible outline showing a training plan proposal with:
 * - Week-by-week collapsible sections
 * - All workout info visible as plain text (no hover needed)
 * - Key workout dots, rest day dimming, event badges
 * - Neutral gray aesthetic
 */

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { ChevronRight, Check, Loader2 } from 'lucide-react'

interface WorkoutDay {
  date: string
  dayOfWeek: number
  isKeyWorkout: boolean
  workout: {
    name: string
    category: string
    targetTSS: number
    targetDurationMinutes: number
  } | null
}

interface WeekSummary {
  week: number
  phase: string
  focus: string
  targetTSS: number
  days: WorkoutDay[]
}

export interface PlanProposalData {
  planId: string | null
  planName: string
  weekSummaries: WeekSummary[]
  targetEventDate?: string | null
  startDate: string
  endDate: string
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // Mon–Sun

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(s)} – ${fmt(e)}`
}

export function PlanProposalWidget({ data, onApprove, approving, approved }: {
  data: PlanProposalData
  onApprove?: (planId: string) => void
  approving?: boolean
  approved?: boolean
}) {
  const { weekSummaries, targetEventDate, planName, startDate, endDate, planId } = data
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(
    () => new Set(weekSummaries.map(w => w.week))
  )
  const [planStatus, setPlanStatus] = useState<string | null>(null)

  // Check if this plan is already active (e.g., approved in a previous session)
  useEffect(() => {
    if (!planId) return
    fetch('/api/training-plans')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.plan?.id === planId && data.plan.status === 'active') {
          setPlanStatus('active')
        }
      })
      .catch(() => {})
  }, [planId])

  const isDraft = !approved && planStatus !== 'active'

  if (!weekSummaries || weekSummaries.length === 0) {
    return <p className="text-muted-foreground text-sm">No plan data available</p>
  }

  function toggleWeek(weekNum: number) {
    setExpandedWeeks(prev => {
      const next = new Set(prev)
      if (next.has(weekNum)) {
        next.delete(weekNum)
      } else {
        next.add(weekNum)
      }
      return next
    })
  }

  function weekHasEvent(week: WeekSummary): boolean {
    if (!targetEventDate) return false
    return week.days.some(d => d.date === targetEventDate)
  }

  return (
    <div className="space-y-1">
      {/* Plan header */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">{planName}</h3>
          <span className={cn(
            "text-[10px] px-1.5 py-0.5 rounded",
            !isDraft
              ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30"
              : "text-muted-foreground bg-muted"
          )}>
            {isDraft ? 'draft' : 'active'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatDateRange(startDate, endDate)}
        </p>
      </div>

      {/* Week rows */}
      <div className="space-y-1">
        {weekSummaries.map(week => {
          const isOpen = expandedWeeks.has(week.week)
          const hasEvent = weekHasEvent(week)

          // Organize days by day-of-week
          const daysByDow = new Map<number, WorkoutDay>()
          for (const day of week.days) {
            daysByDow.set(day.dayOfWeek, day)
          }

          return (
            <Collapsible
              key={week.week}
              open={isOpen}
              onOpenChange={() => toggleWeek(week.week)}
            >
              {/* Week trigger row */}
              <CollapsibleTrigger asChild>
                <button
                  className={cn(
                    'flex items-center gap-2 w-full px-2 py-2.5 rounded-sm text-left',
                    'hover:bg-muted/30 transition-colors'
                  )}
                >
                  <ChevronRight
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                      isOpen && 'rotate-90'
                    )}
                  />
                  <span className="text-sm font-semibold w-10 shrink-0">
                    Wk {week.week}
                  </span>
                  <span className="text-sm text-muted-foreground capitalize w-20 truncate shrink-0">
                    {week.phase}
                  </span>
                  <span className="text-sm text-muted-foreground truncate flex-1">
                    {week.focus}
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground shrink-0">
                    {week.targetTSS} TSS
                  </span>
                  {hasEvent && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                      event
                    </span>
                  )}
                </button>
              </CollapsibleTrigger>

              {/* Expanded day rows */}
              <CollapsibleContent>
                <div className="ml-[26px] border-l border-border/50 pl-4 py-0.5">
                  {DISPLAY_ORDER.filter(dow => daysByDow.get(dow)?.workout).map(dow => {
                    const day = daysByDow.get(dow)!
                    const workout = day.workout!
                    const isEvent = targetEventDate && day.date === targetEventDate

                    return (
                      <div
                        key={dow}
                        className={cn(
                          'flex items-center gap-2 py-2',
                          isEvent && 'bg-muted/30 -mx-2 px-2 rounded-sm'
                        )}
                      >
                        {/* Day name */}
                        <span className="text-sm text-muted-foreground w-8 shrink-0">
                          {DAY_NAMES[dow]}
                        </span>
                        {/* Key workout dot */}
                        {day.isKeyWorkout && (
                          <span className="w-1.5 h-1.5 rounded-full bg-foreground/40 shrink-0" />
                        )}
                        {/* Workout name */}
                        <span
                          className={cn(
                            'text-sm truncate flex-1',
                            day.isKeyWorkout
                              ? 'font-medium'
                              : 'text-muted-foreground'
                          )}
                        >
                          {workout.name}
                        </span>
                        {/* Duration */}
                        <span className="text-sm tabular-nums text-muted-foreground shrink-0 w-12 text-right">
                          {formatDuration(workout.targetDurationMinutes)}
                        </span>
                        {/* TSS */}
                        <span className="text-sm tabular-nums text-muted-foreground shrink-0 w-14 text-right">
                          {workout.targetTSS} TSS
                        </span>
                        {/* Event badge */}
                        {isEvent && (
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                            event
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        })}
      </div>

      {/* Approve Plan button — only shown for draft plans */}
      {planId && isDraft && (
        <div className="pt-4">
          <Button
            className="w-full gap-2"
            onClick={() => onApprove?.(planId)}
            disabled={approving}
          >
            {approving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {approving ? 'Approving...' : 'Approve Plan'}
          </Button>
        </div>
      )}

      {/* Approved confirmation */}
      {planId && !isDraft && (
        <div className="pt-4">
          <div className="flex items-center gap-2 justify-center text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 rounded-lg py-2.5 px-4">
            <Check className="h-4 w-4" />
            Plan approved and active
          </div>
        </div>
      )}
    </div>
  )
}
