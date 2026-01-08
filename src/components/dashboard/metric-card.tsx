'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className={cn('text-4xl tabular-nums', statusColors[status])}>
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
      {trend && (
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className={cn('flex items-center gap-1 font-medium', trendColor)}>
            <TrendIcon className="h-4 w-4" />
            {trendValue || (trend === 'up' ? 'Trending up' : trend === 'down' ? 'Trending down' : 'Stable')}
          </div>
        </CardFooter>
      )}
    </Card>
  )
}
