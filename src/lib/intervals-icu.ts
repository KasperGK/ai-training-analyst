// intervals.icu API Client
// Documentation: https://intervals.icu/api/v1/docs

const BASE_URL = 'https://intervals.icu'

export interface IntervalsAthlete {
  id: string
  name: string
  email: string
  // Note: weight, ftp, etc. are in icu_ prefixed fields or sportSettings
  weight: number | null // kg - often null, use icu_weight
  icu_weight: number | null
  icu_resting_hr: number | null
  sportSettings: {
    type: string
    ftp: number
    indoor_ftp: number | null
    lthr: number
    max_hr: number
  }[]
}

// Helper to get athlete metrics from sportSettings (cycling by default)
export function getAthleteMetrics(athlete: IntervalsAthlete) {
  const cycling = athlete.sportSettings?.find(s => s.type === 'Bike') || athlete.sportSettings?.[0]
  return {
    ftp: cycling?.ftp || null,
    lthr: cycling?.lthr || null,
    maxHr: cycling?.max_hr || null,
    weight: athlete.icu_weight || athlete.weight || null,
    restingHr: athlete.icu_resting_hr || null,
  }
}

export interface IntervalsActivity {
  id: string
  start_date_local: string
  type: string
  name: string
  moving_time: number // seconds
  elapsed_time: number
  distance: number // meters
  total_elevation_gain: number
  average_watts: number
  weighted_average_watts: number // NP
  icu_weighted_avg_watts: number // NP (intervals.icu field)
  icu_average_watts: number // avg power (intervals.icu field)
  max_watts: number
  average_heartrate: number
  max_heartrate: number
  average_cadence?: number
  icu_training_load: number // TSS
  icu_intensity: number // IF
  icu_ctl: number
  icu_atl: number
  icu_ftp: number
  source: string // STRAVA, UPLOAD, GARMIN_CONNECT, etc.
  pace_zone_times?: number[]
  hr_zone_times?: number[]
  power_zone_times?: number[]
  // Zone breakdown
  icu_zone_times?: { id: string; secs: number }[]
  icu_hr_zone_times?: number[]
  // Additional metrics
  icu_joules?: number
  trimp?: number
  decoupling?: number
  calories?: number
  interval_summary?: string[]
}

// Raw stream item from API
interface IntervalsStreamItem {
  type: string
  data: number[]
}

// Activity streams (time-series data)
export interface IntervalsStreams {
  time?: number[]      // seconds from start
  watts?: number[]     // power
  heartrate?: number[] // HR
  cadence?: number[]   // cadence
  distance?: number[]  // cumulative distance
  altitude?: number[]  // elevation
  velocity_smooth?: number[] // speed
}

// Helper to convert API response to our format
function parseStreamsResponse(items: IntervalsStreamItem[]): IntervalsStreams {
  const streams: IntervalsStreams = {}
  if (!items || !Array.isArray(items)) return streams

  for (const item of items) {
    if (!item || !item.data) continue
    if (item.type === 'time') streams.time = item.data
    else if (item.type === 'watts') streams.watts = item.data
    else if (item.type === 'heartrate') streams.heartrate = item.data
    else if (item.type === 'cadence') streams.cadence = item.data
    else if (item.type === 'distance') streams.distance = item.data
    else if (item.type === 'altitude') streams.altitude = item.data
    else if (item.type === 'velocity_smooth') streams.velocity_smooth = item.data
  }
  return streams
}

export interface IntervalsWellness {
  id: string
  date: string
  ctl: number
  atl: number
  rampRate: number
  ctlLoad: number
  atlLoad: number
  weight?: number
  restingHR?: number
  hrv?: number
  hrvSDNN?: number
  sleepSecs?: number
  sleepScore?: number
  sleepQuality?: number
  fatigue?: number
  mood?: number
  readiness?: number
  motivation?: number
  injury?: number
}

// Power curve data point
export interface IntervalsPowerCurve {
  secs: number      // Duration in seconds
  watts: number     // Peak power at this duration
  activity_id?: string // Activity where this was achieved
  activity_date?: string
}

class IntervalsICUClient {
  private apiKey: string | null = null
  private athleteId: string | null = null

  constructor() {}

