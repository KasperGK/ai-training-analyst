import { z } from 'zod'
import { defineTool } from './types'
import { getSession, getSessions } from '@/lib/db/sessions'
import { getCurrentBests } from '@/lib/db/power-bests'
import { determineSessionType } from './get-detailed-session'

const inputSchema = z.object({
  sessionId: z.string().describe('The session ID to compare against similar sessions'),
  comparisonType: z.enum(['same_type', 'similar_tss', 'auto']).optional().default('auto')
    .describe('How to find similar sessions: same_type (same classification), similar_tss (±30% TSS), auto (best match)'),
  lookbackDays: z.number().optional().default(90)
    .describe('Number of days to look back for comparison sessions (default: 90)'),
})

type Input = z.infer<typeof inputSchema>

interface PeakPowerComparison {
  thisSession: number
  average: number
  percentDiff: number
}

interface ComparisonOutput {
  similarSessionCount: number
  avgTSS: number | null
  avgIF: number | null
  avgNP: number | null
  avgDuration: number | null
  peakPowerComparison?: Record<string, PeakPowerComparison>
  personalBests?: Record<string, number>
  insights: string[]
}

interface ErrorOutput {
  error: string
}

type Output = ComparisonOutput | ErrorOutput

export const compareSessions = defineTool<Input, Output>({
  description: `Find similar past sessions and compare metrics to provide historical context.

Compares a session against similar ones (same sport, similar TSS/type, within lookback window).
Returns average metrics, peak power comparison vs personal bests, and insights.

Use after getDetailedSession to enrich session analysis with historical context.`,

  inputSchema,

  execute: async ({ sessionId, comparisonType, lookbackDays }, ctx) => {
    if (!ctx.athleteId) {
      return { error: 'No athlete ID available' }
    }

    // 1. Fetch the target session
    let targetSession
    try {
      targetSession = await getSession(sessionId)
    } catch {
      // Session not found in local DB
    }

    if (!targetSession) {
      return { error: 'Session not found' }
    }

    // 2. Classify the target session
    const sessionType = determineSessionType(
      targetSession.intensity_factor ?? null,
      targetSession.tss ?? null,
      targetSession.duration_seconds,
      targetSession.workout_type ?? null
    )

    // 3. Calculate date range for lookback
    const endDate = targetSession.date
    const startDate = new Date(new Date(endDate).getTime() - lookbackDays * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0]

    // 4. Fetch candidate sessions
    const allSessions = await getSessions(ctx.athleteId, {
      startDate,
      endDate,
      sport: targetSession.sport,
      limit: 200,
    })

    // Filter out the target session itself
    const candidates = allSessions.filter(s => s.id !== sessionId)

    // 5. Find similar sessions based on comparison type
    let similarSessions = candidates
    const targetTSS = targetSession.tss ?? 0

    if (comparisonType === 'same_type' || comparisonType === 'auto') {
      // Filter by same session type classification
      similarSessions = candidates.filter(s => {
        const sType = determineSessionType(
          s.intensity_factor ?? null,
          s.tss ?? null,
          s.duration_seconds,
          s.workout_type ?? null
        )
        return sType === sessionType
      })

      // If auto and we got too few results, fall back to similar TSS
      if (comparisonType === 'auto' && similarSessions.length < 3 && targetTSS > 0) {
        similarSessions = candidates.filter(s => {
          const sTSS = s.tss ?? 0
          if (sTSS === 0) return false
          const ratio = sTSS / targetTSS
          return ratio >= 0.7 && ratio <= 1.3
        })
      }
    } else if (comparisonType === 'similar_tss') {
      if (targetTSS > 0) {
        similarSessions = candidates.filter(s => {
          const sTSS = s.tss ?? 0
          if (sTSS === 0) return false
          const ratio = sTSS / targetTSS
          return ratio >= 0.7 && ratio <= 1.3
        })
      }
    }

    // 6. Calculate averages
    const count = similarSessions.length
    if (count === 0) {
      // Still return personal bests even with no similar sessions
      const bests = await getCurrentBests(ctx.athleteId)
      const personalBests: Record<string, number> = {}
      const durationLabels: Record<number, string> = {
        5: '5s', 30: '30s', 60: '1min', 300: '5min', 1200: '20min',
      }
      for (const [duration, best] of bests) {
        const label = durationLabels[duration]
        if (label) personalBests[label] = best.power_watts
      }

      return {
        similarSessionCount: 0,
        avgTSS: null,
        avgIF: null,
        avgNP: null,
        avgDuration: null,
        personalBests: Object.keys(personalBests).length > 0 ? personalBests : undefined,
        insights: ['No similar sessions found in the lookback period for comparison.'],
      }
    }

    const sumTSS = similarSessions.reduce((sum, s) => sum + (s.tss ?? 0), 0)
    const sumIF = similarSessions.reduce((sum, s) => sum + (s.intensity_factor ?? 0), 0)
    const sumNP = similarSessions.reduce((sum, s) => sum + (s.normalized_power ?? 0), 0)
    const sumDuration = similarSessions.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0)

    const tssCount = similarSessions.filter(s => s.tss != null).length
    const ifCount = similarSessions.filter(s => s.intensity_factor != null).length
    const npCount = similarSessions.filter(s => s.normalized_power != null).length
    const durCount = similarSessions.filter(s => s.duration_seconds != null).length

    const avgTSS = tssCount > 0 ? Math.round(sumTSS / tssCount) : null
    const avgIF = ifCount > 0 ? Math.round((sumIF / ifCount) * 100) / 100 : null
    const avgNP = npCount > 0 ? Math.round(sumNP / npCount) : null
    const avgDuration = durCount > 0 ? Math.round(sumDuration / durCount) : null

    // 7. Fetch personal bests
    const bests = await getCurrentBests(ctx.athleteId)
    const personalBests: Record<string, number> = {}
    const durationLabels: Record<number, string> = {
      5: '5s', 30: '30s', 60: '1min', 300: '5min', 1200: '20min',
    }
    for (const [duration, best] of bests) {
      const label = durationLabels[duration]
      if (label) personalBests[label] = best.power_watts
    }

    // 8. Generate insights
    const insights: string[] = []

    if (avgTSS != null && targetTSS > 0) {
      const tssDiff = targetTSS - avgTSS
      if (tssDiff > avgTSS * 0.2) {
        insights.push(`This session's TSS (${Math.round(targetTSS)}) was significantly higher than your average similar session (${avgTSS}).`)
      } else if (tssDiff < -avgTSS * 0.2) {
        insights.push(`This session's TSS (${Math.round(targetTSS)}) was lower than your average similar session (${avgTSS}).`)
      } else {
        insights.push(`TSS (${Math.round(targetTSS)}) was consistent with your average for similar sessions (${avgTSS}).`)
      }
    }

    if (avgNP != null && targetSession.normalized_power) {
      const npDiff = targetSession.normalized_power - avgNP
      if (npDiff > 10) {
        insights.push(`Normalized power was ${Math.round(npDiff)}W above your average for these sessions - a strong effort.`)
      } else if (npDiff < -10) {
        insights.push(`Normalized power was ${Math.abs(Math.round(npDiff))}W below average for these sessions.`)
      }
    }

    return {
      similarSessionCount: count,
      avgTSS,
      avgIF,
      avgNP,
      avgDuration,
      personalBests: Object.keys(personalBests).length > 0 ? personalBests : undefined,
      insights,
    }
  },
})
