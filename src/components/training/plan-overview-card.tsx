'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Calendar, Target, Clock } from 'lucide-react'
import type { TrainingPlan, PlanDay } from '@/types'

interface PlanOverviewCardProps {
  plan: TrainingPlan
  days: PlanDay[]
}

const goalLabels: Record<string, string> = {
  base_build: 'Base Building',
  ftp_build: 'FTP Build',
  event_prep: 'Event Prep',
  taper: 'Taper',
  maintenance: 'Maintenance',
}

export function PlanOverviewCard({ plan, days }: PlanOverviewCardProps) {
  // Calculate current week
  const today = new Date()
  const startDate = new Date(plan.start_date)
  const currentWeek = Math.max(1, Math.ceil(
    (today.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
  ))

  // Calculate this week's stats
  const weekStart = new Date(today)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1) // Monday
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  const thisWeekDays = days.filter(d => {
    const dayDate = new Date(d.date)
    return dayDate >= weekStart && dayDate <= weekEnd
  })

  const weekTargetTss = thisWeekDays.reduce((sum, d) => sum + (d.target_tss || 0), 0)
  const weekActualTss = thisWeekDays.reduce((sum, d) => {
    if (d.completed && d.actual_tss) return sum + d.actual_tss
    if (d.skipped) return sum
    return sum
  }, 0)

  const completedThisWeek = thisWeekDays.filter(d => d.completed).length
  const totalWorkoutsThisWeek = thisWeekDays.filter(d => d.workout_name).length

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{plan.name}</CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">{goalLabels[plan.goal] || plan.goal}</Badge>
              <span className="text-xs text-muted-foreground">
                Week {Math.min(currentWeek, plan.duration_weeks)} of {plan.duration_weeks}
              </span>
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{plan.progress_percent || 0}%</div>
            <div className="text-xs text-muted-foreground">Complete</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={plan.progress_percent || 0} className="h-2" />

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-medium">{completedThisWeek}/{totalWorkoutsThisWeek}</div>
              <div className="text-xs text-muted-foreground">This week</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-medium">{weekActualTss}/{weekTargetTss}</div>
              <div className="text-xs text-muted-foreground">TSS</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-medium">{plan.weekly_hours_target || '-'}h</div>
              <div className="text-xs text-muted-foreground">Target/wk</div>
            </div>
          </div>
        </div>

        {plan.target_event_date && (
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground">
              Target Event: {new Date(plan.target_event_date).toLocaleDateString()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
