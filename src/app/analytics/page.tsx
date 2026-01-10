'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ReferenceLine } from 'recharts'
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
  Activity,
  Flame,
  Heart,
  Info,
} from 'lucide-react'
import Link from 'next/link'

interface PMCDataPoint {
  date: string
  ctl: number
  atl: number
  tsb: number
}

interface CurrentFitness {
  ctl: number
  atl: number
  tsb: number
  ctl_trend: 'up' | 'down' | 'stable'
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

const TIME_RANGES = [
  { value: '6w', label: '6 Weeks', days: 42 },
  { value: '3m', label: '3 Months', days: 90 },
  { value: '6m', label: '6 Months', days: 180 },
  { value: '1y', label: '1 Year', days: 365 },
]

function getTSBZone(tsb: number): { label: string; color: string; description: string } {
  if (tsb > 25) return { label: 'Very Fresh', color: 'text-amber-600', description: 'Risk of detraining - consider adding training load' }
  if (tsb >= 5) return { label: 'Fresh', color: 'text-green-600', description: 'Optimal for racing or hard efforts' }
  if (tsb >= -10) return { label: 'Neutral', color: 'text-blue-600', description: 'Good balance of fitness and freshness' }
  if (tsb >= -25) return { label: 'Tired', color: 'text-orange-600', description: 'Accumulated fatigue - monitor recovery' }
  return { label: 'Very Tired', color: 'text-red-600', description: 'High fatigue - prioritize rest' }
}

function getCTLLevel(ctl: number): { label: string; description: string } {
  if (ctl >= 130) return { label: 'Elite', description: 'Professional/elite level fitness' }
  if (ctl >= 100) return { label: 'Competitive', description: 'Ready for competitive racing' }
  if (ctl >= 70) return { label: 'Serious Amateur', description: 'Strong recreational fitness' }
  if (ctl >= 40) return { label: 'Enthusiast', description: 'Regular training fitness' }
  return { label: 'Recreational', description: 'Building base fitness' }
}

export default function AnalyticsPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('3m')
  const [pmcData, setPmcData] = useState<PMCDataPoint[]>([])
  const [currentFitness, setCurrentFitness] = useState<CurrentFitness | null>(null)
  const [ctlTrend, setCtlTrend] = useState(0)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const selectedRange = TIME_RANGES.find(r => r.value === timeRange)
      const days = selectedRange?.days || 90

