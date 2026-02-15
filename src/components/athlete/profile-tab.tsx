'use client'

/**
 * Athlete Profile Tab
 *
 * A story-driven view of the athlete's current status.
 * Hero section with FTP, current form with sparkline, and weekly summary.
 */

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useIntervalsData } from '@/hooks/use-intervals-data'
import { TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react'
import { AreaChart, Area, ReferenceLine, ResponsiveContainer } from 'recharts'

interface PMCDataPoint {
  date: string
  ctl: number
  atl: number
  tsb: number
}

function getFitnessLevel(ftp: number | null | undefined, weight: number | null | undefined): string {
  if (!ftp || !weight) return ''
  const wpkg = ftp / weight
  if (wpkg >= 5.0) return 'Elite'
  if (wpkg >= 4.5) return 'Cat 1 / Pro'
  if (wpkg >= 4.0) return 'Cat 2'
  if (wpkg >= 3.5) return 'Cat 3'
  if (wpkg >= 3.0) return 'Cat 4'
  if (wpkg >= 2.5) return 'Enthusiast'
  return 'Recreational'
}

function getTsbLabel(tsb: number | null | undefined): { label: string; color: string } {
  if (tsb === null || tsb === undefined) return { label: 'Unknown', color: 'text-muted-foreground' }
  if (tsb > 25) return { label: 'Very Fresh', color: 'text-amber-500' }
  if (tsb >= 5) return { label: 'Fresh', color: 'text-green-600' }
  if (tsb >= -10) return { label: 'Optimal', color: 'text-blue-600' }
  if (tsb >= -25) return { label: 'Tired', color: 'text-orange-500' }
  return { label: 'Very Tired', color: 'text-red-500' }
}

export function AthleteProfileTab() {
  const { loading, athlete, currentFitness, sessions } = useIntervalsData()
  const [pmcHistory, setPmcHistory] = useState<PMCDataPoint[]>([])
  const [aiStatus, setAiStatus] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  // Fetch 14-day PMC history for sparkline
  useEffect(() => {
    async function fetchPmcHistory() {
      try {
        const res = await fetch('/api/intervals/data?days=14')
        if (res.ok) {
          const data = await res.json()
          setPmcHistory(data.pmcData || [])
        }
      } catch (error) {
        console.error('Failed to load PMC history:', error)
      }
    }
    fetchPmcHistory()
  }, [])

  // Fetch AI-generated status (only when fitness data is available)
  useEffect(() => {
    async function fetchAiStatus() {
      if (!currentFitness) return
      setAiLoading(true)
      try {
        const res = await fetch('/api/athlete/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ctl: currentFitness.ctl,
            atl: currentFitness.atl,
            tsb: currentFitness.tsb,
            ctl_trend: currentFitness.ctl_trend,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          setAiStatus(data.status)
        }
      } catch (error) {
        console.error('Failed to fetch AI status:', error)
      } finally {
        setAiLoading(false)
      }
    }
    fetchAiStatus()
  }, [currentFitness])

  if (loading) {
    return <ProfileSkeleton />
  }

  // Calculate weekly stats
  const last7Days = sessions.filter(s => {
    const sessionDate = new Date(s.date)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return sessionDate >= weekAgo
  })

  const weeklyHours = last7Days.reduce((acc, s) => acc + (s.duration_seconds || 0), 0) / 3600
  const weeklyTss = last7Days.reduce((acc, s) => acc + (s.tss || 0), 0)
  const targetTss = 600 // Can be made dynamic later

  const fitnessLevel = getFitnessLevel(athlete?.ftp, athlete?.weight_kg)
  const tsbInfo = getTsbLabel(currentFitness?.tsb)
  const wpkg = athlete?.ftp && athlete?.weight_kg ? (athlete.ftp / athlete.weight_kg).toFixed(2) : null

  const TrendIcon = currentFitness?.ctl_trend === 'up' ? TrendingUp :
    currentFitness?.ctl_trend === 'down' ? TrendingDown : Minus

  // Fallback status text
  const statusText = aiStatus || getDefaultStatusText(currentFitness?.tsb, currentFitness?.ctl_trend)

  return (
    <div className="space-y-6">
      {/* Hero Section - Athlete Identity */}
      <Card className="p-8">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* FTP Hero */}
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-primary/10">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="text-6xl font-bold tabular-nums tracking-tight">
                {athlete?.ftp ?? '—'}
                <span className="text-2xl font-normal text-muted-foreground ml-2">W</span>
              </div>
              {wpkg && (
                <div className="text-xl text-muted-foreground">
                  {wpkg} W/kg
                  {fitnessLevel && <span className="ml-2 text-primary">· {fitnessLevel}</span>}
                </div>
              )}
            </div>
          </div>

          {/* Secondary metrics */}
          <div className="md:ml-auto flex flex-wrap gap-6 text-sm">
            <div>
              <div className="text-muted-foreground">Weight</div>
              <div className="text-lg font-medium">{athlete?.weight_kg ?? '—'} kg</div>
            </div>
            <div>
              <div className="text-muted-foreground">Max HR</div>
              <div className="text-lg font-medium">{athlete?.max_hr ?? '—'} bpm</div>
            </div>
            <div>
              <div className="text-muted-foreground">Resting HR</div>
              <div className="text-lg font-medium">{athlete?.resting_hr ?? currentFitness?.resting_hr ?? '—'} bpm</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Current Form Section */}
      <Card className="p-6">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
          Current Form
        </h3>

        {/* PMC Sparkline */}
        {pmcHistory.length > 0 && (
          <div className="h-20 mb-4 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pmcHistory} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.5} />
                <Area
                  type="monotone"
                  dataKey="tsb"
                  stroke="hsl(142, 71%, 45%)"
                  fill="hsl(142, 71%, 45%)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="ctl"
                  stroke="hsl(221, 83%, 53%)"
                  fill="hsl(221, 83%, 53%)"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Metrics Row */}
        <div className="flex flex-wrap items-center gap-6 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">CTL</span>
            <span className="text-2xl font-semibold tabular-nums text-blue-600">
              {currentFitness?.ctl?.toFixed(0) ?? '—'}
            </span>
            <TrendIcon className={`h-4 w-4 ${
              currentFitness?.ctl_trend === 'up' ? 'text-green-500' :
              currentFitness?.ctl_trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
            }`} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">ATL</span>
            <span className="text-2xl font-semibold tabular-nums text-orange-500">
              {currentFitness?.atl?.toFixed(0) ?? '—'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">TSB</span>
            <span className={`text-2xl font-semibold tabular-nums ${tsbInfo.color}`}>
              {currentFitness?.tsb !== undefined ? (currentFitness.tsb > 0 ? '+' : '') + currentFitness.tsb.toFixed(0) : '—'}
            </span>
            <span className={`text-sm ${tsbInfo.color}`}>({tsbInfo.label})</span>
          </div>
        </div>

        {/* AI Status Text */}
        <div className="p-4 rounded-lg bg-muted/50 border">
          {aiLoading ? (
            <Skeleton className="h-5 w-3/4" />
          ) : (
            <p className="text-sm leading-relaxed">{statusText}</p>
          )}
        </div>
      </Card>

      {/* This Week Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            This Week
          </h3>
          <div className="text-sm text-muted-foreground">
            {last7Days.length} workouts · {weeklyHours.toFixed(1)}h
          </div>
        </div>

        {/* TSS Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm">Weekly TSS</span>
            <span className="text-lg font-semibold tabular-nums">{weeklyTss.toFixed(0)}</span>
          </div>
          <Progress value={Math.min((weeklyTss / targetTss) * 100, 100)} className="h-3" />
          <div className="text-xs text-muted-foreground mt-1 text-right">
            Target: {targetTss}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="space-y-2">
          {sessions.slice(0, 5).map((session) => (
            <div key={session.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-3">
                <span className="font-medium capitalize">{session.sport || 'Ride'}</span>
                <span className="text-sm text-muted-foreground">
                  {new Date(session.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
              </div>
              <span className="font-medium tabular-nums">
                {session.tss ? `${session.tss} TSS` : `${Math.round((session.duration_seconds || 0) / 60)}min`}
              </span>
            </div>
          ))}
          {sessions.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">No recent activities</p>
          )}
        </div>
      </Card>
    </div>
  )
}

function getDefaultStatusText(tsb: number | null | undefined, trend: string | undefined): string {
  if (tsb === null || tsb === undefined) {
    return 'Connect your training data to see personalized insights about your current form.'
  }
  if (tsb > 25) {
    return 'You\'re very fresh right now. Great time for a hard effort or race, but be careful not to lose fitness with too much rest.'
  }
  if (tsb >= 5) {
    return 'You\'re fresh and ready to perform. This is a good window for quality sessions or racing.'
  }
  if (tsb >= -10) {
    return `You're in a balanced state${trend === 'up' ? ' and building fitness' : ''}. Good zone for productive training.`
  }
  if (tsb >= -25) {
    return 'Accumulated fatigue from recent training. Consider an easier day or focus on recovery to absorb the load.'
  }
  return 'High fatigue level. Prioritize rest and recovery to avoid overtraining. Your body needs time to adapt.'
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-40 bg-muted rounded-lg" />
      <div className="h-52 bg-muted rounded-lg" />
      <div className="h-64 bg-muted rounded-lg" />
    </div>
  )
}
