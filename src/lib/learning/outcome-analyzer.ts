/**
 * Outcome Pattern Analyzer
 *
 * Analyzes workout outcomes over time to detect patterns:
 * - Recovery rate: How quickly does the athlete recover?
 * - Volume vs intensity response: What produces better outcomes?
 * - Optimal TSB: What form level produces best results?
 * - Day patterns: Which days work best for different workout types?
 *
 * Patterns are automatically saved as athlete memories for personalization.
 */

import { createClient } from '@/lib/supabase/server'
import { getWorkoutOutcomes, type WorkoutOutcome } from '@/lib/db/workout-outcomes'
import { getSessions } from '@/lib/db/sessions'
import { getFitnessHistory } from '@/lib/db/fitness'
import { upsertMemory, type MemoryType } from '@/lib/personalization/athlete-memory'
import type { Session, FitnessHistory } from '@/types'

// Pattern types we detect
export interface RecoveryPattern {
  averageRecoveryDays: number // Days for TSB to return to baseline after intensity
  fastRecoverer: boolean // Recovers faster than average (< 2 days)
  slowRecoverer: boolean // Recovers slower than average (> 3 days)
  confidence: number // 0-1 based on sample size
}

export interface TSBPattern {
  optimalTSB: { min: number; max: number } // TSB range with best outcomes
  riskZone: { min: number; max: number } // TSB range with worst outcomes
  peakPerformanceTSB: number // Single best TSB value
  confidence: number
}

export interface WorkoutTypePattern {
  workoutType: string
  completionRate: number // % of suggestions followed
  averageRPE: number
  bestDays: string[] // Days of week with best outcomes
  worstDays: string[] // Days to avoid
  sampleSize: number
}

export interface VolumeIntensityPattern {
  prefersVolume: boolean // Responds better to high volume, low intensity
  prefersIntensity: boolean // Responds better to high intensity, lower volume
  balancedResponse: boolean // No clear preference
  weeklyHoursSweet: { min: number; max: number } // Optimal weekly hours
  confidence: number
}

export interface DayOfWeekPattern {
  bestIntensityDays: string[] // Best days for hard workouts
  bestRecoveryDays: string[] // Best days for easy workouts
  avoidIntensityDays: string[] // Days with poor intensity outcomes
  confidence: number
}

export interface AthletePatterns {
  recovery: RecoveryPattern | null
  tsb: TSBPattern | null
  workoutTypes: WorkoutTypePattern[]
  volumeIntensity: VolumeIntensityPattern | null
  dayOfWeek: DayOfWeekPattern | null
  analyzedAt: string
  dataPoints: number
}

// Helpers
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function getDayName(date: Date): string {
  return DAY_NAMES[date.getDay()]
}

/**
 * Build a Map for O(1) fitness lookups by date
 */
function buildFitnessMap(fitnessHistory: FitnessHistory[]): Map<string, FitnessHistory> {
  return new Map(fitnessHistory.map(f => [f.date, f]))
}

/**
 * Build a Map for O(1) session lookups by date
 */
function buildSessionMap(sessions: Session[]): Map<string, Session> {
  const map = new Map<string, Session>()
  for (const s of sessions) {
    const dateKey = s.date.split('T')[0]
    if (!map.has(dateKey)) {
      map.set(dateKey, s)
    }
  }
  return map
}

/**
 * Build a Map for O(1) session lookups by ID
 */
function buildSessionIdMap(sessions: Session[]): Map<string, Session> {
  return new Map(sessions.map(s => [s.id, s]))
}

/**
 * Analyze recovery patterns from fitness history
 * Uses pre-built Map for O(1) lookups instead of O(n) find()
 */
