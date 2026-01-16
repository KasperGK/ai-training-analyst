import { z } from 'zod'
import { defineTool } from './types'
import { logWorkoutOutcome as logOutcome, getOutcomeStats } from '@/lib/db/workout-outcomes'

const inputSchema = z.object({
  sessionId: z.string().optional().describe('The session ID if linking to a completed workout'),
  suggestedWorkout: z.string().optional().describe('Description of what was suggested'),
  suggestedType: z.string().optional().describe('Type of workout that was suggested (e.g., sweetspot_2x20)'),
  actualType: z.string().optional().describe('Type of workout actually performed'),
  followedSuggestion: z.boolean().optional().describe('Did the athlete follow the suggestion?'),
  rpe: z.number().min(1).max(10).optional().describe('Perceived effort 1-10 (1=very easy, 10=maximal)'),
  feedback: z.string().optional().describe('Any feedback from the athlete about the workout'),
})

type Input = z.infer<typeof inputSchema>

interface SuccessResponse {
  success: true
  outcome: {
    id: string
    rpe: number | null
    feedback: string | null
    followedSuggestion: boolean | null
  }
  stats: {
    totalLogged: number
    followRate: number | null
    averageRPE: number | null
  }
  message: string
}

interface ErrorResponse {
  error: string
}

type Output = SuccessResponse | ErrorResponse

export const logWorkoutOutcome = defineTool<Input, Output>({
  description: 'Log the outcome of a workout - what was suggested vs what actually happened. Use this when the athlete reports how a workout went, provides feedback on a suggestion, or shares their perceived effort (RPE). This helps learn what works for this athlete.',
  inputSchema,
  execute: async ({
    sessionId,
    suggestedWorkout,
    suggestedType,
    actualType,
    followedSuggestion,
    rpe,
    feedback,
  }, ctx) => {
    if (!ctx.athleteId) {
      return { error: 'No athlete ID available' }
    }

    try {
      const outcome = await logOutcome(ctx.athleteId, {
        session_id: sessionId,
        suggested_workout: suggestedWorkout,
        suggested_type: suggestedType,
        actual_type: actualType,
        followed_suggestion: followedSuggestion,
        rpe,
        feedback,
      })

      if (!outcome) {
        return { error: 'Failed to log outcome' }
      }

      // Get updated stats
      const stats = await getOutcomeStats(ctx.athleteId, 90)

      return {
        success: true,
        outcome: {
          id: outcome.id,
          rpe: outcome.rpe,
          feedback: outcome.feedback,
          followedSuggestion: outcome.followed_suggestion,
        },
        stats: {
          totalLogged: stats.totalOutcomes,
          followRate: stats.totalOutcomes > 0
            ? Math.round((stats.followedSuggestions / stats.totalOutcomes) * 100)
            : null,
          averageRPE: stats.averageRPE,
        },
        message: `Logged workout outcome${rpe ? ` (RPE: ${rpe})` : ''}${feedback ? ` with feedback` : ''}`,
      }
    } catch (error) {
      console.error('[logWorkoutOutcome] Error:', error)
      return { error: 'Failed to log workout outcome' }
    }
  },
})
