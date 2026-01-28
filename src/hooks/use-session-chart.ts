'use client'

/**
 * Hook for fetching session stream data for overlay charts
 *
 * Fetches session data including power, HR, and cadence streams
 * and transforms them into the format needed by OverlayChart.
 */

import { useState, useEffect } from 'react'
import type { ChartMetric } from '@/lib/widgets/types'
import type { OverlayDataPoint } from '@/components/charts/overlay-chart'

interface SessionActivity {
  id: string
  name: string
  date: string
  type: string
  duration_seconds: number
  avg_power: number | null
  max_power: number | null
  normalized_power: number | null
  avg_hr: number | null
  max_hr: number | null
  avg_cadence: number | null
  tss: number | null
  intensity_factor: number | null
  decoupling: number | null
}

interface SessionStreams {
  time: number[]
  watts: number[]
  heartrate: number[]
  cadence: number[]
  altitude?: number[]
  velocity_smooth?: number[]
}

interface SessionResponse {
  activity: SessionActivity
  streams: SessionStreams
  powerZones: { zone: string; seconds: number; minutes: number }[]
  hrZones: { zone: string; seconds: number; minutes: number }[]
  wellness: { ctl: number; atl: number; tsb: number } | null
}

interface UseSessionChartResult {
  data: OverlayDataPoint[]
  activity: SessionActivity | null
  averages: Partial<Record<ChartMetric, number>>
  loading: boolean
  error: string | null
}

/**
 * Transform raw streams into OverlayDataPoint format
 */
function transformStreams(streams: SessionStreams): OverlayDataPoint[] {
  const { time, watts, heartrate, cadence, altitude, velocity_smooth } = streams

  if (!time || time.length === 0) {
    return []
  }

  return time.map((t, i) => ({
    time: t,
    power: watts?.[i] ?? undefined,
    heartRate: heartrate?.[i] ?? undefined,
    cadence: cadence?.[i] ?? undefined,
    altitude: altitude?.[i] ?? undefined,
    speed: velocity_smooth?.[i] ?? undefined,
  }))
}

/**
 * Extract averages from activity data
 */
function extractAverages(activity: SessionActivity): Partial<Record<ChartMetric, number>> {
  const averages: Partial<Record<ChartMetric, number>> = {}

  if (activity.avg_power != null) {
    averages.power = activity.avg_power
  }
  if (activity.avg_hr != null) {
    averages.heartRate = activity.avg_hr
  }
  if (activity.avg_cadence != null) {
    averages.cadence = activity.avg_cadence
  }

  return averages
}

/**
 * Hook for fetching session chart data
 *
 * @param sessionId - Session ID to fetch, or 'latest' for most recent session
 * @param enabled - Whether to fetch data (default: true)
 */
export function useSessionChart(
  sessionId: string | null,
  enabled: boolean = true
): UseSessionChartResult {
  const [data, setData] = useState<OverlayDataPoint[]>([])
  const [activity, setActivity] = useState<SessionActivity | null>(null)
  const [averages, setAverages] = useState<Partial<Record<ChartMetric, number>>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId || !enabled) {
      return
    }

    let cancelled = false

    async function fetchSession() {
      setLoading(true)
      setError(null)

      try {
        // Handle 'latest' as a special case - fetch most recent session ID first
        let actualSessionId = sessionId

        if (sessionId === 'latest') {
          // Fetch sessions list and get the most recent
          const sessionsRes = await fetch('/api/intervals/data?include=sessions')
          if (!sessionsRes.ok) {
            throw new Error('Failed to fetch sessions list')
          }
          const sessionsData = await sessionsRes.json()
          const sessions = sessionsData.activities || sessionsData.sessions || []

          if (sessions.length === 0) {
            throw new Error('No sessions available')
          }

          // Get most recent session
          actualSessionId = sessions[0]?.id || sessions[0]?.external_id
          if (!actualSessionId) {
            throw new Error('Could not determine latest session ID')
          }
        }

        // Fetch session data
        const response = await fetch(`/api/sessions/${actualSessionId}`)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `Failed to fetch session: ${response.status}`)
        }

        const sessionData: SessionResponse = await response.json()

        if (cancelled) return

        // Transform data
        const chartData = transformStreams(sessionData.streams)
        const avgData = extractAverages(sessionData.activity)

        setData(chartData)
        setActivity(sessionData.activity)
        setAverages(avgData)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error')
          setData([])
          setActivity(null)
          setAverages({})
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchSession()

    return () => {
      cancelled = true
    }
  }, [sessionId, enabled])

  return { data, activity, averages, loading, error }
}
