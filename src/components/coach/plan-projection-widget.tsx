'use client'

/**
 * Plan Projection Widget
 *
 * Recharts line chart showing projected CTL, ATL, and TSB through a training plan.
 * Features:
 * - CTL (blue line), ATL (red line), TSB (green fill area)
 * - Event date vertical marker
 * - Current fitness as starting point
 * - Optimal TSB zone shaded (-10 to +5)
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
  Area,
  ComposedChart,
  ResponsiveContainer,
} from 'recharts'

interface ProjectionPoint {
  date: string
  ctl: number
  atl: number
  tsb: number
  tss: number
  isEvent?: boolean
  isTaper?: boolean
  phase?: string
}

interface FitnessSnapshot {
  ctl: number
  atl: number
  tsb: number
}

export interface PlanProjectionData {
  projection: {
    points: ProjectionPoint[]
    startFitness: FitnessSnapshot
    endFitness: FitnessSnapshot
    peakCTL: number
    peakCTLDate: string
    ctlGain: number
    eventFitness?: {
      date: string
      ctl: number
      atl: number
      tsb: number
    }
  }
  planId: string | null
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload || !label) return null

  return (
    <div className="bg-popover border rounded-lg shadow-md p-2 text-xs">
      <p className="font-medium mb-1">{formatDate(label)}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {Math.round(entry.value)}
        </p>
      ))}
    </div>
  )
}

export function PlanProjectionWidget({ data }: { data: PlanProjectionData }) {
  const { projection } = data

  if (!projection?.points || projection.points.length === 0) {
    return <p className="text-muted-foreground text-sm">No projection data available</p>
  }

  const { points, startFitness, endFitness, ctlGain, eventFitness, peakCTL } = projection

  // Sample points for X-axis labels (every 7th point)
  const sampledPoints = points.filter((_, i) => i % 7 === 0 || i === points.length - 1)
  const tickDates = sampledPoints.map(p => p.date)

  // Find event point
  const eventPoint = points.find(p => p.isEvent)

  // Calculate Y-axis domain
  const allValues = points.flatMap(p => [p.ctl, p.atl, p.tsb])
  const minY = Math.min(...allValues, -15) - 5
  const maxY = Math.max(...allValues, peakCTL) + 10

  return (
    <div className="space-y-3">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase">Start CTL</p>
          <p className="text-sm font-semibold">{startFitness.ctl}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase">End CTL</p>
          <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">{endFitness.ctl}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase">CTL Gain</p>
          <p className={`text-sm font-semibold ${ctlGain >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {ctlGain >= 0 ? '+' : ''}{ctlGain}
          </p>
        </div>
      </div>

      {eventFitness && (
        <div className="flex items-center justify-center gap-4 text-xs bg-amber-50 dark:bg-amber-950/30 rounded-md py-1.5 px-3">
          <span className="text-muted-foreground">Event day:</span>
          <span>CTL {eventFitness.ctl}</span>
          <span>TSB {eventFitness.tsb}</span>
          <span className={
            eventFitness.tsb >= -10 && eventFitness.tsb <= 15
              ? 'text-green-600 dark:text-green-400 font-medium'
              : 'text-amber-600 dark:text-amber-400'
          }>
            {eventFitness.tsb >= -10 && eventFitness.tsb <= 15
              ? 'Race ready'
              : eventFitness.tsb > 15
                ? 'Very fresh'
                : 'Fatigued'}
          </span>
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={points} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            tickFormatter={formatDate}
            ticks={tickDates}
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            domain={[minY, maxY]}
            width={35}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '10px' }}
            iconSize={8}
          />

          {/* Optimal TSB zone */}
          <ReferenceArea
            y1={-10}
            y2={5}
            fill="#22c55e"
            fillOpacity={0.08}
            label={{ value: 'Optimal TSB', position: 'insideTopRight', fontSize: 9, fill: '#86efac' }}
          />

          {/* Event marker */}
          {eventPoint && (
            <ReferenceLine
              x={eventPoint.date}
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="4 4"
              label={{ value: 'Event', position: 'top', fontSize: 10, fill: '#f59e0b' }}
            />
          )}

          {/* TSB area fill */}
          <Area
            type="monotone"
            dataKey="tsb"
            stroke="none"
            fill="#22c55e"
            fillOpacity={0.15}
            name="TSB"
          />

          {/* TSB line */}
          <Line
            type="monotone"
            dataKey="tsb"
            stroke="#22c55e"
            strokeWidth={1.5}
            dot={false}
            name="TSB"
          />

          {/* CTL line */}
          <Line
            type="monotone"
            dataKey="ctl"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            name="CTL (Fitness)"
          />

          {/* ATL line */}
          <Line
            type="monotone"
            dataKey="atl"
            stroke="#ef4444"
            strokeWidth={1.5}
            dot={false}
            name="ATL (Fatigue)"
            strokeDasharray="4 4"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
