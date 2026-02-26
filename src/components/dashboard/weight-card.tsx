'use client'

import { useEffect, useState } from 'react'
import { Weight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { DragHandle } from '@/components/ui/drag-handle'
import { cn } from '@/lib/utils'
import type { BodyMeasurement } from '@/lib/db/body-measurements'

interface WeightData {
  latest: BodyMeasurement | null
  trend: { date: string; weight_kg: number }[]
  change_kg: number | null
}

export function WeightCard() {
  const [data, setData] = useState<WeightData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/body-measurements')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch')
        return res.json()
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Card className="h-full flex flex-col p-5 relative">
        <DragHandle />
        <div className="flex items-start justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Weight</span>
          <Weight className="h-4 w-4 text-muted-foreground/50" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-16 bg-muted animate-pulse rounded" />
        </div>
        <div className="h-10" />
      </Card>
    )
  }

  if (!data?.latest?.weight_kg) {
    return (
      <Card className="h-full flex flex-col p-5 relative">
        <DragHandle />
        <div className="flex items-start justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Weight</span>
          <Weight className="h-4 w-4 text-muted-foreground/50" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-2xl font-bold text-muted-foreground/50">--</span>
        </div>
        <div className="h-10 text-center">
          <p className="text-xs text-muted-foreground">Connect Withings to track weight</p>
        </div>
      </Card>
    )
  }

  const weight = data.latest.weight_kg
  const changeKg = data.change_kg
  const fatPercent = data.latest.fat_ratio_percent

  const trend = changeKg !== null && changeKg !== 0
    ? (changeKg < 0 ? 'down' : 'up')
    : 'stable'

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  return (
    <Card className="group h-full flex flex-col p-5 relative">
      <DragHandle />
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Weight</span>
        <Weight className="h-4 w-4 text-muted-foreground/50" />
      </div>

      <div className="flex-1 flex items-center justify-center">
        <span className="text-3xl font-bold tabular-nums tracking-tight">
          {weight.toFixed(1)}
          <span className="text-base font-normal text-muted-foreground ml-1">kg</span>
        </span>
      </div>

      <div className="h-10 text-center">
        {fatPercent != null && (
          <p className="text-xs text-muted-foreground">
            Body fat: {fatPercent.toFixed(1)}%
          </p>
        )}
      </div>

      {changeKg !== null && changeKg !== 0 && (
        <div className={cn(
          'absolute bottom-3 left-3 flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded',
          trend === 'down' && 'bg-green-500/10 text-green-600',
          trend === 'up' && 'bg-amber-500/10 text-amber-600',
          trend === 'stable' && 'bg-muted text-muted-foreground'
        )}>
          <TrendIcon className="h-3 w-3" />
          <span>{changeKg > 0 ? '+' : ''}{changeKg.toFixed(1)} kg</span>
        </div>
      )}
    </Card>
  )
}
