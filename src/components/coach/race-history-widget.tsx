'use client'

/**
 * Race History Widget
 *
 * Displays a timeline chart showing:
 * - Placement over time (line chart)
 * - Category indicators
 * - CTL/TSB overlay bands
 */

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Trophy, TrendingUp, TrendingDown, Minus, Target } from 'lucide-react'

export interface RaceHistoryData {
  races: Array<{
    id: string
    name: string
    date: string
    placement: number
    totalInCategory: number
    category: string
    avgPower?: number
    avgWkg?: number
    tsbAtRace?: number
    ctlAtRace?: number
    raceType?: 'flat' | 'hilly' | 'mixed' | 'tt'
  }>
  summary?: {
    totalRaces: number
    avgPlacement: number | null
    avgPlacementPercent: number | null
    placementTrend: 'improving' | 'stable' | 'declining'
    categoryProgression: string[] | null
  }
}

interface RaceHistoryWidgetProps {
  data: RaceHistoryData
}

const categoryColors: Record<string, string> = {
  A: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  B: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  C: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  D: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  E: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
}

const raceTypeIcons: Record<string, string> = {
  flat: '🏁',
  hilly: '⛰️',
  mixed: '🔀',
  tt: '⏱️',
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function TrendIcon({ trend }: { trend: 'improving' | 'stable' | 'declining' }) {
  switch (trend) {
    case 'improving':
      return <TrendingUp className="h-4 w-4 text-green-500" />
    case 'declining':
      return <TrendingDown className="h-4 w-4 text-red-500" />
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null

  const data = payload[0].payload
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
      <div className="font-medium mb-1">{data.name}</div>
      <div className="text-muted-foreground text-xs mb-2">{formatDate(data.date)}</div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Position:</span>
          <span className="font-medium">
            {data.placement}/{data.totalInCategory}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Category:</span>
          <Badge variant="secondary" className={categoryColors[data.category]}>
            {data.category}
          </Badge>
        </div>
        {data.avgPower && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Avg Power:</span>
            <span className="font-mono">{data.avgPower}W</span>
          </div>
        )}
        {data.avgWkg && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">W/kg:</span>
            <span className="font-mono">{data.avgWkg.toFixed(2)}</span>
          </div>
        )}
        {data.tsbAtRace !== undefined && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Form (TSB):</span>
            <span className={`font-mono ${data.tsbAtRace >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {data.tsbAtRace > 0 ? '+' : ''}{data.tsbAtRace}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export function RaceHistoryWidget({ data }: RaceHistoryWidgetProps) {
  // Transform races for chart
  const chartData = useMemo(() => {
    if (!data.races) return []
    return data.races
      .map(race => ({
        ...race,
        // Convert placement to percentage for better visualization
        placementPercent: race.totalInCategory > 0
          ? Math.round((race.placement / race.totalInCategory) * 100)
          : 0,
        // Display date for axis
        displayDate: formatDate(race.date),
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [data.races])

  if (!data.races || data.races.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-center">
        <Trophy className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">No race data available</p>
        <p className="text-xs text-muted-foreground mt-1">
          Connect ZwiftPower to track your race history
        </p>
      </div>
    )
  }

  const { summary } = data

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{summary.totalRaces}</div>
            <div className="text-xs text-muted-foreground">Total Races</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{summary.avgPlacement ?? '-'}</div>
            <div className="text-xs text-muted-foreground">Avg Position</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {summary.avgPlacementPercent !== null ? `${summary.avgPlacementPercent}%` : '-'}
            </div>
            <div className="text-xs text-muted-foreground">Avg Percentile</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <TrendIcon trend={summary.placementTrend} />
              <span className="text-sm capitalize">{summary.placementTrend}</span>
            </div>
            <div className="text-xs text-muted-foreground">Trend</div>
          </div>
        </div>
      )}

      {/* Category Progression */}
      {summary?.categoryProgression && summary.categoryProgression.length > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <Target className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Category progression:</span>
          <div className="flex items-center gap-1">
            {summary.categoryProgression.map((cat, idx) => (
              <span key={idx} className="flex items-center gap-1">
                <Badge variant="secondary" className={categoryColors[cat]}>
                  {cat}
                </Badge>
                {idx < summary.categoryProgression!.length - 1 && (
                  <span className="text-muted-foreground">→</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="displayDate"
              tick={{ fontSize: 11 }}
              tickLine={false}
              className="text-muted-foreground"
            />
            <YAxis
              yAxisId="left"
              reversed
              domain={[1, 'dataMax']}
              tick={{ fontSize: 11 }}
              tickLine={false}
              label={{
                value: 'Position',
                angle: -90,
                position: 'insideLeft',
                className: 'text-muted-foreground fill-muted-foreground',
                fontSize: 11,
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[-30, 30]}
              tick={{ fontSize: 11 }}
              tickLine={false}
              label={{
                value: 'TSB',
                angle: 90,
                position: 'insideRight',
                className: 'text-muted-foreground fill-muted-foreground',
                fontSize: 11,
              }}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* TSB Reference Lines */}
            <ReferenceLine yAxisId="right" y={0} stroke="#888" strokeDasharray="3 3" />
            <ReferenceLine yAxisId="right" y={10} stroke="#22c55e" strokeDasharray="2 2" opacity={0.5} />
            <ReferenceLine yAxisId="right" y={-10} stroke="#ef4444" strokeDasharray="2 2" opacity={0.5} />

            {/* TSB Area (if data available) */}
            {chartData.some(d => d.tsbAtRace !== undefined) && (
              <Area
                yAxisId="right"
                dataKey="tsbAtRace"
                fill="#3b82f6"
                fillOpacity={0.1}
                stroke="#3b82f6"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            )}

            {/* Placement Line */}
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="placement"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#8b5cf6' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Races List */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Recent Races</h4>
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {chartData.slice(-5).reverse().map((race) => (
            <div
              key={race.id}
              className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                {race.raceType && (
                  <span className="text-lg">{raceTypeIcons[race.raceType]}</span>
                )}
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{race.name}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(race.date)}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Badge variant="secondary" className={categoryColors[race.category]}>
                  {race.category}
                </Badge>
                <div className="text-right">
                  <div className="font-bold">
                    P{race.placement}
                    <span className="text-muted-foreground font-normal">/{race.totalInCategory}</span>
                  </div>
                  {race.avgWkg && (
                    <div className="text-xs text-muted-foreground">
                      {race.avgWkg.toFixed(2)} W/kg
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
