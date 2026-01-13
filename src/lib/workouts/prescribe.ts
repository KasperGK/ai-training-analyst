// Intelligent Workout Prescription
// Scores and selects workouts based on athlete context and learned patterns

import {
  workoutLibrary,
  WorkoutTemplate,
  WorkoutCategory,
  TrainingPhase,
  getWorkoutsByCategory,
  getWorkoutsByPhase,
} from './library'
import type { AthletePatterns } from '@/lib/learning'

export interface AthleteContext {
  ftp: number
  weight_kg?: number
  ctl: number
  atl: number
  tsb: number
  phase?: TrainingPhase
  recent_workout_types?: WorkoutCategory[]
  days_since_intensity?: number
  weekly_hours_available?: number
  preferred_workout_types?: WorkoutCategory[]
  avoided_workout_types?: WorkoutCategory[]
  // Pattern data for personalized scoring
  patterns?: AthletePatterns
  dayOfWeek?: string // Current day for scheduling
}

export interface PrescriptionRequest {
  athlete: AthleteContext
  requested_type?: WorkoutCategory | 'any'
  target_duration_minutes?: number
  target_tss?: number
  exclude_ids?: string[]
}

export interface ScoredWorkout {
  workout: WorkoutTemplate
  score: number
  reasons: string[]
  warnings: string[]
  personalized_description: string
  personalized_intervals?: {
    sets: number
    duration_seconds: number
    rest_seconds: number
    target_power_min: number
    target_power_max: number
  }[]
}

// Score multipliers and weights
const WEIGHTS = {
  phase_match: 20,
  tsb_appropriate: 25,
  ctl_appropriate: 20,
  category_variety: 15,
  duration_match: 10,
  tss_match: 10,
  preference_match: 10,
  prerequisite_fail: -100, // Knockout factor
  // Pattern-based weights
  pattern_day_match: 15,      // Good day for this workout type
  pattern_day_avoid: -20,     // Bad day for intensity
  pattern_tsb_optimal: 15,    // TSB in athlete's optimal range
  pattern_tsb_risk: -15,      // TSB in athlete's risk zone
  pattern_type_success: 10,   // High completion rate for this type
  pattern_type_struggle: -10, // Low completion rate
}

/**
 * Score a workout for a given athlete context
 */
