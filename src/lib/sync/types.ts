// Sync infrastructure types for intervals.icu -> Supabase synchronization

export type SyncStatus = 'idle' | 'syncing' | 'error'
export type SyncProvider = 'intervals_icu'

export interface SyncLog {
  id: string
  athlete_id: string
  provider: SyncProvider
  last_sync_at: string | null
  last_activity_date: string | null   // Most recent synced activity
  oldest_activity_date: string | null // For backfill tracking
  status: SyncStatus
  error_message: string | null
  activities_synced: number
  wellness_synced: number
  created_at: string
  updated_at: string
}

export interface SyncResult {
  success: boolean
  activitiesSynced: number
  wellnessSynced: number
  lastActivityDate: string | null
  errors: string[]
  duration_ms: number
}

export interface SyncOptions {
  /** Only sync activities newer than this date */
  since?: string
  /** Only sync activities older than this date (for backfill) */
  until?: string
  /** Force full re-sync (ignore last_activity_date) */
  force?: boolean
  /** Maximum number of activities to sync in one batch */
  batchSize?: number
}

// Intervals.icu raw activity format (subset of fields we care about)
export interface IntervalsActivity {
  id: string
  start_date_local: string
  name: string
  type: string
  moving_time: number
  distance?: number
  icu_training_load?: number
  icu_intensity?: number
  icu_weighted_avg_watts?: number
  weighted_average_watts?: number
  icu_average_watts?: number
  average_watts?: number
  max_watts?: number
  average_heartrate?: number
  max_heartrate?: number
  average_cadence?: number
  total_elevation_gain?: number
  power_zone_times?: number[]
  hr_zone_times?: number[]
  decoupling?: number
  calories?: number
  source?: string
}

// Intervals.icu wellness/fitness data
export interface IntervalsWellness {
  id: string
  date: string  // YYYY-MM-DD
  ctl: number
  atl: number
  rampRate?: number
  weight?: number
  restingHR?: number
  hrv?: number
  hrvSDNN?: number
  sleepSecs?: number
  sleepScore?: number
  sleepQuality?: number
  fatigue?: number
  mood?: number
  motivation?: number
  readiness?: number
  stress?: number
  soreness?: number
  spO2?: number
  notes?: string
}

// Transform intervals activity to our Session format
export interface SessionInsert {
  athlete_id: string
  date: string
  duration_seconds: number
  distance_meters: number | null
  sport: string
  workout_type: string | null
  avg_power: number | null
  max_power: number | null
  normalized_power: number | null
  intensity_factor: number | null
  tss: number | null
  avg_hr: number | null
  max_hr: number | null
  avg_cadence: number | null
  total_ascent: number | null
  power_zones: Record<string, number> | null
  hr_zones: Record<string, number> | null
  source: string
  external_id: string
  raw_data: Record<string, unknown>
  synced_at: string
}

// Transform intervals wellness to our FitnessHistory format
export interface FitnessHistoryInsert {
  athlete_id: string
  date: string
  ctl: number
  atl: number
  tsb: number
  tss_day: number
  // Sleep and recovery metrics from Garmin
  sleep_seconds: number | null
  sleep_score: number | null
  hrv: number | null
  resting_hr: number | null
  readiness: number | null
  synced_at: string
  source: string
}
