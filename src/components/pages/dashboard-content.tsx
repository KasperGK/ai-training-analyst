'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { FitnessCard, FatigueCard, FormCard } from '@/components/dashboard/fitness-metrics'
import { SessionsTable } from '@/components/dashboard/sessions-table'
import { PMCChart, TIME_RANGES, type TimeRangeKey } from '@/components/dashboard/pmc-chart'
import { FileUpload } from '@/components/dashboard/file-upload'
import { SleepCard } from '@/components/dashboard/sleep-card'
import { DashboardGrid } from '@/components/dashboard/dashboard-grid'
import {
  MetricCardSkeleton,
  PMCChartSkeleton,
  SessionsTableSkeleton,
  FileUploadSkeletonCompact,
} from '@/components/dashboard/skeletons'
import { useIntervalsData } from '@/hooks/use-intervals-data'
import { useSync } from '@/hooks/use-sync'
import { useDashboardLayout } from '@/hooks/use-dashboard-layout'
import { InsightFeed } from '@/components/insights/insight-feed'
import type { Session } from '@/types'

export function DashboardContent() {
  const {
    connected,
    loading,
    athlete,
    currentFitness,
    recovery,
    sessions,
    pmcData,
    ctlTrend,
  } = useIntervalsData()

  // Auto-sync data to Supabase when needed
  useSync({ autoSync: true })

  // Dashboard layout state
  const { layouts, onLayoutChange } = useDashboardLayout()

  const [uploadedSessions, setUploadedSessions] = useState<Session[]>([])
  const [pmcTimeRange, setPmcTimeRange] = useState<TimeRangeKey>('6w')
  const [pmcDataState, setPmcDataState] = useState<typeof pmcData>(pmcData)
  const [pmcCtlTrendState, setPmcCtlTrendState] = useState<typeof ctlTrend>(ctlTrend)

  // Sync initial data from hook
  useEffect(() => {
    setPmcDataState(pmcData)
    setPmcCtlTrendState(ctlTrend)
  }, [pmcData, ctlTrend])

  // Fetch PMC data when time range changes
  useEffect(() => {
    const days = TIME_RANGES[pmcTimeRange].days
    fetch(`/api/fitness?days=${days}`)
      .then(res => res.json())
      .then(data => {
        if (data.pmcData) setPmcDataState(data.pmcData)
        if (data.ctlTrend !== undefined) setPmcCtlTrendState(data.ctlTrend)
      })
      .catch(err => console.error('Failed to fetch PMC data:', err))
  }, [pmcTimeRange])

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
  const displayPmcData = pmcDataState
  const displayCtlTrend = pmcCtlTrendState
  const athleteFtp = athlete?.ftp || 250

  return (
    <main className="h-full overflow-auto bg-muted/40 pt-24 pb-6 pl-[96px] pr-6 scrollbar-left scrollbar-subtle">
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
          <div key="fitness" data-widget-id="fitness" className="h-full">
            {loading ? (
              <MetricCardSkeleton />
            ) : (
              <FitnessCard fitness={displayFitness} />
            )}
          </div>

          {/* Fatigue Card */}
          <div key="fatigue" data-widget-id="fatigue" className="h-full">
            {loading ? (
              <MetricCardSkeleton />
            ) : (
              <FatigueCard fitness={displayFitness} />
            )}
          </div>

          {/* Form Card */}
          <div key="form" data-widget-id="form" className="h-full">
            {loading ? (
              <MetricCardSkeleton />
            ) : (
              <FormCard fitness={displayFitness} />
            )}
          </div>

          {/* Sleep Card - uses recovery data (separate from training load) */}
          <div key="sleep" data-widget-id="sleep" className="h-full">
            {loading ? (
              <MetricCardSkeleton />
            ) : (
              <SleepCard
                sleepSeconds={recovery?.sleepSeconds}
                sleepScore={recovery?.sleepScore}
              />
            )}
          </div>

          {/* Upload Card */}
          <div key="upload" data-widget-id="upload" className="h-full">
            {loading ? (
              <FileUploadSkeletonCompact />
            ) : (
              <FileUpload onSessionUploaded={handleSessionUploaded} ftp={athleteFtp} compact />
            )}
          </div>

          {/* Insights */}
          <div key="insights" data-widget-id="insights" className="h-full">
            <InsightFeed maxItems={5} className="h-full" />
          </div>

          {/* PMC Chart */}
          <div key="chart" data-widget-id="chart" className="h-full">
            {loading ? (
              <PMCChartSkeleton />
            ) : (
              <PMCChart
                data={displayPmcData}
                ctlTrend={displayCtlTrend}
                timeRange={pmcTimeRange}
                onTimeRangeChange={setPmcTimeRange}
              />
            )}
          </div>

          {/* Sessions Table */}
          <div key="sessions" data-widget-id="sessions" className="h-full">
            {loading ? (
              <SessionsTableSkeleton />
            ) : (
              <SessionsTable sessions={displaySessions} />
            )}
          </div>
        </DashboardGrid>
      </div>
    </main>
  )
}
