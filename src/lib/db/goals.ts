import { createClient } from '@/lib/supabase/server'
import type { MetricGoalType, MetricConditions, GoalProgress } from '@/types'

export interface Goal {
  id: string
  athlete_id: string
  event_id: string | null
  title: string
  description: string | null
  target_type: string
  target_value: number | null
  current_value: number | null
  deadline: string | null
  status: 'active' | 'completed' | 'abandoned'
  metric_type?: MetricGoalType | null
  metric_conditions?: MetricConditions | null
  last_checked_at?: string | null
  achievement_session_id?: string | null
  created_at: string
  updated_at: string
}

export type GoalRow = {
  id: string
  athlete_id: string
  event_id: string | null
  title: string
  description: string | null
  target_type: string
  target_value: number | null
  current_value: number | null
  deadline: string | null
  status: string
  metric_type: string | null
  metric_conditions: MetricConditions | null
  last_checked_at: string | null
  achievement_session_id: string | null
  created_at: string
  updated_at: string
}

export type GoalInsert = Omit<GoalRow, 'id' | 'created_at' | 'updated_at'>
export type GoalUpdate = Partial<Omit<GoalRow, 'id' | 'athlete_id' | 'created_at'>>

function rowToGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    athlete_id: row.athlete_id,
    event_id: row.event_id,
    title: row.title,
    description: row.description,
    target_type: row.target_type,
    target_value: row.target_value,
    current_value: row.current_value,
    deadline: row.deadline,
    status: row.status as Goal['status'],
    metric_type: row.metric_type as MetricGoalType | null,
    metric_conditions: row.metric_conditions,
    last_checked_at: row.last_checked_at,
    achievement_session_id: row.achievement_session_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function getGoals(
  athleteId: string,
  status?: Goal['status']
): Promise<Goal[]> {
  const supabase = await createClient()
  if (!supabase) return []

  let query = supabase
    .from('goals')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error || !data) return []
  return data.map((row) => rowToGoal(row as GoalRow))
}

export async function getActiveGoals(athleteId: string): Promise<Goal[]> {
  return getGoals(athleteId, 'active')
}

export async function getGoal(goalId: string): Promise<Goal | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('id', goalId)
    .single()

  if (error || !data) return null
  return rowToGoal(data as GoalRow)
}

export async function createGoal(goal: GoalInsert): Promise<Goal | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('goals')
    .insert(goal)
    .select()
    .single()

  if (error || !data) return null
  return rowToGoal(data as GoalRow)
}

export async function updateGoal(
  goalId: string,
  updates: GoalUpdate
): Promise<Goal | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('goals')
    .update(updates)
    .eq('id', goalId)
    .select()
    .single()

  if (error || !data) return null
  return rowToGoal(data as GoalRow)
}

export async function deleteGoal(goalId: string): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('id', goalId)

  return !error
}

export async function completeGoal(goalId: string): Promise<Goal | null> {
  return updateGoal(goalId, { status: 'completed' })
}

export async function abandonGoal(goalId: string): Promise<Goal | null> {
  return updateGoal(goalId, { status: 'abandoned' })
}

// Common goal types with templates
export const GOAL_TYPES = {
  ftp: { name: 'Increase FTP', unit: 'watts', targetType: 'ftp' },
  weight: { name: 'Target Weight', unit: 'kg', targetType: 'weight' },
  ctl: { name: 'Build Fitness (CTL)', unit: 'TSS/day', targetType: 'ctl' },
  weekly_hours: { name: 'Weekly Training Hours', unit: 'hours', targetType: 'weekly_hours' },
  event_finish: { name: 'Complete Event', unit: null, targetType: 'event_finish' },
  // Metric goal types
  hr_at_power: { name: 'HR Efficiency at Power', unit: 'bpm', targetType: 'metric', metricType: 'hr_at_power' },
  power_duration: { name: 'Hold Power for Duration', unit: 'watts', targetType: 'metric', metricType: 'power_duration' },
  relative_power: { name: 'W/kg Target', unit: 'w/kg', targetType: 'metric', metricType: 'relative_power' },
} as const

/**
 * Update goal progress with a new value
 */
export async function updateGoalProgress(
  goalId: string,
  newValue: number,
  sessionId?: string,
  notes?: string
): Promise<Goal | null> {
  const supabase = await createClient()
  if (!supabase) return null

  // Insert progress record
  const { error: progressError } = await supabase
    .from('goal_progress')
    .insert({
      goal_id: goalId,
      value: newValue,
      session_id: sessionId || null,
      notes: notes || null,
      recorded_at: new Date().toISOString(),
    })

  if (progressError) {
    console.error('[Goals] Failed to insert progress:', progressError)
    return null
  }

  // Update the goal's current value and last_checked_at
  const { data, error } = await supabase
    .from('goals')
    .update({
      current_value: newValue,
      last_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', goalId)
    .select()
    .single()

  if (error || !data) return null
  return rowToGoal(data as GoalRow)
}

/**
 * Mark a goal as achieved with the session that triggered achievement
 */
export async function markGoalAchieved(
  goalId: string,
  sessionId?: string
): Promise<Goal | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('goals')
    .update({
      status: 'completed',
      achievement_session_id: sessionId || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', goalId)
    .select()
    .single()

  if (error || !data) return null
  return rowToGoal(data as GoalRow)
}

/**
 * Get goals that need progress checking (active goals with metric conditions)
 */
export async function getGoalsForProgressCheck(
  athleteId: string
): Promise<Goal[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data.map((row) => rowToGoal(row as GoalRow))
}

/**
 * Get progress history for a goal
 */
export async function getGoalProgress(
  goalId: string,
  limit: number = 30
): Promise<GoalProgress[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('goal_progress')
    .select('*')
    .eq('goal_id', goalId)
    .order('recorded_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data as GoalProgress[]
}

/**
 * Update goal's last checked timestamp
 */
export async function updateGoalLastChecked(
  goalId: string
): Promise<void> {
  const supabase = await createClient()
  if (!supabase) return

  await supabase
    .from('goals')
    .update({
      last_checked_at: new Date().toISOString(),
    })
    .eq('id', goalId)
}
