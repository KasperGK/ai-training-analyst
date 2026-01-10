'use client'

import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import { Card } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

interface StreamChartProps {
  title: string
  data: { time: number; value: number }[]
  color: string
  unit: string
  average?: number
  max?: number
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}`
  }
  return `${minutes}m`
}

export function StreamChart({ title, data, color, unit, average, max }: StreamChartProps) {
  const chartConfig = {
    value: {
      label: title,
      color: color,
    },
  } satisfies ChartConfig

  if (!data || data.length === 0) {
    return (
      <Card className="p-4">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</span>
        <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
          No stream data available
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</span>
        <div className="flex gap-4 text-xs text-muted-foreground">
          {average !== undefined && (
            <span>
              Avg: <span className="font-semibold text-foreground tabular-nums">{Math.round(average)}{unit}</span>
            </span>
          )}
        </div>
      </div>
      <div>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <AreaChart
            data={data}
            margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={formatTime}
              interval="preserveStartEnd"
              minTickGap={50}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={40}
              domain={['dataMin - 10', 'dataMax + 10']}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => formatTime(value as number)}
                  formatter={(value) => [`${value}${unit}`, title]}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fill={color}
              fillOpacity={0.3}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      </div>
    </Card>
  )
}
