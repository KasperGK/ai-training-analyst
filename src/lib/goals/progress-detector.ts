/**
 * Goal Progress Detector
 *
 * Analyzes activity data to auto-detect progress toward goals.
 * Supports FTP goals, CTL goals, and metric goals (HR at power, power duration, W/kg).
 */

import { createClient } from '@/lib/supabase/server'
import {
  getGoalsForProgressCheck,
  updateGoalProgress,
  markGoalAchieved,
  updateGoalLastChecked,
  type Goal,
} from '@/lib/db/goals'
import { getCurrentFitness } from '@/lib/db/fitness'
import type { Session } from '@/types'

export interface ProgressDetectionResult {
  goalId: string
  goalTitle: string
  detected: boolean
  previousValue?: number
  newValue?: number
  sessionId?: string
  details?: string
  achieved?: boolean
}

export interface GoalProgressCheckResult {
  goalsChecked: number
  goalsUpdated: number
  goalsAchieved: number
  results: ProgressDetectionResult[]
}

/**
 * Check progress for all active goals of an athlete
 * Called after sync to auto-detect goal progress
 */
export async function checkGoalProgress(
  athleteId: string
): Promise<GoalProgressCheckResult> {
  const results: ProgressDetectionResult[] = []
  let goalsUpdated = 0
  let goalsAchieved = 0

  // Get all active goals for the athlete
  const goals = await getGoalsForProgressCheck(athleteId)

  if (goals.length === 0) {
    return { goalsChecked: 0, goalsUpdated: 0, goalsAchieved: 0, results: [] }
  }

  // Get recent sessions for metric goal detection
  const recentSessions = await getRecentSessions(athleteId, 7) // Last 7 days

  // Get current athlete data for FTP/weight goals
  const athleteData = await getAthleteData(athleteId)

  // Get current fitness for CTL goals
  const currentFitness = await getCurrentFitness(athleteId)

  for (const goal of goals) {
    try {
      const result = await detectProgressForGoal(
        goal,
        recentSessions,
        athleteData,
        currentFitness
      )

      results.push(result)

      if (result.detected && result.newValue !== undefined) {
        // Update goal progress
        await updateGoalProgress(goal.id, result.newValue, result.sessionId, result.details)
        goalsUpdated++

        // Check if goal is achieved
        if (result.achieved) {
          await markGoalAchieved(goal.id, result.sessionId)
          goalsAchieved++
        }
      } else {
        // Update last_checked_at even if no progress detected
        await updateGoalLastChecked(goal.id)
      }
    } catch (error) {
      console.error(`[GoalProgress] Error checking goal ${goal.id}:`, error)
      results.push({
        goalId: goal.id,
        goalTitle: goal.title,
        detected: false,
        details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  }

  return {
    goalsChecked: goals.length,
    goalsUpdated,
    goalsAchieved,
    results,
  }
}

/**
 * Detect progress for a single goal
 */
async function detectProgressForGoal(
  goal: Goal,
  sessions: Session[],
  athleteData: AthleteData | null,
  fitness: FitnessData | null
): Promise<ProgressDetectionResult> {
  const baseResult: ProgressDetectionResult = {
    goalId: goal.id,
    goalTitle: goal.title,
    detected: false,
    previousValue: goal.current_value ?? undefined,
  }

  // Route to appropriate detector based on target_type
  switch (goal.target_type) {
    case 'ftp':
      return detectFTPProgress(goal, athleteData, baseResult)

    case 'ctl':
      return detectCTLProgress(goal, fitness, baseResult)

    case 'weight':
      return detectWeightProgress(goal, athleteData, baseResult)

    case 'metric':
      return detectMetricProgress(goal, sessions, athleteData, baseResult)

    default:
      return baseResult
  }
}

/**
 * Detect FTP goal progress
 */
function detectFTPProgress(
  goal: Goal,
  athleteData: AthleteData | null,
  baseResult: ProgressDetectionResult
): ProgressDetectionResult {
  if (!athleteData?.ftp) {
    return { ...baseResult, details: 'No FTP data available' }
  }

  const currentFTP = athleteData.ftp
  const previousValue = goal.current_value ?? 0

  // Only update if FTP has changed
  if (currentFTP !== previousValue) {
    const achieved = goal.target_value ? currentFTP >= goal.target_value : false

    return {
      ...baseResult,
      detected: true,
      newValue: currentFTP,
      details: `FTP updated from ${previousValue}W to ${currentFTP}W`,
      achieved,
    }
  }

  return baseResult
}

/**
 * Detect CTL goal progress
 */
function detectCTLProgress(
  goal: Goal,
  fitness: FitnessData | null,
  baseResult: ProgressDetectionResult
): ProgressDetectionResult {
  if (!fitness?.ctl) {
    return { ...baseResult, details: 'No CTL data available' }
  }

  const currentCTL = Math.round(fitness.ctl)
  const previousValue = goal.current_value ?? 0

  // CTL changes daily, update if meaningful change (>1 point)
  if (Math.abs(currentCTL - previousValue) >= 1) {
    const achieved = goal.target_value ? currentCTL >= goal.target_value : false

    return {
      ...baseResult,
      detected: true,
      newValue: currentCTL,
      details: `CTL updated from ${previousValue} to ${currentCTL}`,
      achieved,
    }
  }

  return baseResult
}

/**
 * Detect weight goal progress
 */
function detectWeightProgress(
  goal: Goal,
  athleteData: AthleteData | null,
  baseResult: ProgressDetectionResult
): ProgressDetectionResult {
  if (!athleteData?.weight_kg) {
    return { ...baseResult, details: 'No weight data available' }
  }

  const currentWeight = athleteData.weight_kg
  const previousValue = goal.current_value ?? 0

  // Only update if weight has changed (>0.1kg)
  if (Math.abs(currentWeight - previousValue) >= 0.1) {
    // For weight goals, "achieved" means reaching target (could be lower or higher depending on goal)
    const achieved = goal.target_value ? currentWeight <= goal.target_value : false

    return {
      ...baseResult,
      detected: true,
      newValue: currentWeight,
      details: `Weight updated from ${previousValue}kg to ${currentWeight}kg`,
      achieved,
    }
  }

  return baseResult
}

/**
 * Detect metric goal progress (HR at power, power duration, W/kg)
 */
function detectMetricProgress(
  goal: Goal,
  sessions: Session[],
  athleteData: AthleteData | null,
  baseResult: ProgressDetectionResult
): ProgressDetectionResult {
  if (!goal.metric_type || !goal.metric_conditions) {
    return { ...baseResult, details: 'Invalid metric goal configuration' }
  }

  switch (goal.metric_type) {
    case 'hr_at_power':
      return detectHRAtPowerProgress(goal, sessions, baseResult)

    case 'power_duration':
      return detectPowerDurationProgress(goal, sessions, baseResult)

    case 'relative_power':
      return detectRelativePowerProgress(goal, athleteData, baseResult)

    default:
      return baseResult
  }
}

/**
 * Detect HR efficiency at a given power (lower HR = better)
 */
function detectHRAtPowerProgress(
  goal: Goal,
  sessions: Session[],
  baseResult: ProgressDetectionResult
): ProgressDetectionResult {
  const conditions = goal.metric_conditions
  if (!conditions?.target_power) {
    return { ...baseResult, details: 'Missing target_power in conditions' }
  }

  // Find sessions with avg_power within 10% of target and has HR data
  const targetPower = conditions.target_power
  const powerTolerance = targetPower * 0.1

  const matchingSessions = sessions.filter(s =>
    s.avg_power &&
    s.avg_hr &&
    Math.abs(s.avg_power - targetPower) <= powerTolerance &&
    s.duration_seconds >= 1200 // At least 20 minutes
  )

  if (matchingSessions.length === 0) {
    return { ...baseResult, details: `No sessions found near ${targetPower}W` }
  }

  // Find the best (lowest) HR at target power
  const bestSession = matchingSessions.reduce((best, s) =>
    (s.avg_hr! < (best.avg_hr ?? Infinity)) ? s : best
  )

  const bestHR = bestSession.avg_hr!
  const previousValue = goal.current_value

  // For HR efficiency, lower is better
  if (previousValue === null || bestHR < previousValue) {
    const achieved = conditions.target_hr ? bestHR <= conditions.target_hr : false

    return {
      ...baseResult,
      detected: true,
      newValue: bestHR,
      sessionId: bestSession.id,
      details: `Best HR at ~${targetPower}W: ${bestHR}bpm (was ${previousValue ?? 'N/A'})`,
      achieved,
    }
  }

  return baseResult
}

/**
 * Detect power duration progress (holding power for a duration)
 */
function detectPowerDurationProgress(
  goal: Goal,
  sessions: Session[],
  baseResult: ProgressDetectionResult
): ProgressDetectionResult {
  const conditions = goal.metric_conditions
  if (!conditions?.target_power || !conditions?.duration_seconds) {
    return { ...baseResult, details: 'Missing target_power or duration_seconds in conditions' }
  }

  const targetPower = conditions.target_power
  const targetDuration = conditions.duration_seconds

  // Find sessions that achieved the target power for the target duration
  // We use normalized_power as a proxy for sustained effort
  const matchingSessions = sessions.filter(s =>
    s.normalized_power &&
    s.normalized_power >= targetPower &&
    s.duration_seconds >= targetDuration
  )

  if (matchingSessions.length > 0) {
    // Goal achieved! Find the best session
    const bestSession = matchingSessions.reduce((best, s) =>
      (s.normalized_power! > (best.normalized_power ?? 0)) ? s : best
    )

    const bestPower = bestSession.normalized_power!

    return {
      ...baseResult,
      detected: true,
      newValue: bestPower,
      sessionId: bestSession.id,
      details: `Achieved ${bestPower}W for ${Math.round(targetDuration / 60)}min (target: ${targetPower}W)`,
      achieved: true,
    }
  }

  // Find best effort toward the goal
  const sessionsWithNP = sessions.filter(s =>
    s.normalized_power && s.duration_seconds >= targetDuration * 0.5
  )

  if (sessionsWithNP.length > 0) {
    const bestSession = sessionsWithNP.reduce((best, s) =>
      (s.normalized_power! > (best.normalized_power ?? 0)) ? s : best
    )

    const bestPower = bestSession.normalized_power!
    const previousValue = goal.current_value

    if (previousValue === null || bestPower > previousValue) {
      return {
        ...baseResult,
        detected: true,
        newValue: bestPower,
        sessionId: bestSession.id,
        details: `Best sustained power: ${bestPower}W (target: ${targetPower}W for ${Math.round(targetDuration / 60)}min)`,
        achieved: false,
      }
    }
  }

  return baseResult
}

/**
 * Detect relative power (W/kg) progress
 */
function detectRelativePowerProgress(
  goal: Goal,
  athleteData: AthleteData | null,
  baseResult: ProgressDetectionResult
): ProgressDetectionResult {
  const conditions = goal.metric_conditions
  if (!conditions?.target_wkg) {
    return { ...baseResult, details: 'Missing target_wkg in conditions' }
  }

  if (!athleteData?.ftp || !athleteData?.weight_kg) {
    return { ...baseResult, details: 'Missing FTP or weight data' }
  }

  const currentWkg = athleteData.ftp / athleteData.weight_kg
  const roundedWkg = Math.round(currentWkg * 100) / 100 // Round to 2 decimals
  const previousValue = goal.current_value

  if (previousValue === null || Math.abs(roundedWkg - previousValue) >= 0.01) {
    const achieved = roundedWkg >= conditions.target_wkg

    return {
      ...baseResult,
      detected: true,
      newValue: roundedWkg,
      details: `W/kg updated from ${previousValue?.toFixed(2) ?? 'N/A'} to ${roundedWkg.toFixed(2)} (target: ${conditions.target_wkg})`,
      achieved,
    }
  }

  return baseResult
}

// Helper types
interface AthleteData {
  ftp?: number | null
  weight_kg?: number | null
  max_hr?: number | null
}

interface FitnessData {
  ctl: number
  atl: number
  tsb: number
}

/**
 * Get recent sessions for an athlete
 */
async function getRecentSessions(
  athleteId: string,
  days: number = 7
): Promise<Session[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('athlete_id', athleteId)
    .gte('date', since.toISOString().split('T')[0])
    .order('date', { ascending: false })

  if (error || !data) return []
  return data as Session[]
}

/**
 * Get athlete data (FTP, weight, max_hr)
 */
async function getAthleteData(athleteId: string): Promise<AthleteData | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('athletes')
    .select('ftp, weight_kg, max_hr')
    .eq('id', athleteId)
    .single()

  if (error || !data) return null
  return data as AthleteData
}

/**
 * Calculate progress percentage for a goal
 */
export function calculateGoalProgress(goal: Goal): number | null {
  if (goal.target_value === null || goal.target_value === 0) {
    return null
  }

  const current = goal.current_value ?? 0

  // For weight goals, progress is inverse (lower is better)
  if (goal.target_type === 'weight') {
    // Assuming starting from a higher weight, calculate how close to target
    // This is a simplification - ideally we'd track starting weight
    return Math.min(100, Math.round((goal.target_value / current) * 100))
  }

  // For HR at power, lower is better
  if (goal.metric_type === 'hr_at_power') {
    if (current === 0) return 0
    // Progress = how much HR has dropped toward target
    return Math.min(100, Math.round((goal.target_value / current) * 100))
  }

  // For all other goals, higher is better
  return Math.min(100, Math.round((current / goal.target_value) * 100))
}

/**
 * Determine risk level for a goal
 */
export function calculateGoalRiskLevel(
  goal: Goal
): 'on_track' | 'at_risk' | 'achieved' | 'no_deadline' {
  if (goal.status === 'completed') {
    return 'achieved'
  }

  if (!goal.deadline) {
    return 'no_deadline'
  }

  const progress = calculateGoalProgress(goal)
  if (progress === null) {
    return 'no_deadline'
  }

  const deadline = new Date(goal.deadline)
  const now = new Date()
  const totalDays = Math.ceil((deadline.getTime() - new Date(goal.created_at).getTime()) / (24 * 60 * 60 * 1000))
  const daysElapsed = Math.ceil((now.getTime() - new Date(goal.created_at).getTime()) / (24 * 60 * 60 * 1000))
  const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))

  if (daysRemaining <= 0) {
    return progress >= 100 ? 'achieved' : 'at_risk'
  }

  // Expected progress based on time elapsed
  const expectedProgress = Math.round((daysElapsed / totalDays) * 100)

  // At risk if behind schedule by more than 20%
  if (progress < expectedProgress - 20) {
    return 'at_risk'
  }

  // Achieved if progress >= 100
  if (progress >= 100) {
    return 'achieved'
  }

  return 'on_track'
}
