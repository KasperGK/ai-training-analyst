'use client'

import { FitnessMetrics } from '@/components/dashboard/fitness-metrics'
import { SessionsTable } from '@/components/dashboard/sessions-table'
import { PMCChart, generateDemoPMCData } from '@/components/dashboard/pmc-chart'
import { AICoachPanel } from '@/components/dashboard/ai-coach-panel'
import { Button } from '@/components/ui/button'
import { useIntervalsData } from '@/hooks/use-intervals-data'
import type { CurrentFitness, Session } from '@/types'

// Demo data - used when not connected to intervals.icu
const demoFitness: CurrentFitness = {
  ctl: 72,
  atl: 85,
  tsb: -13,
  ctl_trend: 'up',
  days_until_event: 52,
  event_name: 'Gran Fondo',
}

const demoSessions: Session[] = [
  {
    id: '1',
    athlete_id: 'demo',
    date: '2026-01-08',
    duration_seconds: 3345,
    sport: 'cycling',
    workout_type: 'threshold',
    normalized_power: 247,
    intensity_factor: 0.99,
    tss: 91,
    avg_hr: 156,
    source: 'intervals_icu',
  },
  {
    id: '2',
    athlete_id: 'demo',
    date: '2026-01-06',
    duration_seconds: 5400,
    sport: 'cycling',
    workout_type: 'endurance',
    normalized_power: 185,
    intensity_factor: 0.74,
    tss: 65,
    avg_hr: 132,
    source: 'intervals_icu',
  },
  {
    id: '3',
    athlete_id: 'demo',
    date: '2026-01-04',
    duration_seconds: 4200,
    sport: 'cycling',
    workout_type: 'sweetspot',
    normalized_power: 225,
    intensity_factor: 0.90,
    tss: 78,
    avg_hr: 148,
    source: 'intervals_icu',
  },
  {
    id: '4',
    athlete_id: 'demo',
    date: '2026-01-02',
    duration_seconds: 3600,
    sport: 'cycling',
    workout_type: 'recovery',
    normalized_power: 155,
    intensity_factor: 0.62,
    tss: 32,
    avg_hr: 118,
    source: 'intervals_icu',
  },
]

const demoPmcData = generateDemoPMCData()

export default function Dashboard() {
  const {
    connected,
    loading,
    athlete,
    currentFitness,
    sessions,
    pmcData,
    ctlTrend,
    connect,
  } = useIntervalsData()

  // Use real data if connected, otherwise demo data
  const displayFitness = connected && currentFitness ? currentFitness : demoFitness
  const displaySessions = connected && sessions.length > 0 ? sessions : demoSessions
  const displayPmcData = connected && pmcData.length > 0 ? pmcData : demoPmcData
  const displayCtlTrend = connected ? ctlTrend : 3

  // Build context string for AI
  const athleteContextString = JSON.stringify(
    {
      athlete: athlete || {
        ftp: 250,
        weight_kg: 75,
        weekly_hours: 8,
      },
      currentFitness: displayFitness,
      recentSessions: displaySessions,
    },
    null,
    2
  )

  return (
    <div className="flex h-screen flex-col bg-muted/40">
      {/* Header */}
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Training Analyst</h1>
            <p className="text-sm text-muted-foreground">
              {connected && athlete
                ? `Welcome back, ${athlete.name}`
                : 'AI-powered insights for your training'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {connected ? (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <span className="h-2 w-2 rounded-full bg-green-600" />
                Connected to intervals.icu
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={connect} disabled={loading}>
                {loading ? 'Checking...' : 'Connect intervals.icu'}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left Panel - Dashboard */}
        <div className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-5xl space-y-6">
            {/* Demo mode banner */}
            {!connected && !loading && (
              <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                <strong>Demo Mode:</strong> Showing sample data. Connect your intervals.icu account to see your real training data.
              </div>
            )}

            {/* Fitness Metrics */}
            <FitnessMetrics fitness={displayFitness} />

            {/* PMC Chart */}
            <PMCChart data={displayPmcData} ctlTrend={displayCtlTrend} />

            {/* Recent Sessions */}
            <SessionsTable sessions={displaySessions} />
          </div>
        </div>

        {/* Right Panel - AI Coach */}
        <div className="w-[420px] border-l bg-background">
          <AICoachPanel
            athleteContext={athleteContextString}
            className="h-full rounded-none border-0"
          />
        </div>
      </main>
    </div>
  )
}