function analyzeRecoveryPatterns(
  fitnessMap: Map<string, FitnessHistory>,
  sessions: Session[]
): RecoveryPattern | null {
  if (fitnessMap.size < 14) return null

  // Find intensity days (TSS > 80 or IF > 0.85)
  const intensityDays: { date: string; tsb: number }[] = []

  for (const session of sessions) {
    if ((session.tss && session.tss > 80) || (session.intensity_factor && session.intensity_factor > 0.85)) {
      const dateKey = session.date.split('T')[0]
      const fitness = fitnessMap.get(dateKey)
      if (fitness) {
        intensityDays.push({ date: dateKey, tsb: fitness.tsb })
      }
    }
  }

  if (intensityDays.length < 3) return null

  // Calculate recovery time for each intensity session
  const recoveryTimes: number[] = []

  for (let i = 0; i < intensityDays.length - 1; i++) {
    const intensityDate = new Date(intensityDays[i].date)
    const baselineTSB = intensityDays[i].tsb

    // Look for TSB returning to baseline (or positive) in subsequent days
    let recoveryDays = 0
    for (let j = 1; j <= 7; j++) {
      const checkDate = new Date(intensityDate)
      checkDate.setDate(checkDate.getDate() + j)
      const checkFitness = fitnessMap.get(checkDate.toISOString().split('T')[0])

      if (checkFitness && checkFitness.tsb >= baselineTSB) {
        recoveryDays = j
        break
      }
      recoveryDays = j
    }

    if (recoveryDays > 0 && recoveryDays <= 7) {
      recoveryTimes.push(recoveryDays)
    }
  }

  if (recoveryTimes.length < 3) return null

  const averageRecovery = recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length
  const confidence = Math.min(1, recoveryTimes.length / 10)

  return {
    averageRecoveryDays: Math.round(averageRecovery * 10) / 10,
    fastRecoverer: averageRecovery < 2,
    slowRecoverer: averageRecovery > 3,
    confidence,
  }
}

/**
 * Analyze TSB patterns - what form level produces best outcomes
 */
function analyzeTSBPatterns(
  outcomes: WorkoutOutcome[],
  fitnessMap: Map<string, FitnessHistory>,
  sessionIdMap: Map<string, Session>
): TSBPattern | null {
  if (outcomes.length < 5 || fitnessMap.size < 7) return null

  // Correlate outcomes with TSB on workout day
  const tsbOutcomes: { tsb: number; rpe: number; followed: boolean }[] = []

  for (const outcome of outcomes) {
    if (outcome.session_id) {
      const session = sessionIdMap.get(outcome.session_id)
      if (session) {
        const fitness = fitnessMap.get(session.date.split('T')[0])
        if (fitness && outcome.rpe) {
          tsbOutcomes.push({
            tsb: fitness.tsb,
            rpe: outcome.rpe,
            followed: outcome.followed_suggestion ?? true,
          })
        }
      }
    }
  }

  if (tsbOutcomes.length < 5) return null

  // Group by TSB ranges
  const ranges = [
    { min: -30, max: -15, label: 'very_fatigued' },
    { min: -15, max: -5, label: 'fatigued' },
    { min: -5, max: 5, label: 'neutral' },
    { min: 5, max: 15, label: 'fresh' },
    { min: 15, max: 30, label: 'very_fresh' },
  ]

  const rangeStats: Record<string, { rpeSum: number; count: number; followedCount: number }> = {}

  for (const outcome of tsbOutcomes) {
    for (const range of ranges) {
      if (outcome.tsb >= range.min && outcome.tsb < range.max) {
        if (!rangeStats[range.label]) {
          rangeStats[range.label] = { rpeSum: 0, count: 0, followedCount: 0 }
        }
        rangeStats[range.label].rpeSum += outcome.rpe
        rangeStats[range.label].count++
        if (outcome.followed) rangeStats[range.label].followedCount++
        break
      }
    }
  }

  // Find optimal range (lowest average RPE + highest completion)
  let bestRange = ranges[2] // Default to neutral
  let bestScore = -Infinity
  let worstRange = ranges[0]
  let worstScore = Infinity

  for (const range of ranges) {
    const stats = rangeStats[range.label]
    if (stats && stats.count >= 2) {
      const avgRPE = stats.rpeSum / stats.count
      const completionRate = stats.followedCount / stats.count
      // Score: higher completion + lower RPE is better
      const score = completionRate * 10 - avgRPE

      if (score > bestScore) {
        bestScore = score
        bestRange = range
      }
      if (score < worstScore) {
        worstScore = score
        worstRange = range
      }
    }
  }

  const confidence = Math.min(1, tsbOutcomes.length / 20)

  return {
    optimalTSB: { min: bestRange.min, max: bestRange.max },
    riskZone: { min: worstRange.min, max: worstRange.max },
    peakPerformanceTSB: (bestRange.min + bestRange.max) / 2,
    confidence,
  }
}

/**
 * Analyze patterns by workout type
 */
