// Core data types for AI Training Analyst
// Note: Database fields can be NULL; use optional types where data may be missing

export interface Athlete {
  id: string
  name: string
  email: string
  /** Functional Threshold Power in watts. From intervals.icu sportSettings[0].ftp */
  ftp?: number | null
  ftp_updated_at?: string | null
  /** Maximum heart rate. From intervals.icu sportSettings[0].max_hr */
  max_hr?: number | null
  /** Lactate Threshold HR. From intervals.icu sportSettings[0].lthr */
  lthr?: number | null
  /** Resting HR. From intervals.icu icu_resting_hr */
  resting_hr?: number | null
  /** Weight in kg. From intervals.icu icu_weight */
  weight_kg?: number | null
  weekly_hours_available?: number | null
  intervals_icu_id?: string | null
  intervals_icu_token?: string | null
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  athlete_id: string
  date: string
  duration_seconds: number
  distance_meters?: number
  sport: 'cycling' | 'running' | 'swimming' | 'other'
  /**
   * Workout type/name. Can be:
   * - Structured type from FIT uploads: 'endurance', 'tempo', 'sweetspot', etc.
   * - Free-form activity name from intervals.icu: "Zwift - Zone 2 Ride"
   */
  workout_type?: string

  // Power metrics
  avg_power?: number
  max_power?: number
  normalized_power?: number
  intensity_factor?: number // NP / FTP
  tss?: number // Training Stress Score

  // Heart rate
  avg_hr?: number
  max_hr?: number

  // Zone distributions (percentage of time)
  power_zones?: PowerZones
  hr_zones?: HRZones

  // AI analysis
  ai_summary?: string

  // Source
  source: 'intervals_icu' | 'fit_upload' | 'manual'
  external_id?: string
}

export interface PowerZones {
  z1: number // Recovery
  z2: number // Endurance
  z3: number // Tempo
  z4: number // Threshold
  z5: number // VO2max
  z6: number // Anaerobic
  z7?: number // Neuromuscular
}

export interface HRZones {
  z1: number
  z2: number
  z3: number
  z4: number
  z5: number
}

export interface FitnessHistory {
  athlete_id: string
  date: string
  ctl: number // Chronic Training Load (fitness)
  atl: number // Acute Training Load (fatigue)
  tsb: number // Training Stress Balance (form) = CTL - ATL
  tss_day: number // Total TSS that day
  // Sleep and recovery metrics from Garmin
  sleep_seconds?: number | null
  sleep_score?: number | null
  hrv?: number | null
  resting_hr?: number | null
  readiness?: number | null
}

export interface Event {
  id: string
  athlete_id: string
  name: string
  date: string
  priority: 'A' | 'B' | 'C'
  event_type?: 'road_race' | 'gran_fondo' | 'crit' | 'tt' | 'mtb' | 'gravel' | 'other'
  distance_km?: number
  elevation_m?: number
  status: 'planned' | 'completed' | 'dns' | 'dnf' | 'cancelled'
}

export interface AIInsight {
  id: string
  athlete_id: string
  session_id?: string
  type: 'observation' | 'recommendation' | 'alert' | 'summary'
  category: 'fatigue' | 'fitness' | 'pacing' | 'zones' | 'recovery' | 'progression' | 'event_prep' | 'general'
  priority: 'low' | 'medium' | 'high'
  title: string
  content: string
  created_at: string
}

// Current fitness state for dashboard
export interface CurrentFitness {
  ctl: number
  atl: number
  tsb: number
  ctl_trend: 'up' | 'down' | 'stable'
  ctl_change?: number
  days_until_event?: number
  event_name?: string
  // Sleep data from last night
  sleep_seconds?: number | null
  sleep_score?: number | null
  hrv?: number | null
  resting_hr?: number | null
}

// Chat message types (for UI)
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

// Goals
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
  created_at: string
  updated_at: string
}

// Integration (OAuth)
export interface Integration {
  id: string
  athlete_id: string
  provider: string
  external_athlete_id: string | null
  token_expires_at: string | null
  created_at: string
  updated_at: string
}

// All available workout types
export type WorkoutType =
  // Basic (original 5)
  | 'recovery'
  | 'endurance'
  | 'tempo'
  | 'threshold'
  | 'intervals'
  // Sweet spot workouts
  | 'sweetspot_2x20'
  | 'sweetspot_3x15'
  | 'sweetspot_over_under'
  // VO2max workouts
  | 'vo2max_5x5'
  | 'vo2max_4x4'
  | 'vo2max_3x3'
  // Threshold workouts
  | 'threshold_2x20'
  | 'threshold_3x12'
  // Endurance workouts
  | 'endurance_long'
  | 'tempo_progression'

// Workout suggestion from AI
export interface WorkoutSuggestion {
  type: WorkoutType
  duration_minutes: number
  description: string
  target_tss: number
  intervals?: {
    sets: number
    duration_seconds: number
    rest_seconds: number
    target_power_percent: number // % of FTP
  }
}

// Training Plan types (Phase 4)
export type PlanGoal = 'base_build' | 'ftp_build' | 'event_prep' | 'taper' | 'maintenance'
export type PlanStatus = 'draft' | 'active' | 'completed' | 'abandoned'

export interface TrainingPlan {
  id: string
  athlete_id: string
  name: string
  description?: string | null
  goal: PlanGoal
  duration_weeks: number
  weekly_hours_target?: number | null
  start_date: string
  end_date: string
  key_workout_days?: number[]
  target_event_id?: string | null
  target_event_date?: string | null
  status: PlanStatus
  progress_percent?: number
  plan_data?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface PlanDay {
  id: string
  plan_id: string
  date: string
  week_number: number
  day_of_week: number
  workout_template_id?: string | null
  workout_type?: string | null
  workout_name?: string | null
  target_tss?: number | null
  target_duration_minutes?: number | null
  target_if?: number | null
  custom_description?: string | null
  intervals_json?: Record<string, unknown> | null
  completed: boolean
  actual_session_id?: string | null
  actual_tss?: number | null
  actual_duration_minutes?: number | null
  compliance_score?: number | null
  coach_notes?: string | null
  athlete_notes?: string | null
  skipped?: boolean
  rescheduled_from?: string | null
  rescheduled_to?: string | null
  created_at: string
  updated_at: string
}

export interface PowerBest {
  id: string
  athlete_id: string
  duration_seconds: number
  power_watts: number
  watts_per_kg?: number | null
  session_id?: string | null
  recorded_date: string
  is_current_best: boolean
  created_at: string
}
