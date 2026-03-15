/**
 * Session Report Generator
 *
 * Generates AI coaching reports for training sessions using Claude Opus.
 * Uses generateObject() with Zod schema for structured output.
 */

import { anthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { z } from 'zod'
import { getSession } from '@/lib/db/sessions'
import { getFitnessForDate } from '@/lib/db/fitness'
import { getActiveGoals } from '@/lib/db/goals'
import { createSessionReport, hasReportForSession } from '@/lib/db/session-reports'
import { buildSessionResponse } from '@/app/api/chat/tools/get-detailed-session'
import { findSimilarSessions } from '@/lib/analysis/session-comparison'
import { REPORT_SYSTEM_PROMPT, buildReportPrompt } from './prompts'
import type { DeepAnalysis, SessionReportInsert } from './types'
import { logger } from '@/lib/logger'

const deepAnalysisSchema = z.object({
  execution: z.object({
    score: z.number(),
    summary: z.string(),
    pacing_quality: z.string(),
    power_management: z.string(),
    hr_response: z.string().nullable(),
  }),
  training_value: z.object({
    score: z.number(),
    summary: z.string(),
    physiological_stimulus: z.string(),
    progression_context: z.string(),
  }),
  recovery: z.object({
    score: z.number(),
    summary: z.string(),
    fatigue_indicators: z.string(),
    recovery_recommendation: z.string(),
  }),
  key_observations: z.array(z.string()),
  areas_for_improvement: z.array(z.string()),
})

const reportSchema = z.object({
  score: z.number(),
  headline: z.string(),
  quick_take: z.string(),
  deep_analysis: deepAnalysisSchema,
  tags: z.array(z.string()),
  goal_relevance: z.object({
    relevant_goals: z.array(z.object({
      goal_id: z.string(),
      goal_title: z.string(),
      relevance: z.string(),
      impact: z.enum(['positive', 'neutral', 'negative']),
    })),
  }).nullable(),
})

interface GenerationResult {
  success: boolean
  reports_created: number
  errors: string[]
}

/**
 * Generate session reports for one or more sessions
 */
export async function generateSessionReports(
  athleteId: string,
  sessionIds: string[]
): Promise<GenerationResult> {
  const errors: string[] = []
  let reportsCreated = 0

  for (const sessionId of sessionIds) {
    try {
      // Skip if report already exists
      const exists = await hasReportForSession(sessionId)
      if (exists) {
        logger.info(`[ReportGenerator] Report already exists for session ${sessionId}`)
        continue
      }

      // Fetch session
      const session = await getSession(sessionId)
      if (!session) {
        errors.push(`Session ${sessionId} not found`)
        continue
      }

      // Only generate for cycling sessions with TSS > 0
      if (session.sport !== 'cycling') {
        logger.info(`[ReportGenerator] Skipping non-cycling session ${sessionId} (${session.sport})`)
        continue
      }
      if (!session.tss || session.tss <= 0) {
        logger.info(`[ReportGenerator] Skipping session ${sessionId} with no TSS`)
        continue
      }

      // Build session response data
      const sessionResponse = buildSessionResponse(session)

      // Fetch fitness context, goals, and similar sessions in parallel
      const [fitness, goals, comparison] = await Promise.all([
        getFitnessForDate(athleteId, session.date),
        getActiveGoals(athleteId),
        findSimilarSessions(athleteId, session),
      ])

      // Assemble prompt data
      const promptData: Record<string, unknown> = {
        session: sessionResponse.session,
        analysis: sessionResponse.analysis,
        fitness_context: fitness ? {
          ctl: fitness.ctl,
          atl: fitness.atl,
          tsb: fitness.tsb,
        } : null,
        comparison_context: comparison ? {
          similar_session_count: comparison.similar_session_count,
          avg_tss: comparison.avg_tss,
          avg_if: comparison.avg_if,
          avg_np: comparison.avg_np,
          insights: comparison.insights,
        } : null,
        active_goals: goals.length > 0 ? goals.map(g => ({
          id: g.id,
          title: g.title,
          target_type: g.target_type,
          target_value: g.target_value,
          current_value: g.current_value,
        })) : null,
      }

      // Generate report using Claude Opus
      const result = await generateObject({
        model: anthropic('claude-opus-4-5-20251101'),
        schema: reportSchema,
        system: REPORT_SYSTEM_PROMPT,
        prompt: buildReportPrompt(promptData),
      })

      const report = result.object

      // Build session context
      const sessionContext = {
        session_type: sessionResponse.analysis.sessionType,
        training_phase: null,
        days_since_last_session: null,
        weekly_tss_before: null,
        ctl: fitness?.ctl ?? null,
        atl: fitness?.atl ?? null,
        tsb: fitness?.tsb ?? null,
      }

      // Store report
      const reportInsert: SessionReportInsert = {
        athlete_id: athleteId,
        session_id: sessionId,
        score: report.score,
        headline: report.headline,
        quick_take: report.quick_take,
        deep_analysis: report.deep_analysis as DeepAnalysis,
        tags: report.tags,
        goal_relevance: report.goal_relevance,
        session_context: sessionContext,
        is_read: false,
      }

      const created = await createSessionReport(reportInsert)
      if (created) {
        reportsCreated++
        logger.info(`[ReportGenerator] Created report for session ${sessionId}: score=${report.score}, headline="${report.headline}"`)
      } else {
        errors.push(`Failed to store report for session ${sessionId}`)
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      logger.error(`[ReportGenerator] Error generating report for session ${sessionId}:`, error)
      errors.push(`Session ${sessionId}: ${msg}`)
    }
  }

  return {
    success: errors.length === 0,
    reports_created: reportsCreated,
    errors,
  }
}