function analyzeWorkoutTypePatterns(
  outcomes: WorkoutOutcome[],
  sessionIdMap: Map<string, Session>
): WorkoutTypePattern[] {
  // Group outcomes by workout type
  const typeStats: Record<string, {
    completed: number
    total: number
    rpeSum: number
    rpeCount: number
    dayStats: Record<string, { rpeSum: number; count: number }>
  }> = {}

  for (const outcome of outcomes) {
    const workoutType = outcome.actual_type || outcome.suggested_type
    if (!workoutType) continue

    if (!typeStats[workoutType]) {
      typeStats[workoutType] = {
        completed: 0,
        total: 0,
        rpeSum: 0,
        rpeCount: 0,
        dayStats: {},
      }
    }

    typeStats[workoutType].total++
    if (outcome.followed_suggestion) typeStats[workoutType].completed++
    if (outcome.rpe) {
      typeStats[workoutType].rpeSum += outcome.rpe
      typeStats[workoutType].rpeCount++
    }

    // Track day of week stats
    if (outcome.session_id) {
      const session = sessionIdMap.get(outcome.session_id)
      if (session && outcome.rpe) {
        const day = getDayName(new Date(session.date))
        if (!typeStats[workoutType].dayStats[day]) {
          typeStats[workoutType].dayStats[day] = { rpeSum: 0, count: 0 }
        }
        typeStats[workoutType].dayStats[day].rpeSum += outcome.rpe
        typeStats[workoutType].dayStats[day].count++
      }
    }
  }

  // Build patterns for types with enough data
  const patterns: WorkoutTypePattern[] = []

  for (const [type, stats] of Object.entries(typeStats)) {
    if (stats.total < 3) continue

    const completionRate = stats.total > 0 ? stats.completed / stats.total : 0
    const averageRPE = stats.rpeCount > 0 ? stats.rpeSum / stats.rpeCount : 5

    // Analyze day patterns
    const dayScores = Object.entries(stats.dayStats)
      .filter(([, ds]) => ds.count >= 2)
      .map(([day, ds]) => ({
        day,
        avgRPE: ds.rpeSum / ds.count,
        count: ds.count,
      }))
      .sort((a, b) => a.avgRPE - b.avgRPE)

    const bestDays = dayScores.slice(0, 2).map(d => d.day)
    const worstDays = dayScores.slice(-2).map(d => d.day)

    patterns.push({
      workoutType: type,
      completionRate: Math.round(completionRate * 100) / 100,
      averageRPE: Math.round(averageRPE * 10) / 10,
      bestDays,
      worstDays,
      sampleSize: stats.total,
    })
  }

  return patterns.sort((a, b) => b.sampleSize - a.sampleSize)
}

/**
 * Analyze volume vs intensity preference
 */
