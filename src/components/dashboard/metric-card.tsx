'use client'

import { TrendingUp, TrendingDown, Minus, Activity, Flame, Heart, Calendar } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: number | string
  description?: string
  trend?: 'up' | 'down' | 'stable'
  trendValue?: string
  status?: 'good' | 'warning' | 'bad' | 'neutral'
  className?: string
}

const iconMap: Record<string, React.ElementType> = {
  'Fitness (CTL)': Activity,
  'Fatigue (ATL)': Flame,
  'Form (TSB)': Heart,
  'Next Event': Calendar,
}

export function MetricCard({
  title,
  value,
  description,
  trend,
  trendValue,
  status = 'neutral',
  className,
}: MetricCardProps) {
  const statusColors = {
    good: 'text-green-600',
    warning: 'text-amber-500',
    bad: 'text-red-500',
    neutral: 'text-foreground',
  }

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
  const Icon = iconMap[title] || Activity

  return (
    <Card className={cn('aspect-square flex flex-col p-5 relative', className)}>
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </span>
        <Icon className="h-4 w-4 text-muted-foreground/50" />
      </div>

      <div className="flex-1 flex items-center justify-center">
        <span className={cn('text-5xl font-semibold tabular-nums tracking-tight', statusColors[status])}>
          {value}
        </span>
      </div>

      <div className="h-10 text-center">
        {description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
        )}
      </div>

      {trend && trend !== 'stable' && (
        <div className={cn(
          'absolute bottom-3 left-3 flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded',
          trend === 'up' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
        )}>
          <TrendIcon className="h-3 w-3" />
          <span>{trendValue || (trend === 'up' ? '+' : '-')}</span>
        </div>
      )}
    </Card>
  )
}
