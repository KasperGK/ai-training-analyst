'use client'

import { useRouter } from 'next/navigation'
import { TrendingUp, TrendingDown, Minus, Activity, Flame, Heart, Calendar } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { DragHandle, wasDragging } from '@/components/ui/drag-handle'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: number | string
  description?: string
  trend?: 'up' | 'down' | 'stable'
  trendValue?: string
  status?: 'good' | 'warning' | 'bad' | 'neutral'
  className?: string
  href?: string
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
  href,
}: MetricCardProps) {
  const router = useRouter()

  const handleClick = () => {
    // Don't navigate if we just finished dragging
    if (wasDragging() || !href) return
    router.push(href)
  }

  const statusColors = {
    good: 'text-green-600',
    warning: 'text-amber-500',
    bad: 'text-red-500',
    neutral: 'text-foreground',
  }

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const Icon = iconMap[title] || Activity

  return (
    <Card
      className={cn(
        'group h-full flex flex-col p-5 relative',
        href && 'cursor-pointer hover:border-primary/50 transition-colors',
        className
      )}
      onClick={handleClick}
    >
      <DragHandle />
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

      <div className={cn("h-10 text-center", trend && "px-8")}>
        {description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
        )}
      </div>

      {trend && (
        <div className={cn(
          'absolute bottom-3 left-3 flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded',
          trend === 'up' && 'bg-green-500/10 text-green-600',
          trend === 'down' && 'bg-red-500/10 text-red-600',
          trend === 'stable' && 'bg-muted text-muted-foreground'
        )}>
          <TrendIcon className="h-3 w-3" />
          <span>{trendValue || (trend === 'up' ? '+' : trend === 'down' ? '-' : '~')}</span>
        </div>
      )}
    </Card>
  )
}
