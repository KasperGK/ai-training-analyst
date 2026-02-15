import { cn } from '@/lib/utils'
import type { Goal } from '@/types'

const typeColors: Record<string, string> = {
  ftp: 'bg-blue-500',
  ctl: 'bg-green-500',
  weight: 'bg-orange-500',
  weekly_hours: 'bg-purple-500',
  event_finish: 'bg-amber-500',
  metric: 'bg-sky-500',
}

const goalUnits: Record<string, string> = {
  ftp: 'W',
  ctl: 'TSS/d',
  weight: 'kg',
  weekly_hours: 'h',
}

function getGoalUnit(goal: Goal): string {
  return goalUnits[goal.target_type] || ''
}

interface GoalProgressCardProps {
  goal: Goal
}

export function GoalProgressCard({ goal }: GoalProgressCardProps) {
  const current = goal.current_value ?? 0
  const target = goal.target_value ?? 1
  const percentage = Math.min(100, Math.round((current / target) * 100))
  const barColor = typeColors[goal.target_type] || typeColors.metric || 'bg-gray-500'
  const unit = getGoalUnit(goal)

  const deadlineLabel = goal.deadline
    ? (() => {
        const days = Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86400000)
        if (days < 0) return 'Overdue'
        if (days === 0) return 'Today'
        if (days <= 7) return `${days}d left`
        return `${Math.ceil(days / 7)}w left`
      })()
    : null

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium truncate">{goal.title}</span>
        {deadlineLabel && (
          <span className={cn(
            'text-[10px] shrink-0 ml-2',
            deadlineLabel === 'Overdue' ? 'text-red-500' : 'text-muted-foreground',
          )}>
            {deadlineLabel}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {current}{unit ? ` ${unit}` : ''} / {target}{unit ? ` ${unit}` : ''}
        </span>
        <span className="font-medium">{percentage}%</span>
      </div>
    </div>
  )
}
