// Core data types for AI Training Analyst

export interface Athlete {
  id: string
  name: string
  email: string
  ftp: number // Functional Threshold Power (watts)
  ftp_updated_at: string
  max_hr: number
  lthr: number // Lactate Threshold HR
  resting_hr?: number
  weight_kg: number
  weekly_hours_available: number
  intervals_icu_id?: string // For API connection
  intervals_icu_token?: string // Encrypted OAuth token
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
  workout_type?: 'endurance' | 'tempo' | 'sweetspot' | 'threshold' | 'vo2max' | 'sprint' | 'recovery' | 'race' | 'mixed'

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
  days_until_event?: number
  event_name?: string
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

// Workout suggestion from AI
export interface WorkoutSuggestion {
  type: 'recovery' | 'endurance' | 'tempo' | 'threshold' | 'intervals'
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