      const res = await fetch(`/api/intervals/data?days=${days}`)
      if (res.ok) {
        const data = await res.json()
        setPmcData(data.pmcData || [])
        setCurrentFitness(data.currentFitness || null)
        setCtlTrend(data.ctlTrend || 0)
      }
    } catch (error) {
      console.error('Failed to load analytics data:', error)
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Scroll to section based on hash
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash) {
      const element = document.getElementById(hash)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [loading])

  const tsbZone = currentFitness ? getTSBZone(currentFitness.tsb) : null
  const ctlLevel = currentFitness ? getCTLLevel(currentFitness.ctl) : null

  // Calculate some stats from the data
  const peakCTL = pmcData.length > 0 ? Math.max(...pmcData.map(d => d.ctl)) : 0
  const avgCTL = pmcData.length > 0 ? Math.round(pmcData.reduce((sum, d) => sum + d.ctl, 0) / pmcData.length) : 0
  const minTSB = pmcData.length > 0 ? Math.min(...pmcData.map(d => d.tsb)) : 0
  const maxTSB = pmcData.length > 0 ? Math.max(...pmcData.map(d => d.tsb)) : 0

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
              <h1 className="text-xl font-semibold tracking-tight">Fitness Analytics</h1>
              <p className="text-sm text-muted-foreground">
                Detailed view of your training metrics
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[130px]">
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
            <Button variant="outline" size="sm" asChild>
              <Link href="/learn">
                <Info className="h-4 w-4 mr-2" />
                Learn
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 py-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Current Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card id="fitness" className="p-5">
              <div className="flex items-start justify-between mb-4">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Fitness (CTL)
                </span>
                <Activity className="h-4 w-4 text-muted-foreground/50" />
              </div>
              {loading ? (
                <Skeleton className="h-12 w-20 mx-auto" />
              ) : (
                <>
                  <div className="text-center mb-4">
                    <span className="text-5xl font-semibold tabular-nums tracking-tight">
                      {currentFitness ? Math.round(currentFitness.ctl) : '—'}
                    </span>
                  </div>
                  <div className="text-center">
                    {ctlLevel && (
                      <p className="text-xs text-muted-foreground">{ctlLevel.label} · {ctlLevel.description}</p>
                    )}
                  </div>
                </>
              )}
            </Card>

            <Card id="fatigue" className="p-5">
              <div className="flex items-start justify-between mb-4">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Fatigue (ATL)
                </span>
                <Flame className="h-4 w-4 text-muted-foreground/50" />
              </div>
              {loading ? (
                <Skeleton className="h-12 w-20 mx-auto" />
              ) : (
                <>
                  <div className="text-center mb-4">
                    <span className="text-5xl font-semibold tabular-nums tracking-tight">
                      {currentFitness ? Math.round(currentFitness.atl) : '—'}
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">
                      7-day rolling average of training stress
                    </p>
                  </div>
                </>
              )}
            </Card>

            <Card id="form" className="p-5">
              <div className="flex items-start justify-between mb-4">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Form (TSB)
                </span>
                <Heart className="h-4 w-4 text-muted-foreground/50" />
              </div>
              {loading ? (
                <Skeleton className="h-12 w-20 mx-auto" />
              ) : (
                <>
                  <div className="text-center mb-4">
                    <span className="text-5xl font-semibold tabular-nums tracking-tight">
                      {currentFitness ? (currentFitness.tsb > 0 ? '+' : '') + Math.round(currentFitness.tsb) : '—'}
                    </span>
                  </div>
                  <div className="text-center">
                    {tsbZone && (
                      <p className="text-xs text-muted-foreground">{tsbZone.label} · {tsbZone.description}</p>
                    )}
                  </div>
                </>
              )}
            </Card>
          </div>

          {/* Extended PMC Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Management Chart</CardTitle>
              <CardDescription>
                Track your fitness (CTL), fatigue (ATL), and form (TSB) over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[350px] w-full" />
              ) : pmcData.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[350px] w-full">
                  <AreaChart
                    accessibilityLayer
                    data={pmcData}
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
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      domain={['auto', 'auto']}
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
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
              ) : (
                <div className="flex items-center justify-center h-[350px] text-muted-foreground text-sm">
                  No data available. Connect intervals.icu to see your fitness trends.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Peak CTL</div>
              <div className="text-2xl font-semibold tabular-nums text-center">{peakCTL}</div>
              <div className="text-xs text-muted-foreground text-center mt-1">in selected period</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Average CTL</div>
              <div className="text-2xl font-semibold tabular-nums text-center">{avgCTL}</div>
              <div className="text-xs text-muted-foreground text-center mt-1">in selected period</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">TSB Range</div>
              <div className="text-2xl font-semibold tabular-nums text-center">{minTSB} to {maxTSB > 0 ? '+' : ''}{maxTSB}</div>
              <div className="text-xs text-muted-foreground text-center mt-1">form fluctuation</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Weekly Trend</div>
              <div className="text-2xl font-semibold tabular-nums text-center">{ctlTrend > 0 ? '+' : ''}{ctlTrend}</div>
              <div className="text-xs text-muted-foreground text-center mt-1">CTL change</div>
            </Card>
          </div>

          {/* TSB Zones Reference */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Form (TSB) Zones Reference</CardTitle>
              <CardDescription>
                Understanding what your Training Stress Balance means
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="p-3 rounded-lg border bg-muted/30">
                  <div className="font-medium text-sm">Very Tired</div>
                  <div className="text-sm text-muted-foreground">Below -25</div>
                  <div className="text-xs text-muted-foreground mt-1">High fatigue risk</div>
                </div>
                <div className="p-3 rounded-lg border bg-muted/30">
                  <div className="font-medium text-sm">Tired</div>
                  <div className="text-sm text-muted-foreground">-25 to -10</div>
                  <div className="text-xs text-muted-foreground mt-1">Building fitness</div>
                </div>
                <div className="p-3 rounded-lg border bg-muted/30">
                  <div className="font-medium text-sm">Neutral</div>
                  <div className="text-sm text-muted-foreground">-10 to +5</div>
                  <div className="text-xs text-muted-foreground mt-1">Good training zone</div>
                </div>
                <div className="p-3 rounded-lg border bg-muted/30">
                  <div className="font-medium text-sm">Fresh</div>
                  <div className="text-sm text-muted-foreground">+5 to +25</div>
                  <div className="text-xs text-muted-foreground mt-1">Ready to race</div>
                </div>
                <div className="p-3 rounded-lg border bg-muted/30">
                  <div className="font-medium text-sm">Very Fresh</div>
                  <div className="text-sm text-muted-foreground">Above +25</div>
                  <div className="text-xs text-muted-foreground mt-1">May be detraining</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
