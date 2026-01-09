'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Clock, Route, Mountain, Zap, Heart, Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StreamChart } from '@/components/workouts/stream-chart'
import { ZoneBarChart } from '@/components/workouts/zone-bar'

interface WorkoutData {
  activity: {
    id: string
    name: string
    date: string
    type: string
    sport: string
    duration_seconds: number
    elapsed_seconds: number
    distance_meters: number
    elevation_gain: number
    avg_power: number
    normalized_power: number
    max_power: number
    avg_hr: number
    max_hr: number
    avg_cadence: number
    tss: number
    intensity_factor: number
    ftp: number
    calories: number
    trimp: number
    decoupling: number
    interval_summary: string[]
  }
  streams: {
    time: number[]
    watts: number[]
    heartrate: number[]
    cadence: number[]
  }
  powerZones: { zone: string; seconds: number; minutes: number }[]
  hrZones: { zone: string; seconds: number; minutes: number }[]
  wellness: {
    ctl: number
    atl: number
    tsb: number
    rampRate: number
  } | null
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function MetricCard({
  icon: Icon,
  label,
  value,
  unit
}: {
  icon: React.ElementType
  label: string
  value: number | string | undefined
  unit?: string
}) {
  if (value === undefined || value === null) return null

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Icon className="h-4 w-4" />
          <span className="text-xs">{label}</span>
        </div>
        <div className="text-2xl font-bold">
          {typeof value === 'number' ? Math.round(value) : value}
          {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-muted/40 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-12 w-96" />
        <Skeleton className="h-6 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[280px]" />
        <Skeleton className="h-[280px]" />
      </div>
    </div>
  )
}

export default function WorkoutDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [data, setData] = useState<WorkoutData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchWorkout() {
      try {
        const response = await fetch(`/api/sessions/${params.id}`)
        if (!response.ok) {
          throw new Error('Failed to fetch workout')
        }
        const json = await response.json()
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchWorkout()
    }
  }, [params.id])

  if (loading) {
    return <LoadingSkeleton />
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-muted/40 p-6">
        <div className="max-w-6xl mx-auto">
          <Button variant="ghost" onClick={() => router.back()} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">{error || 'Workout not found'}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const { activity, streams, powerZones, hrZones, wellness } = data

  // Prepare stream data for charts
  const powerData = streams.time?.map((time, i) => ({
    time,
    value: streams.watts?.[i] || 0,
  })) || []

  const hrData = streams.time?.map((time, i) => ({
    time,
    value: streams.heartrate?.[i] || 0,
  })) || []

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Header */}
      <header className="border-b bg-background px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <Button variant="ghost" onClick={() => router.back()} className="mb-2 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold">{activity.name || 'Workout'}</h1>
          <p className="text-muted-foreground">{formatDateTime(activity.date)}</p>
        </div>
      </header>

      {/* Content */}
      <main className="p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <MetricCard icon={Clock} label="Duration" value={formatDuration(activity.duration_seconds)} />
            <MetricCard icon={Activity} label="TSS" value={activity.tss} />
            <MetricCard icon={Zap} label="Normalized Power" value={activity.normalized_power} unit="W" />
            <MetricCard icon={Zap} label="Avg Power" value={activity.avg_power} unit="W" />
            <MetricCard icon={Heart} label="Avg HR" value={activity.avg_hr} unit="bpm" />
            <MetricCard icon={Activity} label="IF" value={activity.intensity_factor?.toFixed(2)} />
            {activity.distance_meters > 0 && (
              <MetricCard icon={Route} label="Distance" value={(activity.distance_meters / 1000).toFixed(1)} unit="km" />
            )}
            {activity.elevation_gain > 0 && (
              <MetricCard icon={Mountain} label="Elevation" value={activity.elevation_gain} unit="m" />
            )}
          </div>

          {/* Fitness Context */}
          {wellness && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-muted-foreground">Fitness on this day:</span>
                  <span>CTL: <strong>{Math.round(wellness.ctl)}</strong></span>
                  <span>ATL: <strong>{Math.round(wellness.atl)}</strong></span>
                  <span>TSB: <strong className={wellness.tsb < -20 ? 'text-red-500' : wellness.tsb > 10 ? 'text-green-500' : ''}>{wellness.tsb}</strong></span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Power Chart */}
          {powerData.length > 0 && (
            <StreamChart
              title="Power"
              data={powerData}
              color="hsl(221, 83%, 53%)"
              unit="W"
              average={activity.avg_power}
              max={activity.max_power}
            />
          )}

          {/* HR Chart */}
          {hrData.length > 0 && (
            <StreamChart
              title="Heart Rate"
              data={hrData}
              color="hsl(0, 84%, 60%)"
              unit="bpm"
              average={activity.avg_hr}
              max={activity.max_hr}
            />
          )}

          {/* Zone Charts */}
          <div className="grid md:grid-cols-2 gap-6">
            {powerZones.length > 0 && (
              <ZoneBarChart
                title="Power Zones"
                data={powerZones}
                colorScheme="power"
              />
            )}
            {hrZones.length > 0 && (
              <ZoneBarChart
                title="Heart Rate Zones"
                data={hrZones}
                colorScheme="hr"
              />
            )}
          </div>

          {/* Interval Summary */}
          {activity.interval_summary && activity.interval_summary.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-2">Intervals</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {activity.interval_summary.map((interval, i) => (
                    <li key={i}>{interval}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
