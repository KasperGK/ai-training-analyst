'use client'

import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { Goal, TrainingPlan } from '@/types'

export interface WeekStats {
  completedCount: number
  plannedCount: number
  totalTss: number
  hours: number
  minutes: number
}

const typeColors: Record<string, string> = {
  ftp: 'text-blue-500',
  ctl: 'text-green-500',
  weight: 'text-orange-500',
  weekly_hours: 'text-purple-500',
  event_finish: 'text-amber-500',
  metric: 'text-sky-500',
}

interface WeekStatsCardProps {
  weekStats: WeekStats
  goals: Goal[]
  plan: TrainingPlan | null
  planProgress: number
  events: Array<{ date: string; name: string; priority: string }>
  today: string
}

export function WeekStatsCard({
  weekStats,
  goals,
  plan,
  planProgress,
  events,
  today,
}: WeekStatsCardProps) {
  const activeGoals = goals.filter(g => g.status === 'active')

  // Next upcoming event
  const nextEvent = (() => {
    const now = new Date(today + 'T12:00:00')
    const upcoming = events
      .filter(e => new Date(e.date) > now)
      .sort((a, b) => a.date.localeCompare(b.date))
    if (upcoming.length === 0) return null
    const e = upcoming[0]
    const weeks = Math.ceil((new Date(e.date).getTime() - now.getTime()) / (7 * 86400000))
    return { name: e.name, weeksUntil: weeks }
  })()

  const completionPct = weekStats.plannedCount > 0
    ? Math.round((weekStats.completedCount / weekStats.plannedCount) * 100)
    : 0

  return (
    <Card className="px-5 py-3">
      <div className="flex items-center gap-5 flex-wrap">
        {/* This Week label */}
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide shrink-0">
          This Week
        </span>

        {/* Workout completion */}
        {weekStats.plannedCount > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-chart-1 transition-all"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <span className="text-sm font-semibold tabular-nums">
              {weekStats.completedCount}/{weekStats.plannedCount}
            </span>
            <span className="text-[11px] text-muted-foreground">workouts</span>
          </div>
        )}

        <div className="h-5 w-px bg-border/50" />

        {/* TSS */}
        {weekStats.totalTss > 0 && (
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="text-sm font-semibold tabular-nums">{Math.round(weekStats.totalTss)}</span>
            <span className="text-[11px] text-muted-foreground">TSS</span>
          </div>
        )}

        {/* Duration */}
        {(weekStats.hours > 0 || weekStats.minutes > 0) && (
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="text-sm font-semibold tabular-nums">
              {weekStats.hours > 0 ? `${weekStats.hours}h ` : ''}{weekStats.minutes}m
            </span>
            <span className="text-[11px] text-muted-foreground">duration</span>
          </div>
        )}

        {/* Goals — compact inline */}
        {activeGoals.length > 0 && (
          <>
            <div className="h-5 w-px bg-border/50" />
            {activeGoals.map(goal => {
              const current = goal.current_value ?? 0
              const target = goal.target_value ?? 1
              const pct = Math.min(100, Math.round((current / target) * 100))
              const colorClass = typeColors[goal.target_type] || typeColors.metric

              return (
                <div key={goal.id} className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-sm font-semibold tabular-nums ${colorClass}`}>{pct}%</span>
                  <span className="text-[11px] text-muted-foreground truncate max-w-[100px]">{goal.title}</span>
                </div>
              )
            })}
            <Link href="/events?tab=goals" className="text-[11px] text-muted-foreground hover:text-foreground underline shrink-0">
              Manage
            </Link>
          </>
        )}

        {/* Plan progress */}
        {plan && (
          <>
            <div className="h-5 w-px bg-border/50" />
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-medium truncate max-w-[120px]">{plan.name}</span>
              <div className="h-1.5 w-12 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${planProgress}%` }}
                />
              </div>
              <span className="text-[11px] text-muted-foreground tabular-nums">{planProgress}%</span>
            </div>
          </>
        )}

        {/* Next event */}
        {nextEvent && (
          <>
            <div className="h-5 w-px bg-border/50" />
            <div className="flex items-center gap-1.5 shrink-0">
              <Trophy className="size-3.5 text-amber-500" />
              <span className="text-sm truncate max-w-[120px]">{nextEvent.name}</span>
              <span className="text-xs font-medium text-muted-foreground">{nextEvent.weeksUntil}w</span>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
