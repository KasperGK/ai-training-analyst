'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DragHandle } from '@/components/ui/drag-handle'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

interface PMCDataPoint {
  date: string
  ctl: number
  atl: number
  tsb: number
}

interface PMCChartProps {
  data: PMCDataPoint[]
  ctlTrend?: number // Change in CTL over period
}

const chartConfig = {
  ctl: {
    label: 'Fitness (CTL)',
    color: 'hsl(221, 83%, 53%)', // Blue
  },
  atl: {
    label: 'Fatigue (ATL)',
    color: 'hsl(24, 95%, 53%)', // Orange
  },
  tsb: {
    label: 'Form (TSB)',
    color: 'hsl(142, 71%, 45%)', // Green
  },
} satisfies ChartConfig

export function PMCChart({ data, ctlTrend = 0 }: PMCChartProps) {
  const trendUp = ctlTrend > 0

  // Handle empty state
  if (!data || data.length === 0) {
    return (
      <Card className="group h-full flex flex-col relative">
        <DragHandle />
        <CardHeader>
          <CardTitle>Performance Management</CardTitle>
          <CardDescription>
            Fitness, fatigue, and form over the last 6 weeks
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No PMC data available. Connect intervals.icu to see your fitness trends.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="group h-full flex flex-col relative">
      <DragHandle />
      <CardHeader>
        <CardTitle>Performance Management</CardTitle>
        <CardDescription>
          Fitness, fatigue, and form over the last 6 weeks
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <AreaChart
            accessibilityLayer
            data={data}
            margin={{
              left: 12,
              right: 12,
              top: 12,
            }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              domain={['auto', 'auto']}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Area
              dataKey="tsb"
              type="monotone"
              fill="var(--color-tsb)"
              fillOpacity={0.2}
              stroke="var(--color-tsb)"
              strokeWidth={2}
            />
            <Area
              dataKey="atl"
              type="monotone"
              fill="var(--color-atl)"
              fillOpacity={0.2}
              stroke="var(--color-atl)"
              strokeWidth={2}
            />
            <Area
              dataKey="ctl"
              type="monotone"
              fill="var(--color-ctl)"
              fillOpacity={0.3}
              stroke="var(--color-ctl)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-start gap-2 text-sm">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 font-medium leading-none">
              {trendUp ? (
                <>
                  Fitness up {Math.abs(ctlTrend)} points this week{' '}
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </>
              ) : ctlTrend < 0 ? (
                <>
                  Fitness down {Math.abs(ctlTrend)} points this week{' '}
                  <TrendingDown className="h-4 w-4 text-red-500" />
                </>
              ) : (
                <>Fitness stable this week</>
              )}
            </div>
            <div className="flex items-center gap-2 leading-none text-muted-foreground">
              Based on your training load
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  )
}

