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

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import { ChevronRight } from 'lucide-react'

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

export function PlanProposalWidget({ data }: { data: PlanProposalData }) {
  const { weekSummaries, targetEventDate, planName, startDate, endDate } = data
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set())

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
    <div className="space-y-0">
      {/* Plan header */}
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{planName}</h3>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            draft
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatDateRange(startDate, endDate)}
        </p>
      </div>

      {/* Week rows */}
      <div className="space-y-0">
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
                    'flex items-center gap-2 w-full px-2 py-1.5 rounded-sm text-left',
                    'hover:bg-muted/30 transition-colors'
                  )}
                >
                  <ChevronRight
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                      isOpen && 'rotate-90'
                    )}
                  />
                  <span className="text-xs font-semibold w-10 shrink-0">
                    Wk {week.week}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize w-20 truncate shrink-0">
                    {week.phase}
                  </span>
                  <span className="text-xs text-muted-foreground truncate flex-1">
                    {week.focus}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground shrink-0">
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
                  {DISPLAY_ORDER.map(dow => {
                    const day = daysByDow.get(dow)
                    const workout = day?.workout
                    const isEvent = targetEventDate && day?.date === targetEventDate
                    const isRest = !workout

                    return (
                      <div
                        key={dow}
                        className={cn(
                          'flex items-center gap-2',
                          isRest ? 'py-1' : 'py-1.5',
                          isEvent && 'bg-muted/30 -mx-2 px-2 rounded-sm'
                        )}
                      >
                        {/* Day name */}
                        <span className="text-xs text-muted-foreground w-8 shrink-0">
                          {DAY_NAMES[dow]}
                        </span>

                        {isRest ? (
                          <span className="text-xs text-muted-foreground/50 italic">
                            Rest
                          </span>
                        ) : (
                          <>
                            {/* Key workout dot */}
                            {day?.isKeyWorkout && (
                              <span className="w-1.5 h-1.5 rounded-full bg-foreground/40 shrink-0" />
                            )}
                            {/* Workout name */}
                            <span
                              className={cn(
                                'text-xs truncate flex-1',
                                day?.isKeyWorkout
                                  ? 'font-medium'
                                  : 'text-muted-foreground'
                              )}
                            >
                              {workout.name}
                            </span>
                            {/* Duration */}
                            <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                              {formatDuration(workout.targetDurationMinutes)}
                            </span>
                            {/* TSS */}
                            <span className="text-xs tabular-nums text-muted-foreground shrink-0 w-14 text-right">
                              {workout.targetTSS} TSS
                            </span>
                            {/* Event badge */}
                            {isEvent && (
                              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                                event
                              </span>
                            )}
                          </>
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
    </div>
  )
}
