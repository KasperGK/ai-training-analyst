import { z } from 'zod'
import { defineTool } from './types'
import { enrichAthleteContext } from './utils/athlete-context-utils'
import { prescribeWorkout, suggestWorkoutType, type AthleteContext as WorkoutAthleteContext } from '@/lib/workouts/prescribe'
import { workoutLibrary, type WorkoutCategory } from '@/lib/workouts/library'
import { analyzeAthletePatterns } from '@/lib/learning'

const inputSchema = z.object({
  type: z.enum([
    'any', 'recovery', 'endurance', 'tempo', 'sweetspot', 'threshold', 'vo2max', 'anaerobic', 'sprint'
  ]).describe('Workout category, or "any" to let the system choose based on current form'),
  durationMinutes: z.number().optional().describe('Target duration in minutes (will find closest match)'),
  targetTSS: z.number().optional().describe('Target TSS for the workout'),
  showAlternatives: z.boolean().optional().describe('Include alternative workout options'),
})

type Input = z.infer<typeof inputSchema>

interface WorkoutInterval {
  sets: number
  duration_seconds: number
  rest_seconds: number
  target_power_min: number
  target_power_max: number
}

interface WorkoutResponse {
  workout: {
    id: string
    name: string
    category: string
    duration_minutes: number
    target_tss_range: [number, number]
    description: string
    purpose: string
    execution_tips: string[]
    common_mistakes: string[]
    intervals?: WorkoutInterval[]
  }
  scoring: {
    score: number
    reasons: string[]
    warnings: string[]
  }
  context: {
    currentTSB: number
    currentCTL: number
    currentATL: number
    ftp: number
    profileSource: string
    selectedBecause: string
    fitnessSource: string
  }
  profileWarnings?: string[]
  alternatives?: Array<{
    id: string
    name: string
    category: string
    score: number
    duration_minutes: number
  }>
  libraryStats: {
    totalWorkouts: number
    availableCategories: string[]
  }
}

interface ErrorResponse {
  error: string
}

type Output = WorkoutResponse | ErrorResponse

export const suggestWorkout = defineTool<Input, Output>({
  description: 'Generate an intelligent workout recommendation from a library of 34 structured workouts. Considers current fitness, fatigue, training phase, and preferences. Returns personalized power targets and detailed execution guidance.',
  inputSchema,
  execute: async ({ type, durationMinutes, targetTSS, showAlternatives = false }, ctx) => {
    // Gather athlete context from best available source — no hardcoded defaults
    const enriched = await enrichAthleteContext(ctx)
    if (!enriched.ftp) {
      return {
        error: 'Cannot suggest a workout without your FTP. Please set your FTP in intervals.icu or your profile settings.',
        warnings: enriched.warnings,
      } as unknown as Output
    }
    const athleteFTP = enriched.ftp
    const weightKg = enriched.weight_kg ?? undefined
    const currentTSB = enriched.tsb
    const currentCTL = enriched.ctl
    const currentATL = enriched.atl
    const fitnessSource = enriched.fitness_source

    // Fetch athlete patterns for personalized prescription
    let patterns = undefined
    if (ctx.athleteId) {
      try {
        const athletePatterns = await analyzeAthletePatterns(ctx.athleteId, {
          days: 90,
          saveAsMemories: false,  // Don't save during workout suggestions
        })
        // Only use patterns if we have enough data
        if (athletePatterns.dataPoints >= 5) {
          patterns = athletePatterns
        }
      } catch {
        // Continue without patterns - prescription still works
      }
    }

    // Get current day of week for pattern-based scoring
    const today = new Date()
    const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' }) as
      'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday'

    // Build workout athlete context with patterns
    const workoutContext: WorkoutAthleteContext = {
      ftp: athleteFTP,
      weight_kg: weightKg,
      ctl: currentCTL,
      atl: currentATL,
      tsb: currentTSB,
      patterns,     // Pattern data for personalized scoring
      dayOfWeek,    // Current day for day-of-week pattern matching
    }

    // If type is 'any', get suggested type
    let requestedType: WorkoutCategory | 'any' = type as WorkoutCategory | 'any'
    let suggestedReason = ''

    if (type === 'any') {
      const suggestion = suggestWorkoutType(workoutContext)
      requestedType = suggestion.suggested
      suggestedReason = suggestion.reason
    }

    // Get prescription
    const scored = prescribeWorkout({
      athlete: workoutContext,
      requested_type: requestedType,
      target_duration_minutes: durationMinutes,
      target_tss: targetTSS,
    })

    if (scored.length === 0) {
      return { error: 'No suitable workouts found for your current context.' }
    }

    const best = scored[0]
    const workout = best.workout

    // Build response
    const response: WorkoutResponse = {
      workout: {
        id: workout.id,
        name: workout.name,
        category: workout.category,
        duration_minutes: workout.duration_minutes,
        target_tss_range: workout.target_tss_range,
        description: best.personalized_description,
        purpose: workout.purpose,
        execution_tips: workout.execution_tips,
        common_mistakes: workout.common_mistakes,
        intervals: best.personalized_intervals,
      },
      scoring: {
        score: best.score,
        reasons: best.reasons,
        warnings: best.warnings,
      },
      context: {
        currentTSB: Math.round(currentTSB),
        currentCTL: Math.round(currentCTL),
        currentATL: Math.round(currentATL),
        ftp: athleteFTP,
        profileSource: enriched.profile_source,
        selectedBecause: type === 'any'
          ? suggestedReason
          : `You requested a ${type} workout. Selected "${workout.name}" as best match (score: ${best.score}).`,
        fitnessSource,
      },
      profileWarnings: enriched.warnings.length > 0 ? enriched.warnings : undefined,
      libraryStats: {
        totalWorkouts: workoutLibrary.length,
        availableCategories: ['recovery', 'endurance', 'tempo', 'sweetspot', 'threshold', 'vo2max', 'anaerobic', 'sprint'],
      },
    }

    // Add alternatives if requested
    if (showAlternatives && scored.length > 1) {
      response.alternatives = scored.slice(1, 4).map(s => ({
        id: s.workout.id,
        name: s.workout.name,
        category: s.workout.category,
        score: s.score,
        duration_minutes: s.workout.duration_minutes,
      }))
    }

    return response
  },
})
