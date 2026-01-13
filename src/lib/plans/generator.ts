// Training Plan Generator
// Generates personalized training plans from templates
// With pattern-based personalization from outcome learning

import {
  PlanTemplate,
  WeekTemplate,
  planTemplates,
  getPlanTemplateById,
  getApplicablePlans,
  type PlanGoal,
} from './templates'
import { getWorkoutById, workoutLibrary, type WorkoutTemplate } from '../workouts/library'
import type { AthletePatterns } from '@/lib/learning'

export interface GeneratePlanInput {
  templateId?: string
  goal?: PlanGoal
  startDate: string  // ISO date
  weeklyHoursTarget?: number
  keyWorkoutDays?: number[]  // Days of week (0=Sun, 6=Sat)
  targetEventDate?: string  // ISO date (for taper timing)
  athleteContext: {
    ftp: number
    ctl: number
    atl?: number
    weight_kg?: number
  }
  // Learned patterns for personalization
  patterns?: AthletePatterns
}

export interface GeneratedPlanDay {
  date: string
  weekNumber: number
  dayOfWeek: number
  workout: {
    templateId: string | null
    name: string
    category: string
    targetTSS: number
    targetDurationMinutes: number
    targetIF: number
    description: string
    intervals?: Array<{
      sets: number
      durationSeconds: number
      restSeconds: number
      targetPowerMin: number
      targetPowerMax: number
    }>
  } | null  // null for rest days
  isKeyWorkout: boolean
  isRecoveryDay: boolean
  weekFocus: string
}

export interface GeneratedPlan {
  templateId: string
  templateName: string
  goal: PlanGoal
  description: string
  startDate: string
  endDate: string
  durationWeeks: number
  weeklyHoursTarget: number
  targetEventDate: string | null
  weeks: Array<{
    weekNumber: number
    phase: string
    focusDescription: string
    targetTSSRange: [number, number]
    actualTargetTSS: number
    days: GeneratedPlanDay[]
  }>
  summary: {
    totalDays: number
    totalWorkoutDays: number
    totalRestDays: number
    avgWeeklyTSS: number
    phases: Array<{ phase: string; weeks: number }>
  }
}

export interface PlanGenerationResult {
  success: boolean
  plan?: GeneratedPlan
  error?: string
  warnings: string[]
}

/**
 * Select the best template based on input criteria
 */
