'use client'

/**
 * Plan Proposal Widget
 *
 * Calendar-style view showing a training plan proposal with:
 * - Week rows with day columns (Mon-Sun)
 * - Color-coded workout types
 * - Phase labels
 * - Target TSS per day
 * - Weekly TSS totals
 */

import { cn } from '@/lib/utils'
import { Flag, Dumbbell } from 'lucide-react'

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

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  endurance: { bg: 'bg-blue-100 dark:bg-blue-950', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
  tempo: { bg: 'bg-amber-100 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
  sweetspot: { bg: 'bg-orange-100 dark:bg-orange-950', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800' },
  threshold: { bg: 'bg-red-100 dark:bg-red-950', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800' },
  vo2max: { bg: 'bg-purple-100 dark:bg-purple-950', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
  sprint: { bg: 'bg-fuchsia-100 dark:bg-fuchsia-950', text: 'text-fuchsia-700 dark:text-fuchsia-300', border: 'border-fuchsia-200 dark:border-fuchsia-800' },
  recovery: { bg: 'bg-green-100 dark:bg-green-950', text: 'text-green-700 dark:text-green-300', border: 'border-green-200 dark:border-green-800' },
  rest: { bg: 'bg-muted/50', text: 'text-muted-foreground', border: 'border-muted' },
}

function getCategoryColors(category: string | null) {
  if (!category) return CATEGORY_COLORS.rest
  const key = category.toLowerCase()
  return CATEGORY_COLORS[key] || CATEGORY_COLORS.endurance
}

const PHASE_COLORS: Record<string, string> = {
  base: 'text-blue-600 dark:text-blue-400',
  build: 'text-orange-600 dark:text-orange-400',
  peak: 'text-red-600 dark:text-red-400',
  taper: 'text-green-600 dark:text-green-400',
  recovery: 'text-emerald-600 dark:text-emerald-400',
}

function getPhaseColor(phase: string) {
  return PHASE_COLORS[phase.toLowerCase()] || 'text-muted-foreground'
}

export function PlanProposalWidget({ data }: { data: PlanProposalData }) {
  const { weekSummaries, targetEventDate, planName } = data

  if (!weekSummaries || weekSummaries.length === 0) {
    return <p className="text-muted-foreground text-sm">No plan data available</p>
  }

  return (
    <div className="space-y-1">
      {/* Plan header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{planName}</h3>
        <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
          Draft
        </span>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-px text-[10px] text-muted-foreground font-medium mb-1">
        <div />
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center">{d}</div>
        ))}
      </div>

      {/* Week rows */}
      {weekSummaries.map((week) => {
        // Organize days by day of week (0-6)
        const daysByDow = new Map<number, WorkoutDay>()
        for (const day of week.days) {
          daysByDow.set(day.dayOfWeek, day)
        }

        return (
          <div key={week.week} className="grid grid-cols-[80px_repeat(7,1fr)] gap-px">
            {/* Week label */}
            <div className="flex flex-col justify-center pr-2">
              <span className={cn('text-[10px] font-semibold uppercase', getPhaseColor(week.phase))}>
                {week.phase}
              </span>
              <span className="text-[10px] text-muted-foreground">
                Wk {week.week} · {week.targetTSS} TSS
              </span>
            </div>

            {/* Day cells */}
            {[0, 1, 2, 3, 4, 5, 6].map(dow => {
              const day = daysByDow.get(dow)
              const workout = day?.workout
              const isEvent = targetEventDate && day?.date === targetEventDate
              const colors = getCategoryColors(workout?.category ?? null)

              return (
                <div
                  key={dow}
                  className={cn(
                    'relative rounded-sm border p-1 min-h-[48px] flex flex-col justify-between',
                    colors.bg,
                    colors.border,
                    isEvent && 'ring-2 ring-amber-500',
                    day?.isKeyWorkout && 'border-2'
                  )}
                >
                  {isEvent && (
                    <Flag className="absolute top-0.5 right-0.5 h-3 w-3 text-amber-500" />
                  )}
                  {day?.isKeyWorkout && !isEvent && (
                    <Dumbbell className="absolute top-0.5 right-0.5 h-2.5 w-2.5 text-muted-foreground/50" />
                  )}
                  {workout ? (
                    <>
                      <span className={cn('text-[9px] font-medium leading-tight line-clamp-2', colors.text)}>
                        {workout.name}
                      </span>
                      <span className="text-[9px] text-muted-foreground mt-auto">
                        {workout.targetTSS}
                      </span>
                    </>
                  ) : (
                    <span className="text-[9px] text-muted-foreground/50 self-center">
                      Rest
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t">
        {Object.entries(CATEGORY_COLORS).filter(([k]) => k !== 'rest').map(([key, colors]) => (
          <div key={key} className="flex items-center gap-1">
            <div className={cn('w-2.5 h-2.5 rounded-sm', colors.bg, 'border', colors.border)} />
            <span className="text-[9px] text-muted-foreground capitalize">{key}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