function analyzeVolumeIntensityPattern(
  fitnessHistory: FitnessHistory[],
  sessions: Session[],
  outcomes: WorkoutOutcome[]
): VolumeIntensityPattern | null {
  if (sessions.length < 20 || outcomes.length < 10) return null

  // Calculate weekly aggregates
  const weeklyData: Record<string, { hours: number; avgIF: number; sessionsCount: number }> = {}

  for (const session of sessions) {
    const weekStart = new Date(session.date)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    const weekKey = weekStart.toISOString().split('T')[0]

    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = { hours: 0, avgIF: 0, sessionsCount: 0 }
    }

    weeklyData[weekKey].hours += session.duration_seconds / 3600
    if (session.intensity_factor) {
      weeklyData[weekKey].avgIF =
        (weeklyData[weekKey].avgIF * weeklyData[weekKey].sessionsCount + session.intensity_factor) /
        (weeklyData[weekKey].sessionsCount + 1)
    }
    weeklyData[weekKey].sessionsCount++
  }

  // Correlate with outcomes - weeks with high volume vs high intensity
  const weekOutcomes: { weekKey: string; isHighVolume: boolean; avgRPE: number }[] = []

  const allWeeklyHours = Object.values(weeklyData).map(w => w.hours)
  const medianHours = allWeeklyHours.sort((a, b) => a - b)[Math.floor(allWeeklyHours.length / 2)] || 0
  const allWeeklyIF = Object.values(weeklyData).map(w => w.avgIF).filter(f => f > 0)
  const medianIF = allWeeklyIF.sort((a, b) => a - b)[Math.floor(allWeeklyIF.length / 2)] || 0.7

  for (const outcome of outcomes) {
    if (!outcome.session_id || !outcome.rpe) continue

    const session = sessions.find(s => s.id === outcome.session_id)
    if (!session) continue

    const weekStart = new Date(session.date)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    const weekKey = weekStart.toISOString().split('T')[0]

    const weekData = weeklyData[weekKey]
    if (!weekData) continue

    // High volume week: hours above median, IF at or below median
    const isHighVolume = weekData.hours >= medianHours && weekData.avgIF <= medianIF

    weekOutcomes.push({
      weekKey,
      isHighVolume,
      avgRPE: outcome.rpe,
    })
  }

  if (weekOutcomes.length < 10) return null

  // Compare RPE in high volume vs high intensity weeks
  const highVolumeWeeks = weekOutcomes.filter(w => w.isHighVolume)
  const highIntensityWeeks = weekOutcomes.filter(w => !w.isHighVolume)

  const volumeRPE = highVolumeWeeks.length > 0
    ? highVolumeWeeks.reduce((sum, w) => sum + w.avgRPE, 0) / highVolumeWeeks.length
    : 5
  const intensityRPE = highIntensityWeeks.length > 0
    ? highIntensityWeeks.reduce((sum, w) => sum + w.avgRPE, 0) / highIntensityWeeks.length
    : 5

  // Find optimal weekly hours range
  const successfulWeeks = Object.entries(weeklyData)
    .filter(([key]) => {
      const weekOutcome = weekOutcomes.find(w => w.weekKey === key)
      return weekOutcome && weekOutcome.avgRPE <= 6
    })
    .map(([, data]) => data.hours)

  const sweetSpotMin = successfulWeeks.length > 0
    ? Math.round(Math.min(...successfulWeeks) * 10) / 10
    : 4
  const sweetSpotMax = successfulWeeks.length > 0
    ? Math.round(Math.max(...successfulWeeks) * 10) / 10
    : 10

  const confidence = Math.min(1, weekOutcomes.length / 30)

  return {
    prefersVolume: volumeRPE < intensityRPE - 0.5,
    prefersIntensity: intensityRPE < volumeRPE - 0.5,
    balancedResponse: Math.abs(volumeRPE - intensityRPE) <= 0.5,
    weeklyHoursSweet: { min: sweetSpotMin, max: sweetSpotMax },
    confidence,
  }
}

/**
 * Analyze day of week patterns
 */
function analyzeDayOfWeekPatterns(
  outcomes: WorkoutOutcome[],
  sessionIdMap: Map<string, Session>
): DayOfWeekPattern | null {
  if (outcomes.length < 14) return null

  const dayStats: Record<string, {
    intensityRPESum: number
    intensityCount: number
    recoveryRPESum: number
    recoveryCount: number
  }> = {}

  for (const outcome of outcomes) {
    if (!outcome.session_id || !outcome.rpe) continue

    const session = sessionIdMap.get(outcome.session_id)
    if (!session) continue

    const day = getDayName(new Date(session.date))
    const isIntensity = (session.intensity_factor || 0) > 0.8 ||
      ['threshold', 'vo2max', 'anaerobic', 'sprint'].includes(session.workout_type || '')

    if (!dayStats[day]) {
      dayStats[day] = { intensityRPESum: 0, intensityCount: 0, recoveryRPESum: 0, recoveryCount: 0 }
    }

    if (isIntensity) {
      dayStats[day].intensityRPESum += outcome.rpe
      dayStats[day].intensityCount++
    } else {
      dayStats[day].recoveryRPESum += outcome.rpe
      dayStats[day].recoveryCount++
    }
  }

  // Find best/worst days for intensity
  const intensityDayScores = Object.entries(dayStats)
    .filter(([, stats]) => stats.intensityCount >= 2)
    .map(([day, stats]) => ({
      day,
      avgRPE: stats.intensityRPESum / stats.intensityCount,
    }))
    .sort((a, b) => a.avgRPE - b.avgRPE)

  const recoveryDayScores = Object.entries(dayStats)
    .filter(([, stats]) => stats.recoveryCount >= 2)
    .map(([day, stats]) => ({
      day,
      avgRPE: stats.recoveryRPESum / stats.recoveryCount,
    }))
    .sort((a, b) => a.avgRPE - b.avgRPE)

  if (intensityDayScores.length < 2) return null

  const confidence = Math.min(1, outcomes.length / 30)

  return {
    bestIntensityDays: intensityDayScores.slice(0, 2).map(d => d.day),
    bestRecoveryDays: recoveryDayScores.slice(0, 2).map(d => d.day),
    avoidIntensityDays: intensityDayScores.slice(-2).map(d => d.day),
    confidence,
  }
}