  setCredentials(apiKey: string, athleteId: string) {
    this.apiKey = apiKey
    this.athleteId = athleteId
  }

  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.apiKey) {
      throw new Error('No API key set. Call setCredentials() first.')
    }

    const url = `${BASE_URL}${endpoint}`
    // intervals.icu uses Basic Auth with API_KEY as username and the key as password
    const basicAuth = Buffer.from(`API_KEY:${this.apiKey}`).toString('base64')

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`intervals.icu API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  // Get athlete profile
  async getAthlete(): Promise<IntervalsAthlete> {
    if (!this.athleteId) throw new Error('No athlete ID set')
    return this.fetch<IntervalsAthlete>(`/api/v1/athlete/${this.athleteId}`)
  }

  // Get activities for date range
  async getActivities(oldest: string, newest: string): Promise<IntervalsActivity[]> {
    if (!this.athleteId) throw new Error('No athlete ID set')
    return this.fetch<IntervalsActivity[]>(
      `/api/v1/athlete/${this.athleteId}/activities?oldest=${oldest}&newest=${newest}`
    )
  }

  // Get wellness data (CTL, ATL, TSB) for date range
  async getWellness(oldest: string, newest: string): Promise<IntervalsWellness[]> {
    if (!this.athleteId) throw new Error('No athlete ID set')
    return this.fetch<IntervalsWellness[]>(
      `/api/v1/athlete/${this.athleteId}/wellness?oldest=${oldest}&newest=${newest}`
    )
  }

  // Get single wellness record
  async getWellnessForDate(date: string): Promise<IntervalsWellness> {
    if (!this.athleteId) throw new Error('No athlete ID set')
    return this.fetch<IntervalsWellness>(
      `/api/v1/athlete/${this.athleteId}/wellness/${date}`
    )
  }

  // Get activity details
  async getActivity(activityId: string): Promise<IntervalsActivity> {
    return this.fetch<IntervalsActivity>(`/api/v1/activity/${activityId}`)
  }

  // Get activity streams (time-series data for charts)
  async getActivityStreams(
    activityId: string,
    types: string[] = ['time', 'watts', 'heartrate', 'cadence']
  ): Promise<IntervalsStreams> {
    const typesParam = types.join(',')
    const items = await this.fetch<IntervalsStreamItem[]>(
      `/api/v1/activity/${activityId}/streams?types=${typesParam}`
    )
    return parseStreamsResponse(items)
  }

  // Get power curves for date range
  // Returns peak power for various durations (5s, 1min, 5min, 20min, etc.)
  async getPowerCurves(oldest: string, newest: string): Promise<IntervalsPowerCurve[]> {
    if (!this.athleteId) throw new Error('No athlete ID set')
    return this.fetch<IntervalsPowerCurve[]>(
      `/api/v1/athlete/${this.athleteId}/power-curves?oldest=${oldest}&newest=${newest}`
    )
  }
}

// Singleton instance
export const intervalsClient = new IntervalsICUClient()

// OAuth configuration
export const INTERVALS_OAUTH_CONFIG = {
  authorizationUrl: 'https://intervals.icu/oauth/authorize',
  tokenUrl: 'https://intervals.icu/oauth/token',
  scope: 'ACTIVITY:READ WELLNESS:READ ATHLETE:READ',
}

// Generate OAuth authorization URL
export function getOAuthAuthorizationUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: INTERVALS_OAUTH_CONFIG.scope,
    state,
  })
  return `${INTERVALS_OAUTH_CONFIG.authorizationUrl}?${params.toString()}`
}

// Exchange authorization code for access token
export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ access_token: string; athlete_id: string }> {
  const response = await fetch(INTERVALS_OAUTH_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  })

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status}`)
  }

  return response.json()
}

// Helper to format date for API (YYYY-MM-DD)
export function formatDateForApi(date: Date): string {
  return date.toISOString().split('T')[0]
}

// Get date range for last N days
export function getDateRange(days: number): { oldest: string; newest: string } {
  const newest = new Date()
  const oldest = new Date()
  oldest.setDate(oldest.getDate() - days)
  return {
    oldest: formatDateForApi(oldest),
    newest: formatDateForApi(newest),
  }
}
