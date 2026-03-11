import { z } from 'zod'
import { defineTool } from './types'
import { getSession } from '@/lib/db/sessions'
import { findSimilarSessions, getFormattedPersonalBests } from '@/lib/analysis/session-comparison'

const inputSchema = z.object({
  sessionId: z.string().describe('The session ID to compare against similar sessions'),
  comparisonType: z.enum(['same_type', 'similar_tss', 'auto']).optional().default('auto')
    .describe('How to find similar sessions: same_type (same classification), similar_tss (±30% TSS), auto (best match)'),
  lookbackDays: z.number().optional().default(90)
    .describe('Number of days to look back for comparison sessions (default: 90)'),
})

type Input = z.infer<typeof inputSchema>

interface ComparisonOutput {
  similarSessionCount: number
  avgTSS: number | null
  avgIF: number | null
  avgNP: number | null
  avgDuration: number | null
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

    // 2. Use extracted comparison logic and fetch personal bests in parallel
    const [comparison, personalBests] = await Promise.all([
      findSimilarSessions(ctx.athleteId, targetSession, {
        lookback_days: lookbackDays,
        comparison_type: comparisonType,
      }),
      getFormattedPersonalBests(ctx.athleteId),
    ])

    if (!comparison) {
      return {
        similarSessionCount: 0,
        avgTSS: null,
        avgIF: null,
        avgNP: null,
        avgDuration: null,
        personalBests,
        insights: ['No similar sessions found in the lookback period for comparison.'],
      }
    }

    return {
      similarSessionCount: comparison.similar_session_count,
      avgTSS: comparison.avg_tss,
      avgIF: comparison.avg_if,
      avgNP: comparison.avg_np,
      avgDuration: comparison.avg_duration,
      personalBests,
      insights: comparison.insights,
    }
  },
})