/**
 * Main analyzer function - runs all pattern analysis
 */
export async function analyzeAthletePatterns(
  athleteId: string,
  options: { days?: number; saveAsMemories?: boolean } = {}
): Promise<AthletePatterns> {
  const { days = 90, saveAsMemories = true } = options

  // Fetch data
  const [outcomes, sessions, fitnessHistory] = await Promise.all([
    getWorkoutOutcomes(athleteId, { limit: 200, days }),
    getSessions(athleteId, {
      startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      limit: 200,
    }),
    getFitnessHistory(athleteId, days),
  ])

  const dataPoints = outcomes.length

  // Pre-build Maps for O(1) lookups (instead of O(n) find() in loops)
  const fitnessMap = buildFitnessMap(fitnessHistory)
  const sessionIdMap = buildSessionIdMap(sessions)

  // Run all analyses
  const patterns: AthletePatterns = {
    recovery: analyzeRecoveryPatterns(fitnessMap, sessions),
    tsb: analyzeTSBPatterns(outcomes, fitnessMap, sessionIdMap),
    workoutTypes: analyzeWorkoutTypePatterns(outcomes, sessionIdMap),
    volumeIntensity: analyzeVolumeIntensityPattern(fitnessHistory, sessions, outcomes),
    dayOfWeek: analyzeDayOfWeekPatterns(outcomes, sessionIdMap),
    analyzedAt: new Date().toISOString(),
    dataPoints,
  }

  // Save significant patterns as memories
  if (saveAsMemories && dataPoints >= 5) {
    await savePatternMemories(athleteId, patterns)
  }

  return patterns
}

/**
 * Save discovered patterns as athlete memories
 */
async function savePatternMemories(
  athleteId: string,
  patterns: AthletePatterns
): Promise<void> {
  const memoriesToSave: { type: MemoryType; content: string; confidence: number }[] = []

  // Recovery pattern
  if (patterns.recovery && patterns.recovery.confidence >= 0.5) {
    if (patterns.recovery.fastRecoverer) {
      memoriesToSave.push({
        type: 'pattern',
        content: `Recovers quickly from hard workouts (avg ${patterns.recovery.averageRecoveryDays} days). Can handle back-to-back intensity days better than most.`,
        confidence: patterns.recovery.confidence,
      })
    } else if (patterns.recovery.slowRecoverer) {
      memoriesToSave.push({
        type: 'pattern',
        content: `Needs more recovery time after intensity (avg ${patterns.recovery.averageRecoveryDays} days). Allow extra rest between hard sessions.`,
        confidence: patterns.recovery.confidence,
      })
    }
  }

  // TSB pattern
  if (patterns.tsb && patterns.tsb.confidence >= 0.5) {
    memoriesToSave.push({
      type: 'pattern',
      content: `Performs best with TSB between ${patterns.tsb.optimalTSB.min} and ${patterns.tsb.optimalTSB.max}. Struggles when TSB is in ${patterns.tsb.riskZone.min} to ${patterns.tsb.riskZone.max} range.`,
      confidence: patterns.tsb.confidence,
    })
  }

  // Volume/intensity preference
  if (patterns.volumeIntensity && patterns.volumeIntensity.confidence >= 0.5) {
    if (patterns.volumeIntensity.prefersVolume) {
      memoriesToSave.push({
        type: 'pattern',
        content: `Responds better to higher volume, moderate intensity training. Optimal weekly hours: ${patterns.volumeIntensity.weeklyHoursSweet.min}-${patterns.volumeIntensity.weeklyHoursSweet.max}h.`,
        confidence: patterns.volumeIntensity.confidence,
      })
    } else if (patterns.volumeIntensity.prefersIntensity) {
      memoriesToSave.push({
        type: 'pattern',
        content: `Responds better to intensity-focused training with lower volume. Quality over quantity approach works well.`,
        confidence: patterns.volumeIntensity.confidence,
      })
    }
  }

  // Day of week pattern
  if (patterns.dayOfWeek && patterns.dayOfWeek.confidence >= 0.5) {
    if (patterns.dayOfWeek.bestIntensityDays.length > 0) {
      memoriesToSave.push({
        type: 'pattern',
        content: `Best days for hard workouts: ${patterns.dayOfWeek.bestIntensityDays.join(', ')}. Avoid intensity on ${patterns.dayOfWeek.avoidIntensityDays.join(', ')}.`,
        confidence: patterns.dayOfWeek.confidence,
      })
    }
  }

  // Workout type patterns (only save notable ones)
  for (const typePattern of patterns.workoutTypes) {
    if (typePattern.sampleSize < 5) continue

    if (typePattern.completionRate < 0.5) {
      memoriesToSave.push({
        type: 'pattern',
        content: `Often skips ${typePattern.workoutType} workouts (${Math.round(typePattern.completionRate * 100)}% completion). May need different approach or timing.`,
        confidence: Math.min(1, typePattern.sampleSize / 10),
      })
    }

    if (typePattern.averageRPE > 8 && typePattern.sampleSize >= 5) {
      memoriesToSave.push({
        type: 'pattern',
        content: `Finds ${typePattern.workoutType} workouts very hard (avg RPE ${typePattern.averageRPE}). Consider easier progressions.`,
        confidence: Math.min(1, typePattern.sampleSize / 10),
      })
    }

    if (typePattern.bestDays.length > 0 && typePattern.sampleSize >= 8) {
      memoriesToSave.push({
        type: 'pattern',
        content: `Best days for ${typePattern.workoutType}: ${typePattern.bestDays.join(', ')}.`,
        confidence: Math.min(1, typePattern.sampleSize / 12),
      })
    }
  }

  // Save all memories
  for (const memory of memoriesToSave) {
    await upsertMemory(athleteId, {
      memory_type: memory.type,
      content: memory.content,
      confidence: memory.confidence,
      source: 'data_derived',
      metadata: { analyzedAt: patterns.analyzedAt },
    })
  }
}