export function selectBestTemplate(
  input: GeneratePlanInput
): { template: PlanTemplate; reason: string } | null {
  // If specific template requested, use it
  if (input.templateId) {
    const template = getPlanTemplateById(input.templateId)
    if (template) {
      return { template, reason: `Requested template: ${template.name}` }
    }
  }

  // Filter by CTL
  const applicable = getApplicablePlans(input.athleteContext.ctl)

  if (applicable.length === 0) {
    // Find the plan with lowest minCTL as fallback
    const sortedByMinCTL = [...planTemplates].sort((a, b) => a.minCTL - b.minCTL)
    return {
      template: sortedByMinCTL[0],
      reason: `Fitness below typical thresholds (CTL: ${input.athleteContext.ctl}), using ${sortedByMinCTL[0].name} as starting point`,
    }
  }

  // Filter by goal if specified
  let candidates = input.goal
    ? applicable.filter(t => t.goal === input.goal)
    : applicable

  // Fall back to all applicable if no goal match
  if (candidates.length === 0) {
    candidates = applicable
  }

  // If targeting an event, prefer event prep or taper based on timing
  if (input.targetEventDate) {
    const eventDate = new Date(input.targetEventDate)
    const startDate = new Date(input.startDate)
    const weeksToEvent = Math.ceil((eventDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000))

    if (weeksToEvent <= 4) {
      // Taper time
      const taper = candidates.find(t => t.goal === 'taper')
      if (taper) {
        return { template: taper, reason: `${weeksToEvent} weeks to event - taper phase selected` }
      }
    } else if (weeksToEvent >= 10) {
      // Full event prep possible
      const eventPrep = candidates.find(t => t.goal === 'event_prep')
      if (eventPrep) {
        return { template: eventPrep, reason: `${weeksToEvent} weeks to event - full event prep selected` }
      }
    }
  }

  // Default scoring based on goal match and fitness
  const scored = candidates.map(t => {
    let score = 50
    if (input.goal && t.goal === input.goal) score += 30
    if (input.athleteContext.ctl >= t.minCTL + 10) score += 10 // Good fitness margin
    if (t.goal === 'maintenance') score -= 10 // Prefer specific goals
    return { template: t, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]

  return {
    template: best.template,
    reason: `Best match for CTL ${input.athleteContext.ctl}${input.goal ? ` and goal "${input.goal}"` : ''}`,
  }
}

/**
 * Calculate baseline weekly TSS from CTL and hours
 */
function calculateBaselineTSS(ctl: number, weeklyHours: number): number {
  // Rough estimation: TSS ≈ IF² × hours × 100
  // For maintenance, target TSS ≈ CTL × 7 (daily)
  // Adjust based on available hours
  const tssFromCTL = ctl * 7
  const tssFromHours = weeklyHours * 60 // ~60 TSS/hour for mixed intensity

  return Math.round((tssFromCTL + tssFromHours) / 2)
}

/**
 * Suggest key workout days based on learned patterns
 */
function suggestKeyDaysFromPatterns(patterns: AthletePatterns): {
  days: number[]
  reason: string
} | null {
  if (!patterns.dayOfWeek || patterns.dayOfWeek.confidence < 0.4) {
    return null
  }

  const DAY_MAP: Record<string, number> = {
    'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
    'Thursday': 4, 'Friday': 5, 'Saturday': 6,
  }

  const bestDays = patterns.dayOfWeek.bestIntensityDays
    .map(d => DAY_MAP[d])
    .filter(d => d !== undefined)

  const avoidDays = new Set(patterns.dayOfWeek.avoidIntensityDays
    .map(d => DAY_MAP[d])
    .filter(d => d !== undefined))

  // Start with best intensity days, add recovery days in between
  const keyDays = new Set(bestDays.slice(0, 2))

  // Add a third day that's not in avoid list and provides good spacing
  const allDays = [0, 1, 2, 3, 4, 5, 6]
  for (const day of allDays) {
    if (keyDays.size >= 3) break
    if (!keyDays.has(day) && !avoidDays.has(day)) {
      // Check spacing - want at least 1 day between intensity
      const days = Array.from(keyDays)
      const hasGoodSpacing = days.every(d => Math.abs(d - day) > 1 || Math.abs(d - day + 7) > 1)
      if (hasGoodSpacing) {
        keyDays.add(day)
      }
    }
  }

  if (keyDays.size < 2) return null

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const sortedDays = Array.from(keyDays).sort((a, b) => a - b)

  return {
    days: sortedDays,
    reason: `Based on your patterns: best days for intensity are ${sortedDays.map(d => dayNames[d]).join(', ')}`,
  }
}

/**
 * Suggest weekly hours based on volume/intensity patterns
 */
function suggestWeeklyHoursFromPatterns(
  patterns: AthletePatterns,
  requestedHours?: number
): { hours: number; warning?: string } {
  const defaultHours = requestedHours || 8

  if (!patterns.volumeIntensity || patterns.volumeIntensity.confidence < 0.4) {
    return { hours: defaultHours }
  }

  const { weeklyHoursSweet } = patterns.volumeIntensity

  // If requested hours are outside sweet spot, suggest adjustment
  if (requestedHours) {
    if (requestedHours < weeklyHoursSweet.min) {
      return {
        hours: weeklyHoursSweet.min,
        warning: `Adjusted from ${requestedHours}h to ${weeklyHoursSweet.min}h - your patterns show better results with at least ${weeklyHoursSweet.min}h/week`,
      }
    }
    if (requestedHours > weeklyHoursSweet.max) {
      return {
        hours: weeklyHoursSweet.max,
        warning: `Adjusted from ${requestedHours}h to ${weeklyHoursSweet.max}h - your patterns suggest diminishing returns above ${weeklyHoursSweet.max}h/week`,
      }
    }
    return { hours: requestedHours }
  }

  // Default to middle of sweet spot
  const suggestedHours = Math.round((weeklyHoursSweet.min + weeklyHoursSweet.max) / 2)
  return { hours: suggestedHours }
}

/**
 * Select best workout for a given slot
 */
function selectWorkoutForSlot(
  keyWorkout: WeekTemplate['keyWorkouts'][0],
  targetTSS: number,
  ftp: number
): { workout: WorkoutTemplate; adjustedTSS: number; adjustedDuration: number } | null {
  // Try preferred workouts first
  if (keyWorkout.preferredWorkoutIds) {
    for (const id of keyWorkout.preferredWorkoutIds) {
      const workout = getWorkoutById(id)
      if (workout) {
        const midTSS = (workout.target_tss_range[0] + workout.target_tss_range[1]) / 2
        return {
          workout,
          adjustedTSS: Math.round(targetTSS),
          adjustedDuration: workout.duration_minutes,
        }
      }
    }
  }

  // Fall back to category search
  const categoryWorkouts = workoutLibrary.filter(w => w.category === keyWorkout.category)
  if (categoryWorkouts.length === 0) return null

  // Find closest TSS match
  const sorted = categoryWorkouts.map(w => ({
    workout: w,
    tssDiff: Math.abs(((w.target_tss_range[0] + w.target_tss_range[1]) / 2) - targetTSS),
  })).sort((a, b) => a.tssDiff - b.tssDiff)

  const best = sorted[0].workout
  return {
    workout: best,
    adjustedTSS: Math.round(targetTSS),
    adjustedDuration: best.duration_minutes,
  }
}

/**
 * Generate a complete training plan from a template
 */
export function generateTrainingPlan(input: GeneratePlanInput): PlanGenerationResult {
  const warnings: string[] = []

  // Select template
  const selection = selectBestTemplate(input)
  if (!selection) {
    return {
      success: false,
      error: 'No suitable plan template found for your current fitness level',
      warnings,
    }
  }

  const { template, reason } = selection
  warnings.push(reason)

  // Validate dates
  const startDate = new Date(input.startDate)
  if (isNaN(startDate.getTime())) {
    return { success: false, error: 'Invalid start date', warnings }
  }

  // Calculate end date
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + (template.durationWeeks * 7) - 1)

  // Determine weekly hours and baseline TSS (with pattern-based suggestions)
  let weeklyHours = input.weeklyHoursTarget || 8
  if (input.patterns) {
    const hoursSuggestion = suggestWeeklyHoursFromPatterns(input.patterns, input.weeklyHoursTarget)
    weeklyHours = hoursSuggestion.hours
    if (hoursSuggestion.warning) {
      warnings.push(hoursSuggestion.warning)
    }
  }
  const baselineTSS = calculateBaselineTSS(input.athleteContext.ctl, weeklyHours)

  // Determine key workout days (with pattern-based suggestions)
  let keyDays = input.keyWorkoutDays || [2, 4, 6] // Default: Tue, Thu, Sat
  if (!input.keyWorkoutDays && input.patterns) {
    const daySuggestion = suggestKeyDaysFromPatterns(input.patterns)
    if (daySuggestion) {
      keyDays = daySuggestion.days
      warnings.push(daySuggestion.reason)
    }
  }

  // Pattern-based recovery warnings
  if (input.patterns?.recovery?.slowRecoverer) {
    warnings.push('You recover slower than average - plan includes adequate rest between intensity days')
  }
  if (input.patterns?.volumeIntensity?.prefersIntensity) {
    warnings.push('Based on your patterns, plan emphasizes quality over quantity')
  } else if (input.patterns?.volumeIntensity?.prefersVolume) {
    warnings.push('Based on your patterns, plan emphasizes aerobic volume')
  }

  // Check fitness warnings
  if (input.athleteContext.ctl < template.minCTL) {
    warnings.push(`Current CTL (${input.athleteContext.ctl}) is below recommended minimum (${template.minCTL}). Plan may be challenging.`)
  }

  // Generate weeks
  const weeks: GeneratedPlan['weeks'] = []
  const phaseCount: Record<string, number> = {}

  for (let weekIdx = 0; weekIdx < template.weeks.length; weekIdx++) {
    const weekTemplate = template.weeks[weekIdx]
    const weekStartDate = new Date(startDate)
    weekStartDate.setDate(weekStartDate.getDate() + (weekIdx * 7))

    // Calculate this week's target TSS using progression
    const weekMultiplier = template.weeklyTSSProgression[weekIdx] || 1.0
    const weekTargetTSS = Math.round(baselineTSS * weekMultiplier)

    // Track phases
    phaseCount[weekTemplate.phase] = (phaseCount[weekTemplate.phase] || 0) + 1

    // Generate days for this week
    const days: GeneratedPlanDay[] = []

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const dayDate = new Date(weekStartDate)
      dayDate.setDate(dayDate.getDate() + dayOffset)
      const dayOfWeek = dayDate.getDay()
      const dateStr = dayDate.toISOString().split('T')[0]

      // Determine if this is a key workout day
      const keyDayIndex = keyDays.indexOf(dayOfWeek)
      const isKeyDay = keyDayIndex !== -1

      // Find the workout for this day
      let workout: GeneratedPlanDay['workout'] = null
      let isRecoveryDay = false

      if (isKeyDay && keyDayIndex < weekTemplate.keyWorkouts.length) {
        const keyWorkout = weekTemplate.keyWorkouts[keyDayIndex]
        const slotTSS = Math.round(weekTargetTSS * (keyWorkout.targetTSSPercent / 100))

        const selected = selectWorkoutForSlot(keyWorkout, slotTSS, input.athleteContext.ftp)

        if (selected) {
          // Calculate personalized intervals
          const intervals = selected.workout.intervals?.map(interval => ({
            sets: interval.sets,
            durationSeconds: interval.duration_seconds,
            restSeconds: interval.rest_seconds,
            targetPowerMin: Math.round(input.athleteContext.ftp * (interval.intensity_min / 100)),
            targetPowerMax: Math.round(input.athleteContext.ftp * (interval.intensity_max / 100)),
          }))

          workout = {
            templateId: selected.workout.id,
            name: selected.workout.name,
            category: selected.workout.category,
            targetTSS: selected.adjustedTSS,
            targetDurationMinutes: selected.adjustedDuration,
            targetIF: (selected.workout.intensity_factor_range[0] + selected.workout.intensity_factor_range[1]) / 2,
            description: selected.workout.description,
            intervals,
          }
        }

        isRecoveryDay = keyWorkout.category === 'recovery'
      } else if (!isKeyDay) {
        // Non-key days are rest or easy spin
        isRecoveryDay = true
      }

      days.push({
        date: dateStr,
        weekNumber: weekIdx + 1,
        dayOfWeek,
        workout,
        isKeyWorkout: isKeyDay && workout !== null,
        isRecoveryDay,
        weekFocus: weekTemplate.focusDescription,
      })
    }

    weeks.push({
      weekNumber: weekIdx + 1,
      phase: weekTemplate.phase,
      focusDescription: weekTemplate.focusDescription,
      targetTSSRange: weekTemplate.targetTSSRange,
      actualTargetTSS: weekTargetTSS,
      days,
    })
  }

  // Calculate summary
  const totalWorkoutDays = weeks.flatMap(w => w.days).filter(d => d.workout !== null).length
  const totalRestDays = weeks.flatMap(w => w.days).filter(d => d.workout === null).length
  const avgWeeklyTSS = Math.round(weeks.reduce((sum, w) => sum + w.actualTargetTSS, 0) / weeks.length)

  const phases = Object.entries(phaseCount).map(([phase, count]) => ({ phase, weeks: count }))

  const plan: GeneratedPlan = {
    templateId: template.id,
    templateName: template.name,
    goal: template.goal,
    description: template.description,
    startDate: input.startDate,
    endDate: endDate.toISOString().split('T')[0],
    durationWeeks: template.durationWeeks,
    weeklyHoursTarget: weeklyHours,
    targetEventDate: input.targetEventDate || null,
    weeks,
    summary: {
      totalDays: template.durationWeeks * 7,
      totalWorkoutDays,
      totalRestDays,
      avgWeeklyTSS,
      phases,
    },
  }

  return {
    success: true,
    plan,
    warnings,
  }
}

/**
 * Get available plan templates with applicability info
 */
export function getAvailablePlans(currentCTL: number): Array<{
  id: string
  name: string
  goal: PlanGoal
  durationWeeks: number
  description: string
  isApplicable: boolean
  minCTL: number
  fitnessGap: number | null
}> {
  return planTemplates.map(t => ({
    id: t.id,
    name: t.name,
    goal: t.goal,
    durationWeeks: t.durationWeeks,
    description: t.description,
    isApplicable: currentCTL >= t.minCTL,
    minCTL: t.minCTL,
    fitnessGap: currentCTL < t.minCTL ? t.minCTL - currentCTL : null,
  }))
}
