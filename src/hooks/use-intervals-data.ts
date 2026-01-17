'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { CurrentFitness, Session } from '@/types'

// Auto-refresh interval: 5 minutes
const REFRESH_INTERVAL = 5 * 60 * 1000

/**
 * Recovery data - separate from training load (PMC)
 */
interface Recovery {
  sleepSeconds: number | null
  sleepScore: number | null
  sleepQuality: number | null
  hrv: number | null
  restingHR: number | null
  readiness: number | null
  fatigue: number | null
  mood: number | null
  sleepHours: number | null
  sleepFormatted: string | null
}

interface IntervalsData {
  connected: boolean
  loading: boolean
  error: string | null
  athlete: {
    id: string
    name: string
    ftp: number | null
    max_hr: number | null
    lthr: number | null
    weight_kg: number | null
    resting_hr: number | null
  } | null
  currentFitness: CurrentFitness | null
  recovery: Recovery | null  // Separate recovery/sleep data
  sessions: Session[]
  pmcData: { date: string; ctl: number; atl: number; tsb: number }[]
  ctlTrend: number
  lastUpdated: Date | null
  fitnessSource: 'local' | 'intervals_icu' | null
}

export function useIntervalsData() {
  const [data, setData] = useState<IntervalsData>({
    connected: false,
    loading: true,
    error: null,
    athlete: null,
    currentFitness: null,
    recovery: null,
    sessions: [],
    pmcData: [],
    ctlTrend: 0,
    lastUpdated: null,
    fitnessSource: null,
  })
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(async (showLoading = false) => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    if (showLoading) {
      setData(prev => ({ ...prev, loading: true }))
    }

    try {
      // Fetch fitness from local database (source of truth) and sessions from intervals.icu in parallel
      const [fitnessResponse, intervalsResponse] = await Promise.all([
        fetch('/api/fitness', {
          signal: abortControllerRef.current.signal,
        }),
        fetch('/api/intervals/data', {
          signal: abortControllerRef.current.signal,
        }),
      ])

      const fitnessJson = await fitnessResponse.json()
      const intervalsJson = await intervalsResponse.json()

      // Check connection status - both endpoints should be accessible
      const connected = fitnessJson.connected || intervalsJson.connected

      if (!connected) {
        setData(prev => ({
          ...prev,
          loading: false,
          connected: false,
          error: fitnessJson.error || intervalsJson.error || 'Not connected',
        }))
        return
      }

      // Use fitness data from local endpoint (source of truth)
      // Fall back to intervals.icu data if local fitness is not available
      const currentFitness = fitnessJson.currentFitness || intervalsJson.currentFitness
      const pmcData = fitnessJson.pmcData || intervalsJson.pmcData || []
      const ctlTrend = fitnessJson.ctlTrend ?? intervalsJson.ctlTrend ?? 0

      // Recovery data comes from intervals endpoint (separate concern)
      const recovery = intervalsJson.recovery || null

      setData({
        connected: true,
        loading: false,
        error: null,
        athlete: intervalsJson.athlete || null,
        currentFitness,
        recovery,
        sessions: intervalsJson.sessions || [],
        pmcData,
        ctlTrend,
        lastUpdated: new Date(),
        fitnessSource: fitnessJson.source || 'intervals_icu',
      })
    } catch (error) {
      // Ignore abort errors - they're expected when component unmounts
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      setData(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to fetch data',
      }))
    }
  }, [])

  // Initial fetch on mount
  useEffect(() => {
    fetchData(true)

    // Cleanup: abort any in-flight request on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchData])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(false) // Silent refresh (no loading state)
    }, REFRESH_INTERVAL)

    return () => clearInterval(interval)
  }, [fetchData])

  // Refresh when tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchData(false)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [fetchData])

  const connect = () => {
    window.location.href = '/api/auth/intervals/connect'
  }

  const refresh = () => fetchData(true)

  return { ...data, connect, refresh }
}