/**
 * Get a summary of patterns for display or AI consumption
 */
export function summarizePatterns(patterns: AthletePatterns): string {
  const lines: string[] = []

  if (patterns.dataPoints < 5) {
    return 'Not enough data to detect patterns yet. Keep logging workout outcomes!'
  }

  if (patterns.recovery) {
    if (patterns.recovery.fastRecoverer) {
      lines.push(`Recovery: Fast recoverer (${patterns.recovery.averageRecoveryDays} days avg)`)
    } else if (patterns.recovery.slowRecoverer) {
      lines.push(`Recovery: Slower recovery (${patterns.recovery.averageRecoveryDays} days avg) - allow extra rest`)
    } else {
      lines.push(`Recovery: Average recovery rate (${patterns.recovery.averageRecoveryDays} days)`)
    }
  }

  if (patterns.tsb) {
    lines.push(`Optimal form: TSB ${patterns.tsb.optimalTSB.min} to ${patterns.tsb.optimalTSB.max}`)
  }

  if (patterns.volumeIntensity) {
    if (patterns.volumeIntensity.prefersVolume) {
      lines.push('Training style: Responds best to volume-focused approach')
    } else if (patterns.volumeIntensity.prefersIntensity) {
      lines.push('Training style: Responds best to intensity-focused approach')
    } else {
      lines.push('Training style: Balanced response to volume and intensity')
    }
    lines.push(`Sweet spot: ${patterns.volumeIntensity.weeklyHoursSweet.min}-${patterns.volumeIntensity.weeklyHoursSweet.max}h/week`)
  }

  if (patterns.dayOfWeek && patterns.dayOfWeek.bestIntensityDays.length > 0) {
    lines.push(`Best intensity days: ${patterns.dayOfWeek.bestIntensityDays.join(', ')}`)
  }

  if (patterns.workoutTypes.length > 0) {
    const lowCompletion = patterns.workoutTypes.filter(t => t.completionRate < 0.6)
    if (lowCompletion.length > 0) {
      lines.push(`Struggles with: ${lowCompletion.map(t => t.workoutType).join(', ')}`)
    }
  }

  return lines.length > 0
    ? lines.join('\n')
    : 'Patterns are still being analyzed. More data needed for reliable insights.'
}
