/**
 * Session comparison logic extracted from the compareSessions AI tool.
 * Provides reusable comparison functions for session reports and other consumers.
 */

import { getSessions } from '@/lib/db/sessions'
import { getCurrentBests } from '@/lib/db/power-bests'
import { determineSessionType } from '@/app/api/chat/tools/get-detailed-session'
import type { Session } from '@/types'

export interface ComparisonResult {
  similar_session_count: number
  avg_tss: number | null
  avg_if: number | null
  avg_np: number | null
  avg_duration: number | null
  personal_bests?: Record<string, number>
  insights: string[]
}

/**
 * Find sessions similar to a target session from a provided list.
 * Pure logic — no DB calls.
 */
export function findSimilarFromList(
  target: Session,
  candidates: Session[],
  comparisonType: 'same_type' | 'similar_tss' | 'auto' = 'auto'
): Session[] {
  const sessionType = determineSessionType(
    target.intensity_factor ?? null,
    target.tss ?? null,
    target.duration_seconds,
    target.workout_type ?? null
  )

  const targetTSS = target.tss ?? 0
  let similar = candidates

  if (comparisonType === 'same_type' || comparisonType === 'auto') {
    similar = candidates.filter(s => {
      const sType = determineSessionType(
        s.intensity_factor ?? null,
        s.tss ?? null,
        s.duration_seconds,
        s.workout_type ?? null
      )
      return sType === sessionType
    })

    // If auto and too few results, fall back to similar TSS
    if (comparisonType === 'auto' && similar.length < 3 && targetTSS > 0) {
      similar = candidates.filter(s => {
        const sTSS = s.tss ?? 0
        if (sTSS === 0) return false
        const ratio = sTSS / targetTSS
        return ratio >= 0.7 && ratio <= 1.3
      })
    }
  } else if (comparisonType === 'similar_tss') {
    if (targetTSS > 0) {
      similar = candidates.filter(s => {
        const sTSS = s.tss ?? 0
        if (sTSS === 0) return false
        const ratio = sTSS / targetTSS
        return ratio >= 0.7 && ratio <= 1.3
      })
    }
  }

  return similar
}

/**
 * Calculate average metrics from a list of sessions
 */
export function calculateAverages(sessions: Session[]): {
  avg_tss: number | null
  avg_if: number | null
  avg_np: number | null
  avg_duration: number | null
} {
  const count = sessions.length
  if (count === 0) {
    return { avg_tss: null, avg_if: null, avg_np: null, avg_duration: null }
  }

  const sumTSS = sessions.reduce((sum, s) => sum + (s.tss ?? 0), 0)
  const sumIF = sessions.reduce((sum, s) => sum + (s.intensity_factor ?? 0), 0)
  const sumNP = sessions.reduce((sum, s) => sum + (s.normalized_power ?? 0), 0)
  const sumDuration = sessions.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0)

  const tssCount = sessions.filter(s => s.tss != null).length
  const ifCount = sessions.filter(s => s.intensity_factor != null).length
  const npCount = sessions.filter(s => s.normalized_power != null).length
  const durCount = sessions.filter(s => s.duration_seconds != null).length

  return {
    avg_tss: tssCount > 0 ? Math.round(sumTSS / tssCount) : null,
    avg_if: ifCount > 0 ? Math.round((sumIF / ifCount) * 100) / 100 : null,
    avg_np: npCount > 0 ? Math.round(sumNP / npCount) : null,
    avg_duration: durCount > 0 ? Math.round(sumDuration / durCount) : null,
  }
}

/**
 * Generate comparison insights between a target session and similar sessions
 */
export function generateComparisonInsights(
  target: Session,
  averages: ReturnType<typeof calculateAverages>
): string[] {
  const insights: string[] = []
  const targetTSS = target.tss ?? 0

  if (averages.avg_tss != null && targetTSS > 0) {
    const tssDiff = targetTSS - averages.avg_tss
    if (tssDiff > averages.avg_tss * 0.2) {
      insights.push(`This session's TSS (${Math.round(targetTSS)}) was significantly higher than your average similar session (${averages.avg_tss}).`)
    } else if (tssDiff < -averages.avg_tss * 0.2) {
      insights.push(`This session's TSS (${Math.round(targetTSS)}) was lower than your average similar session (${averages.avg_tss}).`)
    } else {
      insights.push(`TSS (${Math.round(targetTSS)}) was consistent with your average for similar sessions (${averages.avg_tss}).`)
    }
  }

  if (averages.avg_np != null && target.normalized_power) {
    const npDiff = target.normalized_power - averages.avg_np
    if (npDiff > 10) {
      insights.push(`Normalized power was ${Math.round(npDiff)}W above your average for these sessions - a strong effort.`)
    } else if (npDiff < -10) {
      insights.push(`Normalized power was ${Math.abs(Math.round(npDiff))}W below average for these sessions.`)
    }
  }

  return insights
}

/**
 * Format personal bests from power-bests DB records
 */
export async function getFormattedPersonalBests(
  athleteId: string
): Promise<Record<string, number> | undefined> {
  const bests = await getCurrentBests(athleteId)
  const personalBests: Record<string, number> = {}
  const durationLabels: Record<number, string> = {
    5: '5s', 30: '30s', 60: '1min', 300: '5min', 1200: '20min',
  }
  for (const [duration, best] of bests) {
    const label = durationLabels[duration]
    if (label) personalBests[label] = best.power_watts
  }
  return Object.keys(personalBests).length > 0 ? personalBests : undefined
}

export interface FindSimilarOptions {
  lookback_days?: number
  comparison_type?: 'same_type' | 'similar_tss' | 'auto'
}

/**
 * High-level function: find similar sessions and compute comparison for a target session.
 * Used by the report generator and the compareSessions AI tool.
 */
export async function findSimilarSessions(
  athleteId: string,
  targetSession: Session,
  options: FindSimilarOptions = {}
): Promise<ComparisonResult | null> {
  const { lookback_days = 90, comparison_type = 'auto' } = options
  const endDate = targetSession.date
  const startDate = new Date(new Date(endDate).getTime() - lookback_days * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0]

  const allSessions = await getSessions(athleteId, {
    startDate,
    endDate,
    sport: targetSession.sport,
    limit: 200,
  })

  const candidates = allSessions.filter(s => s.id !== targetSession.id)
  const similarSessions = findSimilarFromList(targetSession, candidates, comparison_type)

  if (similarSessions.length === 0) {
    return null
  }

  const averages = calculateAverages(similarSessions)
  const insights = generateComparisonInsights(targetSession, averages)

  return {
    similar_session_count: similarSessions.length,
    ...averages,
    insights,
  }
}
