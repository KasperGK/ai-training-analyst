'use client'

import { useMemo, useState } from 'react'
import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceLine,
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
import { Button } from '@/components/ui/button'
import type { PowerCurvePoint } from '@/app/api/power-curve/route'

interface PowerCurveChartProps {
  powerCurve: PowerCurvePoint[]
  weightKg: number | null
  ftp: number | null
}

const chartConfig = {
  power: {
    label: 'Power',
    color: 'hsl(221, 83%, 53%)',
  },
} satisfies ChartConfig

// Key durations for reference lines
const KEY_DURATIONS = [
  { seconds: 60, label: '1min' },
  { seconds: 300, label: '5min' },
  { seconds: 1200, label: '20min' },
]

export function PowerCurveChart({
  powerCurve,
  weightKg,
  ftp,
}: PowerCurveChartProps) {
  const [showWkg, setShowWkg] = useState(false)

  // Transform data based on display mode
  const chartData = useMemo(() => {
    return powerCurve.map(point => ({
      ...point,
      displayValue: showWkg && point.wattsPerKg !== null
        ? point.wattsPerKg
        : point.watts,
      // Use log scale for x-axis positioning
      logDuration: Math.log10(point.duration),
    }))
  }, [powerCurve, showWkg])

  // Check if we can show W/kg
  const canShowWkg = powerCurve.some(p => p.wattsPerKg !== null)

  if (powerCurve.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Power Curve</CardTitle>
          <CardDescription>
            Your personal best power outputs across different durations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
            No power curve data available. Sync your training data to see your power profile.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Power Curve</CardTitle>
            <CardDescription>
              Your personal best power outputs across different durations
            </CardDescription>
          </div>
          {canShowWkg && (
            <div className="flex gap-1">
              <Button
                variant={!showWkg ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowWkg(false)}
              >
                Watts
              </Button>
              <Button
                variant={showWkg ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowWkg(true)}
              >
                W/kg
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[350px] w-full">
          <LineChart
            data={chartData}
            margin={{
              top: 20,
              right: 20,
              left: 10,
              bottom: 20,
            }}
          >
            <defs>
              <linearGradient id="powerGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="durationLabel"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={50}
              tickFormatter={(value) =>
                showWkg ? `${value.toFixed(1)}` : `${value}`
              }
              label={{
                value: showWkg ? 'W/kg' : 'Watts',
                angle: -90,
                position: 'insideLeft',
                style: { textAnchor: 'middle', fontSize: 12 },
              }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name, props) => {
                    const point = props.payload as PowerCurvePoint & { displayValue: number }
                    return (
                      <div className="space-y-1">
                        <div className="font-medium">{point.durationLabel}</div>
                        <div>{point.watts} watts</div>
                        {point.wattsPerKg !== null && (
                          <div>{point.wattsPerKg.toFixed(2)} W/kg</div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {new Date(point.date).toLocaleDateString()}
                        </div>
                      </div>
                    )
                  }}
                />
              }
            />

            {/* Reference lines for key durations */}
            {KEY_DURATIONS.map(({ seconds, label }) => {
              const point = powerCurve.find(p => p.duration === seconds)
              if (!point) return null
              return (
                <ReferenceLine
                  key={seconds}
                  x={label === '1min' ? '1min' : label === '5min' ? '5min' : '20min'}
                  stroke="hsl(0, 0%, 70%)"
                  strokeDasharray="3 3"
                />
              )
            })}

            {/* FTP reference line */}
            {ftp && !showWkg && (
              <ReferenceLine
                y={ftp}
                stroke="hsl(142, 71%, 45%)"
                strokeDasharray="5 5"
                label={{
                  value: `FTP: ${ftp}W`,
                  position: 'right',
                  fontSize: 10,
                  fill: 'hsl(142, 71%, 45%)',
                }}
              />
            )}

            <Line
              type="monotone"
              dataKey="displayValue"
              stroke="hsl(221, 83%, 53%)"
              strokeWidth={3}
              dot={{
                fill: 'hsl(221, 83%, 53%)',
                strokeWidth: 2,
                r: 5,
              }}
              activeDot={{
                r: 7,
                fill: 'hsl(221, 83%, 53%)',
              }}
            />
          </LineChart>
        </ChartContainer>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-blue-500" />
            <span>Power Curve</span>
          </div>
          {ftp && !showWkg && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-green-500 border-dashed" style={{ borderTopWidth: 2, borderStyle: 'dashed' }} />
              <span>FTP ({ftp}W)</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
