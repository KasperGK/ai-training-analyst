'use client'

import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts'
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
  ftp: 'hsl(217, 91%, 60%)',        // blue
  ctl: 'hsl(142, 71%, 45%)',        // green
  weight: 'hsl(25, 95%, 53%)',      // orange
  weekly_hours: 'hsl(270, 67%, 55%)', // purple
  event_finish: 'hsl(38, 92%, 50%)', // amber
  metric: 'hsl(199, 89%, 48%)',     // sky
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

  // Workout completion radial data
  const completionPct = weekStats.plannedCount > 0
    ? Math.round((weekStats.completedCount / weekStats.plannedCount) * 100)
    : 0
  const completionData = [{ name: 'workouts', value: completionPct, fill: 'hsl(var(--chart-1))' }]

  return (
    <Card className="flex flex-col gap-5 p-5 flex-1 min-h-0 overflow-y-auto">
      {/* Header */}
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        This Week
      </span>

      {/* Workout completion radial */}
      {weekStats.plannedCount > 0 && (
        <div className="flex justify-center">
          <div className="relative" style={{ width: 120, height: 120 }}>
            <RadialBarChart
              width={120}
              height={120}
              cx={60}
              cy={60}
              innerRadius={42}
              outerRadius={52}
              barSize={10}
              data={completionData}
              startAngle={90}
              endAngle={-270}
            >
              <PolarAngleAxis
                type="number"
                domain={[0, 100]}
                angleAxisId={0}
                tick={false}
              />
              <RadialBar
                background={{ fill: 'hsl(0 0% 20%)' }}
                dataKey="value"
                cornerRadius={10}
                angleAxisId={0}
              />
            </RadialBarChart>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold tabular-nums">
                {weekStats.completedCount}/{weekStats.plannedCount}
              </span>
              <span className="text-[11px] text-muted-foreground">workouts</span>
            </div>
          </div>
        </div>
      )}

      {/* Secondary stats */}
      <div className="flex justify-center gap-6">
        {weekStats.totalTss > 0 && (
          <div className="text-center">
            <div className="text-sm font-semibold tabular-nums">{Math.round(weekStats.totalTss)}</div>
            <div className="text-[11px] text-muted-foreground">TSS</div>
          </div>
        )}
        {(weekStats.hours > 0 || weekStats.minutes > 0) && (
          <div className="text-center">
            <div className="text-sm font-semibold tabular-nums">
              {weekStats.hours > 0 ? `${weekStats.hours}h ` : ''}{weekStats.minutes}m
            </div>
            <div className="text-[11px] text-muted-foreground">duration</div>
          </div>
        )}
      </div>

      {/* Goals section — sleep-style radials */}
      {activeGoals.length > 0 && (
        <>
          <div className="border-t border-border/50" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Goals
            </span>
            <Link href="/events?tab=goals" className="text-[11px] text-muted-foreground hover:text-foreground underline">
              Manage
            </Link>
          </div>
          <div className="flex flex-col gap-5">
            {activeGoals.map(goal => {
              const current = goal.current_value ?? 0
              const target = goal.target_value ?? 1
              const pct = Math.min(100, Math.round((current / target) * 100))
              const color = typeColors[goal.target_type] || typeColors.metric
              const radialData = [{ name: goal.title, value: pct, fill: color }]

              return (
                <div key={goal.id} className="flex flex-col items-center">
                  <div className="relative" style={{ width: 100, height: 100 }}>
                    <RadialBarChart
                      width={100}
                      height={100}
                      cx={50}
                      cy={50}
                      innerRadius={35}
                      outerRadius={44}
                      barSize={9}
                      data={radialData}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <PolarAngleAxis
                        type="number"
                        domain={[0, 100]}
                        angleAxisId={0}
                        tick={false}
                      />
                      <RadialBar
                        background={{ fill: 'hsl(0 0% 20%)' }}
                        dataKey="value"
                        cornerRadius={10}
                        angleAxisId={0}
                      />
                    </RadialBarChart>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold tabular-nums">{pct}%</span>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-center mt-1">{goal.title}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {current} / {target}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Plan progress */}
      {plan && (
        <>
          <div className="border-t border-border/50" />
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium truncate">{plan.name}</span>
              <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{planProgress}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${planProgress}%` }}
              />
            </div>
          </div>
        </>
      )}

      {/* Next event */}
      {nextEvent && (
        <>
          <div className="border-t border-border/50" />
          <div className="flex items-center gap-2 text-sm">
            <Trophy className="size-3.5 text-amber-500 shrink-0" />
            <span className="truncate">{nextEvent.name}</span>
            <span className="text-muted-foreground shrink-0 ml-auto text-xs font-medium">{nextEvent.weeksUntil}w</span>
          </div>
        </>
      )}
    </Card>
  )
}
