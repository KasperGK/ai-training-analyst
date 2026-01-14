'use client'

import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceLine,
  ReferenceArea,
} from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Badge } from '@/components/ui/badge'
import { Trophy } from 'lucide-react'
import type { ProjectedFitness } from '@/lib/fitness/projector'

interface FitnessProjectionChartProps {
  projections: ProjectedFitness[]
  compact?: boolean
}

const chartConfig = {
  projectedCtl: {
    label: 'Fitness (CTL)',
    color: 'hsl(221, 83%, 53%)', // Blue
  },
  projectedAtl: {
    label: 'Fatigue (ATL)',
    color: 'hsl(24, 95%, 53%)', // Orange
  },
  projectedTsb: {
    label: 'Form (TSB)',
    color: 'hsl(142, 71%, 45%)', // Green
  },
} satisfies ChartConfig

function getTsbStatus(tsb: number): { label: string; color: string } {
  if (tsb >= 5 && tsb <= 25) {
    return { label: 'Peak Form', color: 'text-green-500' }
  } else if (tsb > 25) {
    return { label: 'Detrained', color: 'text-yellow-500' }
  } else if (tsb > -10) {
    return { label: 'Neutral', color: 'text-blue-500' }
  } else if (tsb > -25) {
    return { label: 'Tired', color: 'text-orange-500' }
  } else {
    return { label: 'Exhausted', color: 'text-red-500' }
  }
}

export function FitnessProjectionChart({
  projections,
  compact = false,
}: FitnessProjectionChartProps) {
  // Get event days for markers
  const eventDays = useMemo(
    () => projections.filter(p => p.isEventDay),
    [projections]
  )

  // Find today's position
  const today = new Date().toISOString().split('T')[0]
  const todayIndex = projections.findIndex(p => p.date === today)

  if (projections.length === 0) {
    return (
      <Card className={compact ? 'h-full' : ''}>
        <CardHeader className={compact ? 'pb-2' : ''}>
          <CardTitle className={compact ? 'text-base' : ''}>Fitness Projection</CardTitle>
          <CardDescription>
            Projected CTL, ATL, and TSB based on planned workouts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            No projection data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={compact ? 'h-full' : ''}>
      <CardHeader className={compact ? 'pb-2' : ''}>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className={compact ? 'text-base' : ''}>Fitness Projection</CardTitle>
            <CardDescription>
              Projected CTL, ATL, and TSB based on planned workouts
            </CardDescription>
          </div>
          {eventDays.length > 0 && (
            <div className="flex items-center gap-2">
              {eventDays.slice(0, 2).map(event => {
                const status = getTsbStatus(event.projectedTsb)
                return (
                  <Badge
                    key={event.date}
                    variant="outline"
                    className="flex items-center gap-1"
                  >
                    <Trophy className="h-3 w-3" />
                    <span className="truncate max-w-[80px]">{event.eventName}</span>
                    <span className={status.color}>
                      TSB {event.projectedTsb > 0 ? '+' : ''}{Math.round(event.projectedTsb)}
                    </span>
                  </Badge>
                )
              })}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className={compact ? 'pb-2' : ''}>
        <ChartContainer config={chartConfig} className={compact ? 'h-[180px]' : 'h-[250px]'}>
          <AreaChart
            data={projections}
            margin={{
              top: 10,
              right: 10,
              left: 0,
              bottom: 0,
            }}
          >
            <defs>
              <linearGradient id="fillCtl" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillAtl" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(24, 95%, 53%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(24, 95%, 53%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={40}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    const date = new Date(value)
                    return date.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })
                  }}
                />
              }
            />

            {/* Optimal TSB zone (5-25) */}
            <ReferenceArea
              y1={5}
              y2={25}
              fill="hsl(142, 71%, 45%)"
              fillOpacity={0.1}
              strokeOpacity={0}
            />

            {/* Today marker */}
            {todayIndex >= 0 && (
              <ReferenceLine
                x={today}
                stroke="hsl(0, 0%, 50%)"
                strokeDasharray="3 3"
                label={{ value: 'Today', position: 'top', fontSize: 10 }}
              />
            )}

            {/* Event markers */}
            {eventDays.map(event => (
              <ReferenceLine
                key={event.date}
                x={event.date}
                stroke={event.eventPriority === 'A' ? 'hsl(38, 92%, 50%)' : 'hsl(0, 0%, 60%)'}
                strokeWidth={2}
              />
            ))}

            <Area
              type="monotone"
              dataKey="projectedCtl"
              stroke="hsl(221, 83%, 53%)"
              fill="url(#fillCtl)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="projectedAtl"
              stroke="hsl(24, 95%, 53%)"
              fill="url(#fillAtl)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="projectedTsb"
              stroke="hsl(142, 71%, 45%)"
              fill="none"
              strokeWidth={2}
              strokeDasharray="5 5"
            />
          </AreaChart>
        </ChartContainer>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-blue-500" />
            <span>CTL</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-orange-500" />
            <span>ATL</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-green-500 border-dashed" style={{ borderTopWidth: 2, borderStyle: 'dashed' }} />
            <span>TSB</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500/10 border border-green-500/30" />
            <span>Peak Zone</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
