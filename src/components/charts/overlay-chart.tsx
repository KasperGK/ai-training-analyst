'use client'

/**
 * OverlayChart - Dual Y-axis chart for power + HR overlays
 *
 * Displays multiple metrics (power, HR, cadence) on the same time axis
 * with dual Y-axes for different scales.
 */

import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from 'recharts'
import { Card } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { ChartMetric, ChartAnnotation } from '@/lib/widgets/types'

export interface OverlayDataPoint {
  time: number
  power?: number
  heartRate?: number
  cadence?: number
  speed?: number
  altitude?: number
}

interface MetricConfig {
  key: ChartMetric
  name: string
  color: string
  unit: string
  yAxisId: 'left' | 'right'
  type: 'line' | 'area'
}

const METRIC_CONFIGS: Record<ChartMetric, Omit<MetricConfig, 'key'>> = {
  power: {
    name: 'Power',
    color: 'hsl(221, 83%, 53%)', // Blue
    unit: 'W',
    yAxisId: 'left',
    type: 'area',
  },
  heartRate: {
    name: 'Heart Rate',
    color: 'hsl(0, 84%, 60%)', // Red
    unit: 'bpm',
    yAxisId: 'right',
    type: 'line',
  },
  cadence: {
    name: 'Cadence',
    color: 'hsl(142, 71%, 45%)', // Green
    unit: 'rpm',
    yAxisId: 'right',
    type: 'line',
  },
  speed: {
    name: 'Speed',
    color: 'hsl(45, 93%, 47%)', // Yellow/Orange
    unit: 'km/h',
    yAxisId: 'right',
    type: 'line',
  },
  altitude: {
    name: 'Altitude',
    color: 'hsl(280, 65%, 60%)', // Purple
    unit: 'm',
    yAxisId: 'right',
    type: 'area',
  },
}

interface OverlayChartProps {
  data: OverlayDataPoint[]
  metrics: ChartMetric[]
  annotations?: ChartAnnotation[]
  averages?: Partial<Record<ChartMetric, number>>
  className?: string
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}`
  }
  return `${minutes}m`
}

function getDataKey(metric: ChartMetric): keyof OverlayDataPoint {
  return metric as keyof OverlayDataPoint
}

export function OverlayChart({
  data,
  metrics,
  annotations,
  averages,
  className,
}: OverlayChartProps) {
  // Build chart config for the UI chart system
  const chartConfig = metrics.reduce((acc, metric) => {
    const config = METRIC_CONFIGS[metric]
    acc[metric] = {
      label: config.name,
      color: config.color,
    }
    return acc
  }, {} as ChartConfig)

  // Determine which Y-axes are needed
  const leftAxisMetrics = metrics.filter(m => METRIC_CONFIGS[m].yAxisId === 'left')
  const rightAxisMetrics = metrics.filter(m => METRIC_CONFIGS[m].yAxisId === 'right')
  const hasLeftAxis = leftAxisMetrics.length > 0
  const hasRightAxis = rightAxisMetrics.length > 0

  if (!data || data.length === 0) {
    return (
      <Card className="p-4">
        <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
          No stream data available
        </div>
      </Card>
    )
  }

  return (
    <div className={className}>
      {/* Stats row */}
      <div className="flex flex-wrap gap-4 mb-4 text-xs">
        {metrics.map(metric => {
          const config = METRIC_CONFIGS[metric]
          const avg = averages?.[metric]
          if (avg === undefined) return null
          return (
            <div key={metric} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: config.color }}
              />
              <span className="text-muted-foreground">
                Avg {config.name}:{' '}
                <span className="font-semibold text-foreground tabular-nums">
                  {Math.round(avg)}{config.unit}
                </span>
              </span>
            </div>
          )
        })}
      </div>

      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <ComposedChart
          data={data}
          margin={{ left: 0, right: hasRightAxis ? 0 : 20, top: 10, bottom: 0 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" />

          {/* X-axis: Time */}
          <XAxis
            dataKey="time"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={formatTime}
            interval="preserveStartEnd"
            minTickGap={50}
          />

          {/* Left Y-axis (typically power) */}
          {hasLeftAxis && (
            <YAxis
              yAxisId="left"
              orientation="left"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={50}
              domain={['dataMin - 20', 'dataMax + 20']}
              label={{
                value: leftAxisMetrics.map(m => METRIC_CONFIGS[m].unit).join('/'),
                angle: -90,
                position: 'insideLeft',
                style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))' },
              }}
            />
          )}

          {/* Right Y-axis (typically HR) */}
          {hasRightAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={50}
              domain={['dataMin - 10', 'dataMax + 10']}
              label={{
                value: rightAxisMetrics.map(m => METRIC_CONFIGS[m].unit).join('/'),
                angle: 90,
                position: 'insideRight',
                style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))' },
              }}
            />
          )}

          {/* Annotations */}
          {annotations?.map(ann => (
            <ReferenceLine
              key={ann.id}
              x={ann.x}
              yAxisId={hasLeftAxis ? 'left' : 'right'}
              stroke={ann.color || '#666'}
              strokeDasharray="5 5"
              label={{
                value: ann.label,
                position: 'top',
                fill: 'hsl(var(--muted-foreground))',
                fontSize: 10,
              }}
            />
          ))}

          {/* Render metrics as lines or areas */}
          {metrics.map(metric => {
            const config = METRIC_CONFIGS[metric]
            const dataKey = getDataKey(metric)

            if (config.type === 'area') {
              return (
                <Area
                  key={metric}
                  yAxisId={config.yAxisId}
                  type="monotone"
                  dataKey={dataKey}
                  stroke={config.color}
                  fill={config.color}
                  fillOpacity={0.15}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                  name={config.name}
                />
              )
            }

            return (
              <Line
                key={metric}
                yAxisId={config.yAxisId}
                type="monotone"
                dataKey={dataKey}
                stroke={config.color}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
                name={config.name}
              />
            )
          })}

          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(value) => formatTime(value as number)}
                formatter={(value, name) => {
                  const metric = metrics.find(m => METRIC_CONFIGS[m].name === name)
                  const unit = metric ? METRIC_CONFIGS[metric].unit : ''
                  return [`${Math.round(value as number)}${unit}`, name as string]
                }}
              />
            }
          />

          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value) => <span className="text-xs">{value}</span>}
          />
        </ComposedChart>
      </ChartContainer>
    </div>
  )
}
