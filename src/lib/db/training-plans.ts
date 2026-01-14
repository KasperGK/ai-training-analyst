import { createClient } from '@/lib/supabase/server'
import type { TrainingPlan, PlanDay, PlanGoal, PlanStatus } from '@/types'

// Row types matching database schema
export type TrainingPlanRow = {
  id: string
  athlete_id: string
  name: string
  description: string | null
  goal: string
  duration_weeks: number
  weekly_hours_target: number | null
  start_date: string
  end_date: string
  key_workout_days: number[] | null
  target_event_id: string | null
  target_event_date: string | null
  status: string
  progress_percent: number | null
  plan_data: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type PlanDayRow = {
  id: string
  plan_id: string
  date: string
  week_number: number
  day_of_week: number
  workout_template_id: string | null
  workout_type: string | null
  workout_name: string | null
  target_tss: number | null
  target_duration_minutes: number | null
  target_if: number | null
  custom_description: string | null
  intervals_json: Record<string, unknown> | null
  completed: boolean
  actual_session_id: string | null
  actual_tss: number | null
  actual_duration_minutes: number | null
  compliance_score: number | null
  coach_notes: string | null
  athlete_notes: string | null
  skipped: boolean
  rescheduled_from: string | null
  rescheduled_to: string | null
  created_at: string
  updated_at: string
}

export type TrainingPlanInsert = Omit<TrainingPlanRow, 'id' | 'created_at' | 'updated_at' | 'progress_percent'>
// These fields have defaults or are nullable, so make them optional for insert
export type PlanDayInsert = Omit<PlanDayRow, 'id' | 'created_at' | 'updated_at' | 'skipped' | 'rescheduled_from' | 'rescheduled_to'> & {
  skipped?: boolean
  rescheduled_from?: string | null
  rescheduled_to?: string | null
}

function rowToPlan(row: TrainingPlanRow): TrainingPlan {
  return {
    id: row.id,
    athlete_id: row.athlete_id,
    name: row.name,
    description: row.description,
    goal: row.goal as PlanGoal,
    duration_weeks: row.duration_weeks,
    weekly_hours_target: row.weekly_hours_target,
    start_date: row.start_date,
    end_date: row.end_date,
    key_workout_days: row.key_workout_days ?? undefined,
    target_event_id: row.target_event_id,
    target_event_date: row.target_event_date,
    status: row.status as PlanStatus,
    progress_percent: row.progress_percent ?? 0,
    plan_data: row.plan_data,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function rowToPlanDay(row: PlanDayRow): PlanDay {
  return {
    id: row.id,
    plan_id: row.plan_id,
    date: row.date,
    week_number: row.week_number,
    day_of_week: row.day_of_week,
    workout_template_id: row.workout_template_id,
    workout_type: row.workout_type,
    workout_name: row.workout_name,
    target_tss: row.target_tss,
    target_duration_minutes: row.target_duration_minutes,
    target_if: row.target_if,
    custom_description: row.custom_description,
    intervals_json: row.intervals_json,
    completed: row.completed,
    actual_session_id: row.actual_session_id,
    actual_tss: row.actual_tss,
    actual_duration_minutes: row.actual_duration_minutes,
    compliance_score: row.compliance_score,
    coach_notes: row.coach_notes,
    athlete_notes: row.athlete_notes,
    skipped: row.skipped,
    rescheduled_from: row.rescheduled_from,
    rescheduled_to: row.rescheduled_to,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

// Training Plan CRUD

export async function getTrainingPlans(
  athleteId: string,
  options: { status?: PlanStatus; limit?: number } = {}
): Promise<TrainingPlan[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { status, limit = 50 } = options

  let query = supabase
    .from('training_plans')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error || !data) return []
  return data.map((row) => rowToPlan(row as TrainingPlanRow))
}

export async function getTrainingPlan(planId: string): Promise<TrainingPlan | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('training_plans')
    .select('*')
    .eq('id', planId)
    .single()

  if (error || !data) return null
  return rowToPlan(data as TrainingPlanRow)
}

export async function getActivePlan(athleteId: string): Promise<TrainingPlan | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('training_plans')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null
  return rowToPlan(data as TrainingPlanRow)
}

export async function createTrainingPlan(plan: TrainingPlanInsert): Promise<TrainingPlan | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('training_plans')
    .insert(plan)
    .select()
    .single()

  if (error || !data) return null
  return rowToPlan(data as TrainingPlanRow)
}

export async function updateTrainingPlan(
  planId: string,
  updates: Partial<Omit<TrainingPlanRow, 'id' | 'athlete_id' | 'created_at' | 'updated_at'>>
): Promise<TrainingPlan | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('training_plans')
    .update(updates)
    .eq('id', planId)
    .select()
    .single()

  if (error || !data) return null
  return rowToPlan(data as TrainingPlanRow)
}

