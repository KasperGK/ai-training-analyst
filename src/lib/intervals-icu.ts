// intervals.icu API Client
// Documentation: https://intervals.icu/api/v1/docs

const BASE_URL = 'https://intervals.icu'

export interface IntervalsAthlete {
  id: string
  name: string
  email: string
  weight: number // kg
  ftp: number
  lthr: number
  maxHr: number
  restingHr: number
  sportSettings: {
    type: string
    ftp: number
    lthr: number
    maxHr: number
  }[]
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
  max_watts: number
  average_heartrate: number
  max_heartrate: number
  icu_training_load: number // TSS
  icu_intensity: number // IF
  icu_ctl: number
  icu_atl: number
  icu_ftp: number
  pace_zone_times?: number[]
  hr_zone_times?: number[]
  power_zone_times?: number[]
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

class IntervalsICUClient {
  private accessToken: string | null = null
  private athleteId: string | null = null

  constructor() {}

  setCredentials(accessToken: string, athleteId: string) {
    this.accessToken = accessToken
    this.athleteId = athleteId
  }

  // For API key auth (simpler for testing)
  setApiKey(apiKey: string, athleteId: string) {
    this.accessToken = apiKey
    this.athleteId = athleteId
  }

  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.accessToken) {
      throw new Error('No access token set. Call setCredentials() first.')
    }

    const url = `${BASE_URL}${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
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
