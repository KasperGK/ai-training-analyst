'use client'

/**
 * Athlete Data Tab
 *
 * Detailed reference data: Power profile, fitness history, recovery metrics, events/goals.
 * Uses collapsible sections for organization.
 */

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronDown, Zap, Activity, Moon, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

// Power components
import { PowerCurveChart } from '@/components/power/power-curve-chart'
import { RiderProfileCard } from '@/components/power/rider-profile-card'
import { PowerBestsTable } from '@/components/power/power-bests-table'
import { usePowerCurve } from '@/hooks/use-power-curve'

// Recovery components
import { useRecoveryData } from '@/hooks/use-recovery-data'
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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

// PMC/History chart config
const pmcChartConfig = {
  ctl: { label: 'Fitness (CTL)', color: 'hsl(221, 83%, 53%)' },
  atl: { label: 'Fatigue (ATL)', color: 'hsl(24, 95%, 53%)' },
  tsb: { label: 'Form (TSB)', color: 'hsl(142, 71%, 45%)' },
} satisfies ChartConfig

const sleepChartConfig = {
  sleepHours: { label: 'Sleep (hours)', color: 'hsl(262, 83%, 58%)' },
  sleepScore: { label: 'Sleep Score', color: 'hsl(142, 71%, 45%)' },
} satisfies ChartConfig

const TIME_RANGES = [
  { value: '6w', label: '6 Weeks', days: 42 },
  { value: '3m', label: '3 Months', days: 90 },
  { value: '6m', label: '6 Months', days: 180 },
  { value: '1y', label: '1 Year', days: 365 },
]

interface PMCDataPoint {
  date: string
  ctl: number
  atl: number
  tsb: number
}

export function AthleteDataTab() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    power: true,
    history: false,
    recovery: false,
    events: false,
  })

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  return (
    <div className="space-y-4">
      {/* Power Profile Section */}
      <Collapsible open={openSections.power} onOpenChange={() => toggleSection('power')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  <CardTitle>Power Profile</CardTitle>
                </div>
                <ChevronDown className={cn('h-5 w-5 transition-transform', openSections.power && 'rotate-180')} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <PowerSection />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Fitness History Section */}
      <Collapsible open={openSections.history} onOpenChange={() => toggleSection('history')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-500" />
                  <CardTitle>Fitness History</CardTitle>
                </div>
                <ChevronDown className={cn('h-5 w-5 transition-transform', openSections.history && 'rotate-180')} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <HistorySection />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Recovery Section */}
      <Collapsible open={openSections.recovery} onOpenChange={() => toggleSection('recovery')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Moon className="h-5 w-5 text-purple-500" />
                  <CardTitle>Recovery Metrics</CardTitle>
                </div>
                <ChevronDown className={cn('h-5 w-5 transition-transform', openSections.recovery && 'rotate-180')} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <RecoverySection />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Events & Goals Section */}
      <Collapsible open={openSections.events} onOpenChange={() => toggleSection('events')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-green-500" />
                  <CardTitle>Events & Goals</CardTitle>
                </div>
                <ChevronDown className={cn('h-5 w-5 transition-transform', openSections.events && 'rotate-180')} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <EventsSection />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  )
}

function PowerSection() {
  const { powerCurve, riderProfile, weightKg, ftp, loading, error, refresh } = usePowerCurve()

  if (loading) {
    return <Skeleton className="h-[400px] w-full" />
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">Failed to load power data</p>
        <Button onClick={refresh} variant="outline">Try Again</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PowerCurveChart powerCurve={powerCurve} weightKg={weightKg} ftp={ftp} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RiderProfileCard profile={riderProfile} weightKg={weightKg} ftp={ftp} />
        <PowerBestsTable powerCurve={powerCurve} />
      </div>
    </div>
  )
}

function HistorySection() {
  const [timeRange, setTimeRange] = useState('3m')
  const [pmcData, setPmcData] = useState<PMCDataPoint[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const selectedRange = TIME_RANGES.find(r => r.value === timeRange)
      const days = selectedRange?.days || 90
      const res = await fetch(`/api/intervals/data?days=${days}`)
      if (res.ok) {
        const data = await res.json()
        setPmcData(data.pmcData || [])
      }
    } catch (error) {
      console.error('Failed to load PMC data:', error)
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
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
      </div>

      {loading ? (
        <Skeleton className="h-[300px] w-full" />
      ) : pmcData.length > 0 ? (
        <ChartContainer config={pmcChartConfig} className="h-[300px] w-full">
          <AreaChart data={pmcData} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} domain={['auto', 'auto']} />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            <Area dataKey="tsb" type="monotone" fill="var(--color-tsb)" fillOpacity={0.2} stroke="var(--color-tsb)" strokeWidth={2} />
            <Area dataKey="atl" type="monotone" fill="var(--color-atl)" fillOpacity={0.2} stroke="var(--color-atl)" strokeWidth={2} />
            <Area dataKey="ctl" type="monotone" fill="var(--color-ctl)" fillOpacity={0.3} stroke="var(--color-ctl)" strokeWidth={2} />
          </AreaChart>
        </ChartContainer>
      ) : (
        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
          No data available
        </div>
      )}
    </div>
  )
}

