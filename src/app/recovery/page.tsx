'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceLine,
  Line,
  ComposedChart,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  Moon,
  Activity,
  Heart,
  Zap,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import type { RecoveryData } from '@/app/api/recovery/route'

const TIME_RANGES = [
  { value: '1w', label: '1 Week', days: 7 },
  { value: '6w', label: '6 Weeks', days: 42 },
  { value: '3m', label: '3 Months', days: 90 },
  { value: '6m', label: '6 Months', days: 180 },
  { value: '1y', label: '1 Year', days: 365 },
]

const sleepChartConfig = {
  sleepHours: {
    label: 'Sleep (hours)',
    color: 'hsl(262, 83%, 58%)', // Purple
  },
  sleepScore: {
    label: 'Sleep Score',
    color: 'hsl(142, 71%, 45%)', // Green
  },
} satisfies ChartConfig

const recoveryChartConfig = {
  hrv: {
    label: 'HRV',
    color: 'hsl(221, 83%, 53%)', // Blue
  },
  restingHR: {
    label: 'Resting HR',
    color: 'hsl(24, 95%, 53%)', // Orange
  },
} satisfies ChartConfig

function formatSleepDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

function getSleepStatus(score: number | null): 'good' | 'warning' | 'bad' | 'neutral' {
  if (score == null) return 'neutral'
  if (score >= 80) return 'good'
  if (score >= 60) return 'warning'
  return 'bad'
}

function getHRVStatus(hrv: number | null, avg: number): 'good' | 'warning' | 'bad' | 'neutral' {
  if (hrv == null || avg === 0) return 'neutral'
  const diff = ((hrv - avg) / avg) * 100
  if (diff >= 5) return 'good'
  if (diff <= -10) return 'bad'
  return 'neutral'
}

function getRestingHRStatus(hr: number | null, avg: number): 'good' | 'warning' | 'bad' | 'neutral' {
  if (hr == null || avg === 0) return 'neutral'
  const diff = hr - avg
  if (diff <= -3) return 'good'
  if (diff >= 5) return 'bad'
  return 'neutral'
}

const CHART_VIEWS = ['sleep', 'recovery'] as const
type ChartView = typeof CHART_VIEWS[number]

