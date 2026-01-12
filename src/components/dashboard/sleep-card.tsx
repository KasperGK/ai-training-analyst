'use client'

import { useRouter } from 'next/navigation'
import { Moon } from 'lucide-react'
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts'
import { Card } from '@/components/ui/card'
import { DragHandle, wasDragging } from '@/components/ui/drag-handle'
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

function getStatusColor(status: 'good' | 'warning' | 'bad' | 'neutral'): string {
  switch (status) {
    case 'good': return 'hsl(142, 71%, 45%)' // green
    case 'warning': return 'hsl(38, 92%, 50%)' // amber
    case 'bad': return 'hsl(0, 84%, 60%)' // red
    default: return 'hsl(221, 83%, 53%)' // blue
  }
}

function getSleepDescription(score: number | null | undefined): string {
  if (score == null) return 'No data'
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  return 'Poor'
}

export function SleepCard({ sleepSeconds, sleepScore, className }: SleepCardProps) {
  const router = useRouter()

  const handleClick = () => {
    if (wasDragging()) return
    router.push('/recovery')
  }

  const status = getSleepStatus(sleepScore)
  const statusColor = getStatusColor(status)
  const hasSleepData = sleepSeconds != null && sleepSeconds > 0
  const hasScore = sleepScore != null

  const chartData = [
    {
      name: 'score',
      value: sleepScore ?? 0,
      fill: statusColor,
    }
  ]

  return (
    <Card
      className={cn(
        'group h-full flex flex-col p-5 relative cursor-pointer hover:border-primary/50 transition-colors overflow-hidden',
        className
      )}
      onClick={handleClick}
    >
      <DragHandle />
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Sleep
        </span>
        <Moon className="h-4 w-4 text-muted-foreground/50" />
      </div>

      {/* Centered radial chart */}
      <div className="flex-1 flex items-center justify-center">
        <div className="relative">
          <RadialBarChart
            width={150}
            height={150}
            cx={75}
            cy={75}
            innerRadius={55}
            outerRadius={68}
            barSize={10}
            data={hasScore ? chartData : [{ name: 'empty', value: 0, fill: 'transparent' }]}
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
              background={{ fill: '#f3f4f6' }}
              dataKey="value"
              cornerRadius={8}
              angleAxisId={0}
            />
          </RadialBarChart>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold tabular-nums tracking-tight">
              {hasScore ? sleepScore : '—'}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {getSleepDescription(sleepScore)}
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center shrink-0 mt-2">
        <p className="text-sm font-medium tabular-nums">
          {hasSleepData ? formatSleepDuration(sleepSeconds) : 'No sleep data'}
        </p>
        <p className="text-xs text-muted-foreground">
          Last night
        </p>
      </div>
    </Card>
  )
}
