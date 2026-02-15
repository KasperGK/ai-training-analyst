'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { RecoveryData } from '@/app/api/recovery/route'

const TIME_RANGES = [
  { value: '1w', label: '1 Week', days: 7 },
  { value: '6w', label: '6 Weeks', days: 42 },
  { value: '3m', label: '3 Months', days: 90 },
  { value: '6m', label: '6 Months', days: 180 },
  { value: '1y', label: '1 Year', days: 365 },
] as const

export type TimeRange = typeof TIME_RANGES[number]['value']

export function useRecoveryData(initialTimeRange: TimeRange = '3m') {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>(initialTimeRange)
  const [data, setData] = useState<RecoveryData | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const selectedRange = TIME_RANGES.find(r => r.value === timeRange)
      const days = selectedRange?.days || 90

      const res = await fetch(`/api/recovery?days=${days}`)
      if (!res.ok) throw new Error('Failed to load recovery data')
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recovery data')
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Calculate training correlation
  const correlation = useMemo(() => {
    if (!data?.history || !data?.sessions) return null

    const tssByDate = new Map<string, number>()
    for (const s of data.sessions) {
      const existing = tssByDate.get(s.date) || 0
      tssByDate.set(s.date, existing + s.tss)
    }

    const goodSleepDays: string[] = []
    const poorSleepDays: string[] = []

    for (const h of data.history) {
      if (h.sleepHours >= 7) goodSleepDays.push(h.date)
      else if (h.sleepHours > 0 && h.sleepHours < 6) poorSleepDays.push(h.date)
    }

    const tssAfterGoodSleep = goodSleepDays
      .map(d => tssByDate.get(d) || 0)
      .filter(t => t > 0)
    const tssAfterPoorSleep = poorSleepDays
      .map(d => tssByDate.get(d) || 0)
      .filter(t => t > 0)

    if (tssAfterGoodSleep.length < 3 || tssAfterPoorSleep.length < 3) return null

    const avgGood = tssAfterGoodSleep.reduce((a, b) => a + b, 0) / tssAfterGoodSleep.length
    const avgPoor = tssAfterPoorSleep.reduce((a, b) => a + b, 0) / tssAfterPoorSleep.length
    const difference = Math.round(((avgGood - avgPoor) / avgPoor) * 100)

    return {
      avgGood: Math.round(avgGood),
      avgPoor: Math.round(avgPoor),
      difference,
      goodSleepCount: goodSleepDays.length,
      poorSleepCount: poorSleepDays.length,
    }
  }, [data])

  // Sample data for charts based on time range
  const chartData = useMemo(() => {
    if (!data?.history) return []
    const sampleRate = timeRange === '1w' ? 1 : timeRange === '6w' ? 1 : timeRange === '3m' ? 2 : timeRange === '6m' ? 4 : 7
    return data.history.filter((_, i) => i % sampleRate === 0 || i === data.history.length - 1)
  }, [data?.history, timeRange])

  return {
    loading,
    error,
    data,
    timeRange,
    setTimeRange,
    chartData,
    correlation,
    refresh: loadData,
    TIME_RANGES,
  }
}

// Helper functions
export function formatSleepDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

export function getSleepStatus(score: number | null): 'good' | 'warning' | 'bad' | 'neutral' {
  if (score == null) return 'neutral'
  if (score >= 80) return 'good'
  if (score >= 60) return 'warning'
  return 'bad'
}

export function getHRVStatus(hrv: number | null, avg: number): 'good' | 'warning' | 'bad' | 'neutral' {
  if (hrv == null || avg === 0) return 'neutral'
  const diff = ((hrv - avg) / avg) * 100
  if (diff >= 5) return 'good'
  if (diff <= -10) return 'bad'
  return 'neutral'
}

export function getRestingHRStatus(hr: number | null, avg: number): 'good' | 'warning' | 'bad' | 'neutral' {
  if (hr == null || avg === 0) return 'neutral'
  const diff = hr - avg
  if (diff <= -3) return 'good'
  if (diff >= 5) return 'bad'
  return 'neutral'
}
