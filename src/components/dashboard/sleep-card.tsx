'use client'

import { Moon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { DragHandle } from '@/components/ui/drag-handle'
import { cn } from '@/lib/utils'

interface SleepCardProps {
  sleepSeconds?: number | null
  sleepScore?: number | null
  className?: string
}

function formatSleepDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

function getSleepStatus(score: number | null | undefined): 'good' | 'warning' | 'bad' | 'neutral' {
  if (score == null) return 'neutral'
  if (score >= 80) return 'good'
  if (score >= 60) return 'warning'
  return 'bad'
}

function getSleepDescription(score: number | null | undefined): string {
  if (score == null) return 'No sleep data'
  if (score >= 80) return 'Excellent recovery'
  if (score >= 60) return 'Moderate recovery'
  return 'Poor recovery'
}

export function SleepCard({ sleepSeconds, sleepScore, className }: SleepCardProps) {
  const statusColors = {
    good: 'text-green-600',
    warning: 'text-amber-500',
    bad: 'text-red-500',
    neutral: 'text-foreground',
  }

  const status = getSleepStatus(sleepScore)
  const hasSleepData = sleepSeconds != null && sleepSeconds > 0

  return (
    <Card
      className={cn(
        'group h-full flex flex-col p-5 relative',
        className
      )}
    >
      <DragHandle />
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Sleep
        </span>
        <Moon className="h-4 w-4 text-muted-foreground/50" />
      </div>

      <div className="flex-1 flex items-center justify-center">
        <span className={cn('text-5xl font-semibold tabular-nums tracking-tight', statusColors[status])}>
          {hasSleepData ? formatSleepDuration(sleepSeconds) : '—'}
        </span>
      </div>

      <div className="h-10 text-center">
        {sleepScore != null ? (
          <p className="text-xs text-muted-foreground">
            Sleep score: <span className={statusColors[status]}>{sleepScore}</span> · {getSleepDescription(sleepScore)}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">No sleep data available</p>
        )}
      </div>
    </Card>
  )
}