export async function deleteTrainingPlan(planId: string): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('training_plans')
    .delete()
    .eq('id', planId)

  return !error
}

// Plan Day CRUD

export async function getPlanDays(
  planId: string,
  options: { startDate?: string; endDate?: string } = {}
): Promise<PlanDay[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { startDate, endDate } = options

  let query = supabase
    .from('plan_days')
    .select('*')
    .eq('plan_id', planId)
    .order('date', { ascending: true })

  if (startDate) {
    query = query.gte('date', startDate)
  }
  if (endDate) {
    query = query.lte('date', endDate)
  }

  const { data, error } = await query

  if (error || !data) return []
  return data.map((row) => rowToPlanDay(row as PlanDayRow))
}

export async function getPlanDay(dayId: string): Promise<PlanDay | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('plan_days')
    .select('*')
    .eq('id', dayId)
    .single()

  if (error || !data) return null
  return rowToPlanDay(data as PlanDayRow)
}

export async function getPlanDayByDate(planId: string, date: string): Promise<PlanDay | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('plan_days')
    .select('*')
    .eq('plan_id', planId)
    .eq('date', date)
    .single()

  if (error || !data) return null
  return rowToPlanDay(data as PlanDayRow)
}

export async function createPlanDays(days: PlanDayInsert[]): Promise<PlanDay[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('plan_days')
    .insert(days)
    .select()

  if (error || !data) return []
  return data.map((row) => rowToPlanDay(row as PlanDayRow))
}

export async function updatePlanDay(
  dayId: string,
  updates: Partial<Omit<PlanDayRow, 'id' | 'plan_id' | 'created_at' | 'updated_at'>>
): Promise<PlanDay | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('plan_days')
    .update(updates)
    .eq('id', dayId)
    .select()
    .single()

  if (error || !data) return null
  return rowToPlanDay(data as PlanDayRow)
}

export async function markDayComplete(
  dayId: string,
  sessionId: string,
  actualTss?: number,
  actualDuration?: number
): Promise<PlanDay | null> {
  return updatePlanDay(dayId, {
    completed: true,
    actual_session_id: sessionId,
    actual_tss: actualTss ?? null,
    actual_duration_minutes: actualDuration ?? null,
  })
}

export async function getIncompleteDays(
  planId: string,
  beforeDate?: string
): Promise<PlanDay[]> {
  const supabase = await createClient()
  if (!supabase) return []

  let query = supabase
    .from('plan_days')
    .select('*')
    .eq('plan_id', planId)
    .eq('completed', false)
    .order('date', { ascending: true })

  if (beforeDate) {
    query = query.lt('date', beforeDate)
  }

  const { data, error } = await query

  if (error || !data) return []
  return data.map((row) => rowToPlanDay(row as PlanDayRow))
}

// Helper to calculate plan progress
export async function calculatePlanProgress(planId: string): Promise<number> {
  const supabase = await createClient()
  if (!supabase) return 0

  const { data, error } = await supabase
    .from('plan_days')
    .select('completed')
    .eq('plan_id', planId)

  if (error || !data || data.length === 0) return 0

  const completedDays = data.filter((d) => d.completed).length
  return Math.round((completedDays / data.length) * 100)
}

