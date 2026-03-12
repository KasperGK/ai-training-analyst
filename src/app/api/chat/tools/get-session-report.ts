import { z } from 'zod'
import { defineTool } from './types'
import { getSessionReport as fetchSessionReport } from '@/lib/db/session-reports'
import { logger } from '@/lib/logger'
import type { SessionReport } from '@/lib/reports/types'

const inputSchema = z.object({
  sessionId: z.string().describe('The session ID to fetch a pre-generated report for'),
})

type Input = z.infer<typeof inputSchema>

interface ReportResponse {
  available: true
  report: {
    score: number
    headline: string
    quick_take: string
    deep_analysis: SessionReport['deep_analysis']
    tags: string[]
    goal_relevance: SessionReport['goal_relevance']
    session_context: SessionReport['session_context']
    created_at: string
  }
}

interface NotAvailableResponse {
  available: false
}

interface ErrorResponse {
  error: string
}

type Output = ReportResponse | NotAvailableResponse | ErrorResponse

export const getSessionReport = defineTool<Input, Output>({
  description: 'Fetch a pre-generated coaching report for a session. Call this FIRST when analyzing a session — if a report exists, use it as the foundation instead of re-analyzing from scratch. Falls back to getDetailedSession + compareSessions if no report exists.',
  inputSchema,
  execute: async ({ sessionId }, ctx) => {
    if (!ctx.athleteId) {
      return { error: 'No athlete ID available' }
    }

    try {
      const report = await fetchSessionReport(sessionId)

      if (!report || report.athlete_id !== ctx.athleteId) {
        return { available: false }
      }

      return {
        available: true,
        report: {
          score: report.score,
          headline: report.headline,
          quick_take: report.quick_take,
          deep_analysis: report.deep_analysis,
          tags: report.tags,
          goal_relevance: report.goal_relevance,
          session_context: report.session_context,
          created_at: report.created_at,
        },
      }
    } catch (error) {
      logger.error('[getSessionReport] Error:', error)
      return { error: 'Failed to retrieve session report' }
    }
  },
})