function scoreWorkout(
  workout: WorkoutTemplate,
  request: PrescriptionRequest
): ScoredWorkout {
  const { athlete } = request
  let score = 50 // Base score
  const reasons: string[] = []
  const warnings: string[] = []

  // Check prerequisites (knockout factors)
  const prereqs = workout.prerequisites

  // CTL check
  if (prereqs.min_ctl && athlete.ctl < prereqs.min_ctl) {
    score += WEIGHTS.prerequisite_fail
    warnings.push(`Requires CTL ≥ ${prereqs.min_ctl}, you have ${Math.round(athlete.ctl)}`)
  }
  if (prereqs.max_ctl && athlete.ctl > prereqs.max_ctl) {
    score += WEIGHTS.prerequisite_fail
    warnings.push(`Best for CTL ≤ ${prereqs.max_ctl}, you have ${Math.round(athlete.ctl)}`)
  }

  // TSB check
  if (prereqs.min_tsb && athlete.tsb < prereqs.min_tsb) {
    score += WEIGHTS.prerequisite_fail
    warnings.push(`Requires TSB ≥ ${prereqs.min_tsb}, you have ${Math.round(athlete.tsb)}`)
  }
  if (prereqs.max_tsb && athlete.tsb > prereqs.max_tsb) {
    score += WEIGHTS.prerequisite_fail / 2 // Less severe
    warnings.push(`Recovery workout when TSB is already high (${Math.round(athlete.tsb)})`)
  }

  // Days since intensity check
  if (prereqs.min_days_since_intensity && athlete.days_since_intensity !== undefined) {
    if (athlete.days_since_intensity < prereqs.min_days_since_intensity) {
      score -= 30
      warnings.push(`Recommend ${prereqs.min_days_since_intensity}+ days since last intensity`)
    }
  }

  // Recent workout types check
  if (prereqs.not_after_types && athlete.recent_workout_types) {
    const hasConflict = prereqs.not_after_types.some(type =>
      athlete.recent_workout_types!.includes(type)
    )
    if (hasConflict) {
      score -= 20
      warnings.push('Not recommended after recent similar workouts')
    }
  }

  // If prerequisites failed badly, return early
  if (score < 0) {
    return {
      workout,
      score,
      reasons,
      warnings,
      personalized_description: workout.description,
    }
  }

  // Phase match scoring
  if (athlete.phase) {
    if (workout.suitable_phases.includes(athlete.phase) || workout.suitable_phases.includes('any')) {
      score += WEIGHTS.phase_match
      reasons.push(`Suitable for ${athlete.phase} phase`)
    } else {
      score -= 10
      warnings.push(`Better suited for: ${workout.suitable_phases.join(', ')}`)
    }
  }

  // TSB-appropriate scoring
  if (athlete.tsb < -25) {
    // Very fatigued - recovery/easy workouts best
    if (workout.category === 'recovery') {
      score += WEIGHTS.tsb_appropriate
      reasons.push('Recovery workout appropriate for high fatigue')
    } else if (workout.category === 'endurance') {
      score += WEIGHTS.tsb_appropriate * 0.5
      reasons.push('Easy endurance acceptable with fatigue')
    } else {
      score -= 20
      warnings.push(`TSB ${Math.round(athlete.tsb)} suggests recovery, not intensity`)
    }
  } else if (athlete.tsb < -10) {
    // Moderately fatigued - tempo/sweetspot OK
    if (['recovery', 'endurance', 'tempo', 'sweetspot'].includes(workout.category)) {
      score += WEIGHTS.tsb_appropriate * 0.7
      reasons.push('Appropriate intensity for current fatigue')
    } else {
      score -= 10
      warnings.push('Consider easier workout with moderate fatigue')
    }
  } else if (athlete.tsb < 5) {
    // Neutral - good for any workout
    score += WEIGHTS.tsb_appropriate * 0.5
    reasons.push('Good training window (neutral TSB)')
  } else if (athlete.tsb < 25) {
    // Fresh - great for intensity
    if (['threshold', 'vo2max', 'anaerobic', 'sprint'].includes(workout.category)) {
      score += WEIGHTS.tsb_appropriate
      reasons.push('Fresh legs - ideal for high intensity')
    } else if (workout.category === 'recovery') {
      score -= 15
      warnings.push('Consider harder workout while fresh')
    }
  } else {
    // Very fresh - may be detraining
    if (workout.category !== 'recovery') {
      score += WEIGHTS.tsb_appropriate * 0.5
      reasons.push('Training recommended to prevent detraining')
    }
  }

  // CTL-appropriate scoring
  if (athlete.ctl < 30) {
    // Beginner - easier workouts preferred
    if (['recovery', 'endurance', 'tempo'].includes(workout.category)) {
      score += WEIGHTS.ctl_appropriate
      reasons.push('Appropriate for building fitness')
    }
  } else if (athlete.ctl < 60) {
    // Intermediate - all workouts OK
    score += WEIGHTS.ctl_appropriate * 0.7
  } else {
    // Advanced - harder workouts more beneficial
    if (['threshold', 'vo2max', 'anaerobic'].includes(workout.category)) {
      score += WEIGHTS.ctl_appropriate
      reasons.push('High fitness supports intensity')
    }
  }

  // Category variety scoring
  if (athlete.recent_workout_types && athlete.recent_workout_types.length > 0) {
    const didSameRecently = athlete.recent_workout_types.includes(workout.category)
    if (!didSameRecently) {
      score += WEIGHTS.category_variety
      reasons.push('Adds variety to recent training')
    } else {
      score -= 5
      // Not a warning, just slight preference for variety
    }
  }

  // Duration match scoring
  if (request.target_duration_minutes) {
    const diff = Math.abs(workout.duration_minutes - request.target_duration_minutes)
    if (diff <= 10) {
      score += WEIGHTS.duration_match
      reasons.push('Matches target duration')
    } else if (diff <= 20) {
      score += WEIGHTS.duration_match * 0.5
    } else {
      score -= 5
    }
  }

  // TSS match scoring
  if (request.target_tss) {
    const [minTSS, maxTSS] = workout.target_tss_range
    if (request.target_tss >= minTSS && request.target_tss <= maxTSS) {
      score += WEIGHTS.tss_match
      reasons.push('Matches target TSS')
    } else if (request.target_tss >= minTSS * 0.8 && request.target_tss <= maxTSS * 1.2) {
      score += WEIGHTS.tss_match * 0.5
    }
  }

  // Preference matching
  if (athlete.preferred_workout_types?.includes(workout.category)) {
    score += WEIGHTS.preference_match
    reasons.push('Matches your preferences')
  }
  if (athlete.avoided_workout_types?.includes(workout.category)) {
    score -= WEIGHTS.preference_match
    warnings.push('In your avoided workout types')
  }

  // Pattern-based scoring (learned from outcome history)
  if (athlete.patterns) {
    const { patterns } = athlete
    const isIntensity = ['threshold', 'vo2max', 'anaerobic', 'sprint'].includes(workout.category)

    // Day of week pattern matching
    if (athlete.dayOfWeek && patterns.dayOfWeek) {
      if (isIntensity) {
        if (patterns.dayOfWeek.bestIntensityDays.includes(athlete.dayOfWeek)) {
          score += WEIGHTS.pattern_day_match * patterns.dayOfWeek.confidence
          reasons.push(`${athlete.dayOfWeek} is your best day for intensity`)
        }
        if (patterns.dayOfWeek.avoidIntensityDays.includes(athlete.dayOfWeek)) {
          score += WEIGHTS.pattern_day_avoid * patterns.dayOfWeek.confidence
          warnings.push(`${athlete.dayOfWeek} historically not great for intensity`)
        }
      } else if (patterns.dayOfWeek.bestRecoveryDays.includes(athlete.dayOfWeek)) {
        score += WEIGHTS.pattern_day_match * 0.5 * patterns.dayOfWeek.confidence
        reasons.push('Good day for easier workouts based on your patterns')
      }
    }

    // TSB pattern matching
    if (patterns.tsb) {
      const { optimalTSB, riskZone } = patterns.tsb
      if (athlete.tsb >= optimalTSB.min && athlete.tsb <= optimalTSB.max) {
        score += WEIGHTS.pattern_tsb_optimal * patterns.tsb.confidence
        reasons.push('Your form is in your optimal zone')
      }
      if (athlete.tsb >= riskZone.min && athlete.tsb <= riskZone.max) {
        score += WEIGHTS.pattern_tsb_risk * patterns.tsb.confidence
        warnings.push('Form level historically challenging for you')
      }
    }

    // Workout type pattern matching
    const typePattern = patterns.workoutTypes.find(t => t.workoutType === workout.category)
    if (typePattern && typePattern.sampleSize >= 5) {
      if (typePattern.completionRate >= 0.8) {
        score += WEIGHTS.pattern_type_success
        reasons.push(`You consistently complete ${workout.category} workouts`)
      }
      if (typePattern.completionRate < 0.5) {
        score += WEIGHTS.pattern_type_struggle
        warnings.push(`You often skip ${workout.category} workouts (${Math.round(typePattern.completionRate * 100)}% completion)`)
      }
      if (typePattern.averageRPE > 8) {
        score -= 5
        warnings.push(`${workout.category} typically feels very hard for you (RPE ${typePattern.averageRPE})`)
      }
    }

    // Recovery pattern - adjust intensity recommendation
    if (patterns.recovery && isIntensity) {
      if (patterns.recovery.slowRecoverer && athlete.days_since_intensity && athlete.days_since_intensity < 3) {
        score -= 10
        warnings.push('Based on your recovery pattern, consider more rest before intensity')
      }
      if (patterns.recovery.fastRecoverer && athlete.days_since_intensity && athlete.days_since_intensity >= 2) {
        score += 5
        reasons.push('Your fast recovery supports doing intensity today')
      }
    }
  }

  // Build personalized description with actual power targets
  const personalizedDescription = personalizeWorkout(workout, athlete.ftp)

  return {
    workout,
    score: Math.round(score),
    reasons,
    warnings,
    personalized_description: personalizedDescription.description,
    personalized_intervals: personalizedDescription.intervals,
  }
}