function RecoverySection() {
  const { loading, data, chartData, timeRange, setTimeRange, TIME_RANGES } = useRecoveryData()

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
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
      </div>

      {/* Current metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border text-center">
          <div className="text-xs text-muted-foreground uppercase mb-1">Sleep</div>
          <div className="text-2xl font-semibold">
            {data?.current.sleepSeconds ? `${Math.floor(data.current.sleepSeconds / 3600)}h` : '—'}
          </div>
        </div>
        <div className="p-4 rounded-lg border text-center">
          <div className="text-xs text-muted-foreground uppercase mb-1">HRV</div>
          <div className="text-2xl font-semibold">{data?.current.hrv ?? '—'} ms</div>
        </div>
        <div className="p-4 rounded-lg border text-center">
          <div className="text-xs text-muted-foreground uppercase mb-1">Resting HR</div>
          <div className="text-2xl font-semibold">{data?.current.restingHR ?? '—'} bpm</div>
        </div>
        <div className="p-4 rounded-lg border text-center">
          <div className="text-xs text-muted-foreground uppercase mb-1">Readiness</div>
          <div className="text-2xl font-semibold">{data?.current.readiness ?? '—'}</div>
        </div>
      </div>

      {/* Sleep chart */}
      {loading ? (
        <Skeleton className="h-[200px] w-full" />
      ) : chartData.length > 0 ? (
        <ChartContainer config={sleepChartConfig} className="h-[200px] w-full">
          <ComposedChart data={chartData} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis yAxisId="hours" tickLine={false} axisLine={false} tickMargin={8} domain={[0, 12]} />
            <YAxis yAxisId="score" orientation="right" tickLine={false} axisLine={false} tickMargin={8} domain={[0, 100]} />
            <ReferenceLine yAxisId="hours" y={7} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Bar yAxisId="hours" dataKey="sleepHours" fill="var(--color-sleepHours)" radius={[4, 4, 0, 0]} fillOpacity={0.7} />
            <Line yAxisId="score" dataKey="sleepScore" type="monotone" stroke="var(--color-sleepScore)" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ChartContainer>
      ) : (
        <div className="flex items-center justify-center h-[200px] text-muted-foreground">
          No recovery data available
        </div>
      )}
    </div>
  )
}

function EventsSection() {
  const [events, setEvents] = useState<Array<{ id: string; name: string; date: string; type: string }>>([])
  const [goals, setGoals] = useState<Array<{ id: string; title: string; target_date: string; status: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [eventsRes, goalsRes] = await Promise.all([
          fetch('/api/events'),
          fetch('/api/goals'),
        ])
        if (eventsRes.ok) {
          const data = await eventsRes.json()
          setEvents(data.events || [])
        }
        if (goalsRes.ok) {
          const data = await goalsRes.json()
          setGoals(data.goals || [])
        }
      } catch (error) {
        console.error('Failed to fetch events/goals:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return <Skeleton className="h-[200px] w-full" />
  }

  const upcomingEvents = events
    .filter(e => new Date(e.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5)

  const activeGoals = goals.filter(g => g.status !== 'completed').slice(0, 5)

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <h4 className="text-sm font-medium mb-3">Upcoming Events</h4>
        {upcomingEvents.length > 0 ? (
          <div className="space-y-2">
            {upcomingEvents.map(event => (
              <div key={event.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <div className="font-medium">{event.name}</div>
                  <div className="text-xs text-muted-foreground">{event.type}</div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {new Date(event.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No upcoming events</p>
        )}
      </div>

      <div>
        <h4 className="text-sm font-medium mb-3">Active Goals</h4>
        {activeGoals.length > 0 ? (
          <div className="space-y-2">
            {activeGoals.map(goal => (
              <div key={goal.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="font-medium">{goal.title}</div>
                <div className="text-sm text-muted-foreground">
                  {goal.target_date ? new Date(goal.target_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No date'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No active goals</p>
        )}
      </div>
    </div>
  )
}
