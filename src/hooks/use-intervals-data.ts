'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CurrentFitness, Session } from '@/types'

// Auto-refresh interval: 5 minutes
const REFRESH_INTERVAL = 5 * 60 * 1000

interface IntervalsData {
  connected: boolean
  loading: boolean
  error: string | null
  athlete: {
    id: string
    name: string
    ftp: number
    max_hr: number
    lthr: number
    weight_kg: number
  } | null
  currentFitness: CurrentFitness | null
  sessions: Session[]
  pmcData: { date: string; ctl: number; atl: number; tsb: number }[]
  ctlTrend: number
  lastUpdated: Date | null
}

export function useIntervalsData() {
  const [data, setData] = useState<IntervalsData>({
    connected: false,
    loading: true,
    error: null,
    athlete: null,
    currentFitness: null,
    sessions: [],
    pmcData: [],
    ctlTrend: 0,
    lastUpdated: null,
  })

  const fetchData = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setData(prev => ({ ...prev, loading: true }))
    }

    try {
      const response = await fetch('/api/intervals/data')
      const json = await response.json()

      if (!response.ok) {
        setData(prev => ({
          ...prev,
          loading: false,
          connected: json.connected ?? false,
          error: json.error,
        }))
        return
      }

      setData({
        connected: true,
        loading: false,
        error: null,
        athlete: json.athlete,
        currentFitness: json.currentFitness,
        sessions: json.sessions,
        pmcData: json.pmcData,
        ctlTrend: json.ctlTrend,
        lastUpdated: new Date(),
      })
    } catch (error) {
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
