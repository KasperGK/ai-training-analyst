'use client'

import { useState, useCallback, useMemo } from 'react'
import { FitnessCard, FatigueCard, FormCard } from '@/components/dashboard/fitness-metrics'
import { SessionsTable } from '@/components/dashboard/sessions-table'
import { PMCChart } from '@/components/dashboard/pmc-chart'
import { AICoachPanel } from '@/components/dashboard/ai-coach-panel'
import { FileUpload } from '@/components/dashboard/file-upload'
import { SleepCard } from '@/components/dashboard/sleep-card'
import { DashboardGrid } from '@/components/dashboard/dashboard-grid'
import {
  MetricCardSkeleton,
  PMCChartSkeleton,
  SessionsTableSkeleton,
  FileUploadSkeletonCompact,
} from '@/components/dashboard/skeletons'
import { Card, CardContent } from '@/components/ui/card'
import { DragHandle } from '@/components/ui/drag-handle'
import { useIntervalsData } from '@/hooks/use-intervals-data'
import { useSync } from '@/hooks/use-sync'
import { useDashboardLayout } from '@/hooks/use-dashboard-layout'
import { useUser } from '@/hooks/use-user'
import { PageTransition } from '@/components/layout/page-transition'
import { InsightFeed } from '@/components/insights/insight-feed'
import type { Session } from '@/types'


export default function Dashboard() {
  const { user } = useUser()
  const {
    connected,
    loading,
    athlete,
    currentFitness,
    sessions,
    pmcData,
    ctlTrend,
  } = useIntervalsData()

  // Auto-sync data to Supabase when needed
  useSync({ autoSync: true })

  // Dashboard layout state
  const { layouts, onLayoutChange, resetLayout } = useDashboardLayout()

  const [uploadedSessions, setUploadedSessions] = useState<Session[]>([])

  const handleSessionUploaded = useCallback((session: Session) => {
    setUploadedSessions(prev => [session, ...prev])
  }, [])

  const allSessions = useMemo(() =>
    [...uploadedSessions, ...sessions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [uploadedSessions, sessions]
  )

  const displayFitness = currentFitness
  const displaySessions = allSessions
  const displayPmcData = pmcData
  const displayCtlTrend = ctlTrend
  const athleteFtp = athlete?.ftp || 250

  const athleteContextString = useMemo(() => JSON.stringify(
    {
      athlete: {
        ftp: athlete?.ftp ?? null,
        max_hr: athlete?.max_hr ?? null,
        lthr: athlete?.lthr ?? null,
        weight_kg: athlete?.weight_kg ?? null,
        name: athlete?.name ?? null,
      },
      currentFitness: {
        ctl: displayFitness?.ctl ?? null,
        atl: displayFitness?.atl ?? null,
        tsb: displayFitness?.tsb ?? null,
        ctl_trend: displayFitness?.ctl_trend ?? null,
      },
      recovery: {
        sleep_seconds: displayFitness?.sleep_seconds ?? null,
        sleep_score: displayFitness?.sleep_score ?? null,
        hrv: displayFitness?.hrv ?? null,
        resting_hr: displayFitness?.resting_hr ?? null,
      },
      recentSessions: displaySessions.slice(0, 10).map(s => ({
        date: s.date,
        sport: s.sport,
        duration_seconds: s.duration_seconds,
        tss: s.tss,
        avg_power: s.avg_power,
        normalized_power: s.normalized_power,
        intensity_factor: s.intensity_factor,
        avg_hr: s.avg_hr,
        workout_type: s.workout_type,
      })),
    },
    null,
    2
  ), [athlete, displayFitness, displaySessions])

  return (
    <PageTransition>
      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6 bg-muted/40">
        <div className="mx-auto max-w-7xl">
          {/* Connect prompt when not connected */}
          {!connected && !loading && (
            <div className="mb-6 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <strong>Connect your data:</strong> Link your intervals.icu account to see your training data, or upload .FIT files directly.
            </div>
          )}

          {/* Dashboard Grid */}
          <DashboardGrid layouts={layouts} onLayoutChange={onLayoutChange}>
            {/* Fitness Card */}
            <div key="fitness" className="h-full">
              {loading ? (
                <MetricCardSkeleton />
              ) : (
                <FitnessCard fitness={displayFitness} />
              )}
            </div>

            {/* Fatigue Card */}
            <div key="fatigue" className="h-full">
              {loading ? (
                <MetricCardSkeleton />
              ) : (
                <FatigueCard fitness={displayFitness} />
              )}
            </div>

            {/* Form Card */}
            <div key="form" className="h-full">
              {loading ? (
                <MetricCardSkeleton />
              ) : (
                <FormCard fitness={displayFitness} />
              )}
            </div>

            {/* Sleep Card */}
            <div key="sleep" className="h-full">
              {loading ? (
                <MetricCardSkeleton />
              ) : (
                <SleepCard
                  sleepSeconds={displayFitness?.sleep_seconds}
                  sleepScore={displayFitness?.sleep_score}
                />
              )}
            </div>

            {/* Upload Card */}
            <div key="upload" className="h-full">
              {loading ? (
                <FileUploadSkeletonCompact />
              ) : (
                <FileUpload onSessionUploaded={handleSessionUploaded} ftp={athleteFtp} compact />
              )}
            </div>

            {/* Insights */}
            <div key="insights" className="h-full">
              <InsightFeed maxItems={5} className="h-full" />
            </div>

            {/* PMC Chart */}
            <div key="chart" className="h-full">
              {loading ? (
                <PMCChartSkeleton />
              ) : (
                <PMCChart data={displayPmcData} ctlTrend={displayCtlTrend} />
              )}
            </div>

            {/* Sessions Table */}
            <div key="sessions" className="h-full">
              {loading ? (
                <SessionsTableSkeleton />
              ) : (
                <SessionsTable sessions={displaySessions} />
              )}
            </div>

            {/* AI Coach Panel */}
            <div key="ai-coach" className="h-full">
              <Card className="group h-full flex flex-col overflow-hidden relative p-5">
                <DragHandle />
                <AICoachPanel
                  athleteContext={athleteContextString}
                  athleteId={user?.id}
                  className="h-full rounded-none border-0 shadow-none"
                />
              </Card>
            </div>
          </DashboardGrid>
        </div>
      </main>
    </PageTransition>
  )
}
