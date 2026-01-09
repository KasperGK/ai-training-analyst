'use client'

import { useState, useCallback } from 'react'
import { FitnessMetrics } from '@/components/dashboard/fitness-metrics'
import { SessionsTable } from '@/components/dashboard/sessions-table'
import { PMCChart } from '@/components/dashboard/pmc-chart'
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
import { Settings, Calendar } from 'lucide-react'
import Link from 'next/link'
import type { Session } from '@/types'

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
  const allSessions = [...uploadedSessions, ...sessions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Use real data only - no demo fallback
  const displayFitness = currentFitness
  const displaySessions = allSessions
  const displayPmcData = pmcData
  const displayCtlTrend = ctlTrend
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
              <Link href="/events">
                <Calendar className="h-5 w-5" />
                <span className="sr-only">Events & Goals</span>
              </Link>
            </Button>
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
            {/* Connect prompt when not connected */}
            {!connected && !loading && (
              <div className="rounded-lg border border-dashed border-blue-300 bg-blue-50 p-4 text-sm text-blue-800">
                <strong>Connect your data:</strong> Link your intervals.icu account to see your training data, or upload .FIT files directly.
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