// Skip a workout day
export async function skipPlanDay(dayId: string): Promise<PlanDay | null> {
  return updatePlanDay(dayId, {
    skipped: true,
    completed: false,
  })
}

// Reschedule a workout to a different date
export async function reschedulePlanDay(
  dayId: string,
  newDate: string,
  planId: string
): Promise<{ originalDay: PlanDay | null; newDay: PlanDay | null }> {
  const supabase = await createClient()
  if (!supabase) return { originalDay: null, newDay: null }

  // Get the original day
  const originalDay = await getPlanDay(dayId)
  if (!originalDay) return { originalDay: null, newDay: null }

  // Mark original day as rescheduled
  const updatedOriginal = await updatePlanDay(dayId, {
    rescheduled_to: newDate,
    skipped: true,
  })

  // Check if there's already a day on the new date
  const existingDay = await getPlanDayByDate(planId, newDate)

  if (existingDay) {
    // Update existing day with the workout from original
    const updatedNew = await updatePlanDay(existingDay.id, {
      workout_template_id: originalDay.workout_template_id,
      workout_type: originalDay.workout_type,
      workout_name: originalDay.workout_name,
      target_tss: originalDay.target_tss,
      target_duration_minutes: originalDay.target_duration_minutes,
      target_if: originalDay.target_if,
      custom_description: originalDay.custom_description,
      intervals_json: originalDay.intervals_json,
      rescheduled_from: originalDay.date,
    })
    return { originalDay: updatedOriginal, newDay: updatedNew }
  } else {
    // Create a new day for the rescheduled workout
    const newDayDate = new Date(newDate)
    const planStartDate = new Date(originalDay.date)
    const weekNumber = Math.ceil(
      (newDayDate.getTime() - planStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
    ) + originalDay.week_number

    const [newDay] = await createPlanDays([{
      plan_id: planId,
      date: newDate,
      week_number: weekNumber,
      day_of_week: newDayDate.getDay(),
      workout_template_id: originalDay.workout_template_id ?? null,
      workout_type: originalDay.workout_type ?? null,
      workout_name: originalDay.workout_name ?? null,
      target_tss: originalDay.target_tss ?? null,
      target_duration_minutes: originalDay.target_duration_minutes ?? null,
      target_if: originalDay.target_if ?? null,
      custom_description: originalDay.custom_description ?? null,
      intervals_json: originalDay.intervals_json ?? null,
      completed: false,
      actual_session_id: null,
      actual_tss: null,
      actual_duration_minutes: null,
      compliance_score: null,
      coach_notes: null,
      athlete_notes: null,
      skipped: false,
      rescheduled_from: originalDay.date,
      rescheduled_to: null,
    }])

    return { originalDay: updatedOriginal, newDay: newDay || null }
  }
}

// Get plan days with events for projection
export async function getPlanDaysWithEvents(
  planId: string,
  athleteId: string
): Promise<{ days: PlanDay[]; events: Array<{ date: string; name: string; priority: string }> }> {
  const supabase = await createClient()
  if (!supabase) return { days: [], events: [] }

  // Get all plan days
  const days = await getPlanDays(planId)

  // Get the plan to find date range
  const plan = await getTrainingPlan(planId)
  if (!plan) return { days, events: [] }

  // Get events in the plan date range
  const { data: eventsData } = await supabase
    .from('events')
    .select('date, name, priority')
    .eq('athlete_id', athleteId)
    .gte('date', plan.start_date)
    .lte('date', plan.end_date)
    .eq('status', 'planned')
    .order('date', { ascending: true })

  const events = (eventsData || []).map(e => ({
    date: e.date,
    name: e.name,
    priority: e.priority,
  }))

  return { days, events }
}