export default function RecoveryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('3m')
  const [data, setData] = useState<RecoveryData | null>(null)
  const [chartView, setChartView] = useState<ChartView>('sleep')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const selectedRange = TIME_RANGES.find(r => r.value === timeRange)
      const days = selectedRange?.days || 90

      const res = await fetch(`/api/recovery?days=${days}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (error) {
      console.error('Failed to load recovery data:', error)
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Navigate carousel
  const nextChart = () => {
    const currentIndex = CHART_VIEWS.indexOf(chartView)
    const nextIndex = (currentIndex + 1) % CHART_VIEWS.length
    setChartView(CHART_VIEWS[nextIndex])
  }

  const prevChart = () => {
    const currentIndex = CHART_VIEWS.indexOf(chartView)
    const prevIndex = (currentIndex - 1 + CHART_VIEWS.length) % CHART_VIEWS.length
    setChartView(CHART_VIEWS[prevIndex])
  }

  // Calculate training correlation
  const correlation = useMemo(() => {
    if (!data?.history || !data?.sessions) return null

    const tssByDate = new Map<string, number>()
    for (const s of data.sessions) {
      const existing = tssByDate.get(s.date) || 0
      tssByDate.set(s.date, existing + s.tss)
    }

    const goodSleepDays: string[] = []
    const poorSleepDays: string[] = []

    for (const h of data.history) {
      if (h.sleepHours >= 7) goodSleepDays.push(h.date)
      else if (h.sleepHours > 0 && h.sleepHours < 6) poorSleepDays.push(h.date)
    }

    const tssAfterGoodSleep = goodSleepDays
      .map(d => tssByDate.get(d) || 0)
      .filter(t => t > 0)
    const tssAfterPoorSleep = poorSleepDays
      .map(d => tssByDate.get(d) || 0)
      .filter(t => t > 0)

    if (tssAfterGoodSleep.length < 3 || tssAfterPoorSleep.length < 3) return null

    const avgGood = tssAfterGoodSleep.reduce((a, b) => a + b, 0) / tssAfterGoodSleep.length
    const avgPoor = tssAfterPoorSleep.reduce((a, b) => a + b, 0) / tssAfterPoorSleep.length
    const difference = Math.round(((avgGood - avgPoor) / avgPoor) * 100)

    return {
      avgGood: Math.round(avgGood),
      avgPoor: Math.round(avgPoor),
      difference,
      goodSleepCount: goodSleepDays.length,
      poorSleepCount: poorSleepDays.length,
    }
  }, [data])

  const statusColors = {
    good: 'text-green-600',
    warning: 'text-amber-500',
    bad: 'text-red-500',
    neutral: 'text-foreground',
  }

  // Sample data for charts based on time range
  const chartData = useMemo(() => {
    if (!data?.history) return []
    const sampleRate = timeRange === '1w' ? 1 : timeRange === '6w' ? 1 : timeRange === '3m' ? 2 : timeRange === '6m' ? 4 : 7
    return data.history.filter((_, i) => i % sampleRate === 0 || i === data.history.length - 1)
  }, [data?.history, timeRange])

  const chartTitle = chartView === 'sleep' ? 'Sleep Trends' : 'Recovery Metrics'
  const chartDescription = chartView === 'sleep'
    ? 'Sleep duration and quality score over time'
    : 'Heart rate variability and resting heart rate trends'

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Header */}
      <header className="border-b bg-background px-6 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back to Dashboard</span>
            </Button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Sleep & Recovery</h1>
              <p className="text-sm text-muted-foreground">
                Track your sleep patterns and recovery metrics
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 py-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Current Status Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Sleep Card */}
            <Card className="p-5">
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Sleep
                </span>
                <Moon className="h-4 w-4 text-muted-foreground/50" />
              </div>
              {loading ? (
                <Skeleton className="h-10 w-20 mx-auto" />
              ) : (
                <>
                  <div className="text-center mb-2">
                    <span className={`text-4xl font-semibold tabular-nums tracking-tight ${statusColors[getSleepStatus(data?.current.sleepScore ?? null)]}`}>
                      {formatSleepDuration(data?.current.sleepSeconds ?? null)}
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">
                      Score: {data?.current.sleepScore ?? '—'} · Avg: {data?.averages.sleepHours}h
                    </p>
                  </div>
                </>
              )}
            </Card>

            {/* HRV Card */}
            <Card className="p-5">
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  HRV
                </span>
                <Activity className="h-4 w-4 text-muted-foreground/50" />
              </div>
              {loading ? (
                <Skeleton className="h-10 w-20 mx-auto" />
              ) : (
                <>
                  <div className="text-center mb-2">
                    <span className={`text-4xl font-semibold tabular-nums tracking-tight ${statusColors[getHRVStatus(data?.current.hrv ?? null, data?.averages.hrv ?? 0)]}`}>
                      {data?.current.hrv ?? '—'}
                    </span>
                    <span className="text-lg text-muted-foreground ml-1">ms</span>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">
                      Avg: {data?.averages.hrv || '—'} ms
                    </p>
                  </div>
                </>
              )}
            </Card>

            {/* Resting HR Card */}
            <Card className="p-5">
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Resting HR
                </span>
                <Heart className="h-4 w-4 text-muted-foreground/50" />
              </div>
              {loading ? (
                <Skeleton className="h-10 w-20 mx-auto" />
              ) : (
                <>
                  <div className="text-center mb-2">
                    <span className={`text-4xl font-semibold tabular-nums tracking-tight ${statusColors[getRestingHRStatus(data?.current.restingHR ?? null, data?.averages.restingHR ?? 0)]}`}>
                      {data?.current.restingHR ?? '—'}
                    </span>
                    <span className="text-lg text-muted-foreground ml-1">bpm</span>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">
                      Avg: {data?.averages.restingHR || '—'} bpm
                    </p>
                  </div>
                </>
              )}
            </Card>

            {/* Readiness Card */}
            <Card className="p-5">
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Readiness
                </span>
                <Zap className="h-4 w-4 text-muted-foreground/50" />
              </div>
              {loading ? (
                <Skeleton className="h-10 w-20 mx-auto" />
              ) : (
                <>
                  <div className="text-center mb-2">
                    <span className={`text-4xl font-semibold tabular-nums tracking-tight ${statusColors[getSleepStatus(data?.current.readiness ?? null)]}`}>
                      {data?.current.readiness ?? '—'}
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">
                      {data?.current.readiness != null
                        ? data.current.readiness >= 80 ? 'Ready to train hard'
                          : data.current.readiness >= 60 ? 'Moderate recovery'
                          : 'Consider rest'
                        : 'No data'
                      }
                    </p>
                  </div>
                </>
              )}
            </Card>
          </div>

          {/* Chart Carousel */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                {/* Title left */}
                <div>
                  <CardTitle>{chartTitle}</CardTitle>
                  <CardDescription>{chartDescription}</CardDescription>
                </div>
                {/* Navigation + time selector right */}
                <div className="flex items-center gap-3">
                  {/* Carousel navigation */}
                  <div className="flex items-center gap-1.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevChart}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex gap-1">
                      {CHART_VIEWS.map((view) => (
                        <button
                          key={view}
                          onClick={() => setChartView(view)}
                          className={`h-1.5 rounded-full transition-all ${
                            chartView === view ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/30'
                          }`}
                        />
                      ))}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextChart}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  {/* Time selector */}
                  <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-[110px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_RANGES.map((range) => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>

              {loading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : chartData.length > 0 ? (
                <>
                  {/* Sleep Chart */}
                  {chartView === 'sleep' && (
                    <ChartContainer config={sleepChartConfig} className="h-[280px] w-full">
                      <ComposedChart
                        accessibilityLayer
                        data={chartData}
                        margin={{ left: 12, right: 12, top: 12, bottom: 12 }}
                      >
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                        />
                        <YAxis
                          yAxisId="hours"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          domain={[0, 12]}
                        />
                        <YAxis
                          yAxisId="score"
                          orientation="right"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          domain={[0, 100]}
                        />
                        <ReferenceLine yAxisId="hours" y={7} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                        <ChartTooltip
                          cursor={false}
                          content={<ChartTooltipContent />}
                        />
                        <Bar
                          yAxisId="hours"
                          dataKey="sleepHours"
                          fill="var(--color-sleepHours)"
                          radius={[4, 4, 0, 0]}
                          fillOpacity={0.7}
                        />
                        <Line
                          yAxisId="score"
                          dataKey="sleepScore"
                          type="monotone"
                          stroke="var(--color-sleepScore)"
                          strokeWidth={2}
                          dot={false}
                        />
                      </ComposedChart>
                    </ChartContainer>
                  )}

                  {/* Recovery Chart */}
                  {chartView === 'recovery' && (
                    <ChartContainer config={recoveryChartConfig} className="h-[280px] w-full">
                      <ComposedChart
                        accessibilityLayer
                        data={chartData}
                        margin={{ left: 12, right: 12, top: 12, bottom: 12 }}
                      >
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                        />
                        <YAxis
                          yAxisId="hrv"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          domain={['auto', 'auto']}
                        />
                        <YAxis
                          yAxisId="hr"
                          orientation="right"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          domain={['auto', 'auto']}
                        />
                        <ChartTooltip
                          cursor={false}
                          content={<ChartTooltipContent />}
                        />
                        <Area
                          yAxisId="hrv"
                          dataKey="hrv"
                          type="monotone"
                          fill="var(--color-hrv)"
                          fillOpacity={0.3}
                          stroke="var(--color-hrv)"
                          strokeWidth={2}
                        />
                        <Line
                          yAxisId="hr"
                          dataKey="restingHR"
                          type="monotone"
                          stroke="var(--color-restingHR)"
                          strokeWidth={2}
                          dot={false}
                        />
                      </ComposedChart>
                    </ChartContainer>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Training Correlation */}
          <Card>
            <CardHeader>
              <CardTitle>Sleep & Training Correlation</CardTitle>
              <CardDescription>
                How sleep quality affects your training performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[120px] w-full" />
              ) : correlation ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border bg-muted/30 text-center">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      After 7+ Hours Sleep
                    </div>
                    <div className="text-3xl font-semibold text-green-600 tabular-nums">
                      {correlation.avgGood} TSS
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      avg from {correlation.goodSleepCount} days
                    </div>
                  </div>
                  <div className="p-4 rounded-lg border bg-muted/30 text-center">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      After &lt;6 Hours Sleep
                    </div>
                    <div className="text-3xl font-semibold text-red-500 tabular-nums">
                      {correlation.avgPoor} TSS
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      avg from {correlation.poorSleepCount} days
                    </div>
                  </div>
                  <div className="p-4 rounded-lg border bg-muted/30 text-center flex flex-col justify-center">
                    <div className="flex items-center justify-center gap-2">
                      {correlation.difference > 0 ? (
                        <TrendingUp className="h-6 w-6 text-green-600" />
                      ) : (
                        <TrendingDown className="h-6 w-6 text-red-500" />
                      )}
                      <span className={`text-3xl font-semibold tabular-nums ${correlation.difference > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {correlation.difference > 0 ? '+' : ''}{correlation.difference}%
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      training output difference
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[120px] text-muted-foreground text-sm">
                  Not enough data to calculate correlations. Keep tracking your sleep and training!
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sleep Quality Reference */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sleep Score Reference</CardTitle>
              <CardDescription>
                Understanding your Garmin sleep quality scores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg border bg-muted/30">
                  <div className="font-medium text-sm text-green-600">Excellent</div>
                  <div className="text-sm text-muted-foreground">80-100</div>
                  <div className="text-xs text-muted-foreground mt-1">Optimal recovery</div>
                </div>
                <div className="p-3 rounded-lg border bg-muted/30">
                  <div className="font-medium text-sm text-blue-600">Good</div>
                  <div className="text-sm text-muted-foreground">60-79</div>
                  <div className="text-xs text-muted-foreground mt-1">Adequate rest</div>
                </div>
                <div className="p-3 rounded-lg border bg-muted/30">
                  <div className="font-medium text-sm text-amber-600">Fair</div>
                  <div className="text-sm text-muted-foreground">40-59</div>
                  <div className="text-xs text-muted-foreground mt-1">Room to improve</div>
                </div>
                <div className="p-3 rounded-lg border bg-muted/30">
                  <div className="font-medium text-sm text-red-600">Poor</div>
                  <div className="text-sm text-muted-foreground">0-39</div>
                  <div className="text-xs text-muted-foreground mt-1">Prioritize sleep</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
