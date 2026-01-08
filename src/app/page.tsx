'use client'

import { useState, useCallback } from 'react'
import { FitnessMetrics } from '@/components/dashboard/fitness-metrics'
import { SessionsTable } from '@/components/dashboard/sessions-table'
import { PMCChart, generateDemoPMCData } from '@/components/dashboard/pmc-chart'
import { AICoachPanel } from '@/components/dashboard/ai-coach-panel'
import { FileUpload } from '@/components/dashboard/file-upload'
import {
  FitnessMetricsSkeleton,
  PMCChartSkeleton,
  SessionsTableSkeleton,
  FileUploadSkeleton,
} from '@/components/dashboard/skeletons'
import { Button } from '@/components/ui/button'
import { useIntervalsData } from '@/hooks/use-intervals-data'
import { useUser } from '@/hooks/use-user'
import { Settings } from 'lucide-react'
import Link from 'next/link'
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
  const { user, signOut } = useUser()
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

  // Local state for uploaded sessions
  const [uploadedSessions, setUploadedSessions] = useState<Session[]>([])

  const handleSessionUploaded = useCallback((session: Session) => {
    setUploadedSessions(prev => [session, ...prev])
  }, [])

  // Combine intervals.icu sessions with uploaded sessions
  const allSessions = [...uploadedSessions, ...(connected ? sessions : demoSessions)]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Use real data if connected, otherwise demo data
  const displayFitness = connected && currentFitness ? currentFitness : demoFitness
  const displaySessions = allSessions.length > 0 ? allSessions : demoSessions
  const displayPmcData = connected && pmcData.length > 0 ? pmcData : demoPmcData
  const displayCtlTrend = connected ? ctlTrend : 3
  const athleteFtp = athlete?.ftp || 250

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
            <Button variant="ghost" size="icon" asChild>
              <Link href="/settings">
                <Settings className="h-5 w-5" />
                <span className="sr-only">Settings</span>
              </Link>
            </Button>
            {user && (
              <Button variant="ghost" size="sm" onClick={signOut}>
                Sign out
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
                <strong>Demo Mode:</strong> Showing sample data. Connect your intervals.icu account or upload a .FIT file.
              </div>
            )}

            {/* File Upload + Fitness Metrics Row */}
            {loading ? (
              <div className="grid gap-6 md:grid-cols-[1fr_300px]">
                <FitnessMetricsSkeleton />
                <FileUploadSkeleton />
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-[1fr_300px]">
                <FitnessMetrics fitness={displayFitness} />
                <FileUpload onSessionUploaded={handleSessionUploaded} ftp={athleteFtp} />
              </div>
            )}

            {/* PMC Chart */}
            {loading ? (
              <PMCChartSkeleton />
            ) : (
              <PMCChart data={displayPmcData} ctlTrend={displayCtlTrend} />
            )}

            {/* Recent Sessions */}
            {loading ? (
              <SessionsTableSkeleton />
            ) : (
              <SessionsTable sessions={displaySessions} />
            )}
          </div>
        </div>

        {/* Right Panel - AI Coach */}
        <div className="w-[420px] border-l bg-background">
          <AICoachPanel
            athleteContext={athleteContextString}
            athleteId={user?.id}
            className="h-full rounded-none border-0"
          />
        </div>
      </main>
    </div>
  )
}
