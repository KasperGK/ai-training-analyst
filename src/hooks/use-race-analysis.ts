'use client'

/**
 * Hook for fetching race analysis data for canvas widgets.
 *
 * Self-fetching hook so the race-history and competitor-analysis widgets
 * don't require the AI to pipe data through showOnCanvas config.
 */

import { useState, useEffect } from 'react'
import type { RaceHistoryData } from '@/components/coach/race-history-widget'
import type { CompetitorData } from '@/components/coach/competitor-widget'

interface UseRaceAnalysisResult {
  raceHistory: RaceHistoryData | null
  competitors: CompetitorData | null
  loading: boolean
  error: string | null
}

export function useRaceAnalysis(enabled: boolean = true): UseRaceAnalysisResult {
  const [raceHistory, setRaceHistory] = useState<RaceHistoryData | null>(null)
  const [competitors, setCompetitors] = useState<CompetitorData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    async function fetchData() {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch('/api/race-analysis')
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || `Failed to fetch: ${res.status}`)
        }

        const data = await res.json()
        if (cancelled) return

        setRaceHistory(data.raceHistory || null)
        setCompetitors(data.competitors || null)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => { cancelled = true }
  }, [enabled])

  return { raceHistory, competitors, loading, error }
}
