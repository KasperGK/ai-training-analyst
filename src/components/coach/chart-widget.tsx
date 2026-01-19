'use client'

/**
 * ChartWidget - Wrapper component for chart display in the canvas
 *
 * Handles data fetching and renders the OverlayChart for session metrics.
 */

import { OverlayChart } from '@/components/charts/overlay-chart'
import { useSessionChart } from '@/hooks/use-session-chart'
import { Skeleton } from '@/components/ui/skeleton'
import type { ChartConfig, ChartMetric } from '@/lib/widgets/types'
import { AlertCircle } from 'lucide-react'

interface ChartWidgetProps {
  config: ChartConfig
}

export function ChartWidget({ config }: ChartWidgetProps) {
  const { data, activity, averages, loading, error } = useSessionChart(
    config.sessionId,
    true
  )

  // Filter metrics to only those requested
  const requestedMetrics = config.metrics || ['power', 'heartRate']

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-destructive bg-destructive/10 rounded-lg">
        <AlertCircle className="h-4 w-4" />
        <span>{error}</span>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
        No stream data available for this session
      </div>
    )
  }

  // Filter data to time range if specified
  let chartData = data
  if (config.timeRange) {
    chartData = data.filter(
      point => point.time >= config.timeRange!.start && point.time <= config.timeRange!.end
    )
  }

  return (
    <div>
      {activity && (
        <div className="mb-2 text-sm text-muted-foreground">
          {activity.name || 'Workout'} • {new Date(activity.date).toLocaleDateString()}
        </div>
      )}
      <OverlayChart
        data={chartData}
        metrics={requestedMetrics}
        averages={averages}
        annotations={config.annotations}
      />
    </div>
  )
}