/**
 * Personalize workout description with actual power values
 */
function personalizeWorkout(
  workout: WorkoutTemplate,
  ftp: number
): {
  description: string
  intervals?: ScoredWorkout['personalized_intervals']
} {
  let description = workout.description

  // Replace percentage references with actual watts
  description = description.replace(/(\d+)-(\d+)% FTP/g, (_, min, max) => {
    const minWatts = Math.round(ftp * (parseInt(min) / 100))
    const maxWatts = Math.round(ftp * (parseInt(max) / 100))
    return `${minWatts}-${maxWatts}W (${min}-${max}% FTP)`
  })

  description = description.replace(/(\d+)% FTP/g, (_, pct) => {
    const watts = Math.round(ftp * (parseInt(pct) / 100))
    return `${watts}W (${pct}% FTP)`
  })

  // Personalize intervals if present
  let intervals: ScoredWorkout['personalized_intervals'] | undefined
  if (workout.intervals) {
    intervals = workout.intervals.map(interval => ({
      sets: interval.sets,
      duration_seconds: interval.duration_seconds,
      rest_seconds: interval.rest_seconds,
      target_power_min: Math.round(ftp * (interval.intensity_min / 100)),
      target_power_max: Math.round(ftp * (interval.intensity_max / 100)),
    }))
  }

  return { description, intervals }
}

/**
 * Get the best workout recommendations for an athlete
 */
export function prescribeWorkout(request: PrescriptionRequest): ScoredWorkout[] {
  let candidates = workoutLibrary

  // Filter by requested type if specified
  if (request.requested_type && request.requested_type !== 'any') {
    candidates = getWorkoutsByCategory(request.requested_type)
  }

  // Filter by phase if specified
  if (request.athlete.phase) {
    const phaseWorkouts = getWorkoutsByPhase(request.athlete.phase)
    candidates = candidates.filter(w => phaseWorkouts.includes(w))
  }

  // Exclude specific IDs if requested
  if (request.exclude_ids && request.exclude_ids.length > 0) {
    candidates = candidates.filter(w => !request.exclude_ids!.includes(w.id))
  }

  // Score all candidates
  const scored = candidates.map(workout => scoreWorkout(workout, request))

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  return scored
}

/**
 * Get top workout recommendation
 */
export function getBestWorkout(request: PrescriptionRequest): ScoredWorkout | null {
  const results = prescribeWorkout(request)
  return results.length > 0 ? results[0] : null
}

/**
 * Get workout recommendations by type, respecting athlete context
 */
export function getWorkoutRecommendationsByType(
  athlete: AthleteContext
): Record<WorkoutCategory, ScoredWorkout | null> {
  const categories: WorkoutCategory[] = [
    'recovery',
    'endurance',
    'tempo',
    'sweetspot',
    'threshold',
    'vo2max',
    'anaerobic',
    'sprint',
  ]

  const result: Record<WorkoutCategory, ScoredWorkout | null> = {
    recovery: null,
    endurance: null,
    tempo: null,
    sweetspot: null,
    threshold: null,
    vo2max: null,
    anaerobic: null,
    sprint: null,
    mixed: null,
  }

  for (const category of categories) {
    const best = getBestWorkout({
      athlete,
      requested_type: category,
    })
    result[category] = best
  }

  return result
}

/**
 * Suggest workout type based on current form
 */
export function suggestWorkoutType(athlete: AthleteContext): {
  suggested: WorkoutCategory
  reason: string
  alternatives: WorkoutCategory[]
} {
  const { tsb, ctl, phase } = athlete

  // Very fatigued
  if (tsb < -25) {
    return {
      suggested: 'recovery',
      reason: `TSB of ${Math.round(tsb)} indicates significant fatigue. Recovery recommended.`,
      alternatives: ['endurance'],
    }
  }

  // Moderately fatigued
  if (tsb < -15) {
    return {
      suggested: 'endurance',
      reason: `TSB of ${Math.round(tsb)} suggests building fatigue. Easy endurance recommended.`,
      alternatives: ['recovery', 'tempo'],
    }
  }

  // Slightly fatigued
  if (tsb < -5) {
    if (ctl < 50) {
      return {
        suggested: 'sweetspot',
        reason: 'Moderate fatigue with developing fitness. Sweet spot builds FTP efficiently.',
        alternatives: ['tempo', 'endurance'],
      }
    }
    return {
      suggested: 'tempo',
      reason: 'Moderate fatigue. Tempo maintains fitness without excessive stress.',
      alternatives: ['sweetspot', 'endurance'],
    }
  }

  // Neutral
  if (tsb < 10) {
    if (phase === 'base') {
      return {
        suggested: 'sweetspot',
        reason: 'Good training window during base phase. Sweet spot builds FTP.',
        alternatives: ['threshold', 'tempo'],
      }
    }
    if (phase === 'build') {
      return {
        suggested: 'threshold',
        reason: 'Optimal training window during build phase. Threshold work recommended.',
        alternatives: ['vo2max', 'sweetspot'],
      }
    }
    return {
      suggested: 'threshold',
      reason: 'Good form for quality work. Threshold intervals recommended.',
      alternatives: ['sweetspot', 'vo2max'],
    }
  }

  // Fresh
  if (tsb < 25) {
    if (phase === 'peak') {
      return {
        suggested: 'vo2max',
        reason: 'Fresh legs in peak phase. High intensity work will sharpen fitness.',
        alternatives: ['threshold', 'sprint'],
      }
    }
    return {
      suggested: 'vo2max',
      reason: `Fresh with TSB of ${Math.round(tsb)}. Great day for high intensity.`,
      alternatives: ['threshold', 'anaerobic'],
    }
  }

  // Very fresh (potential detraining)
  return {
    suggested: 'threshold',
    reason: `Very fresh (TSB ${Math.round(tsb)}). Training now prevents fitness loss.`,
    alternatives: ['vo2max', 'sweetspot'],
  }
}
