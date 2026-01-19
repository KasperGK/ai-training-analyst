/**
 * Withings API integration
 * Handles OAuth and data fetching for weight/body composition
 */

const WITHINGS_AUTH_URL = 'https://account.withings.com/oauth2_user/authorize2'
const WITHINGS_TOKEN_URL = 'https://wbsapi.withings.net/v2/oauth2'
const WITHINGS_MEASURE_URL = 'https://wbsapi.withings.net/measure'

// Measurement types from Withings API
export const MEASURE_TYPES = {
  WEIGHT: 1,
  HEIGHT: 4,
  FAT_FREE_MASS: 5,
  FAT_RATIO: 6,
  FAT_MASS_WEIGHT: 8,
  MUSCLE_MASS: 76,
  HYDRATION: 77,
  BONE_MASS: 88,
} as const

// Scopes we need for body composition data
const SCOPES = ['user.metrics']

export interface WithingsTokenResponse {
  status: number
  body: {
    access_token: string
    refresh_token: string
    expires_in: number
    token_type: string
    scope: string
    userid: string
  }
}

export interface WithingsMeasure {
  value: number
  type: number
  unit: number
}

export interface WithingsMeasureGroup {
  grpid: number
  attrib: number
  date: number
  created: number
  category: number
  deviceid: string | null
  measures: WithingsMeasure[]
}

export interface WithingsMeasureResponse {
  status: number
  body: {
    updatetime: number
    timezone: string
    measuregrps: WithingsMeasureGroup[]
    more: number
    offset: number
  }
}

export interface BodyMeasurement {
  measured_at: Date
  external_id: string
  weight_kg?: number
  fat_mass_kg?: number
  fat_ratio_percent?: number
  fat_free_mass_kg?: number
  muscle_mass_kg?: number
  bone_mass_kg?: number
  hydration_kg?: number
}

/**
 * Generate OAuth authorization URL
 */
export function getWithingsAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES.join(','),
    state: state,
  })

  return `${WITHINGS_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeWithingsCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<WithingsTokenResponse> {
  const params = new URLSearchParams({
    action: 'requesttoken',
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code: code,
    redirect_uri: redirectUri,
  })

  const response = await fetch(WITHINGS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  const data = await response.json()

  if (data.status !== 0) {
    throw new Error(`Withings token error: ${data.status} - ${JSON.stringify(data)}`)
  }

  return data
}

/**
 * Refresh access token using refresh token
 */
export async function refreshWithingsToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<WithingsTokenResponse> {
  const params = new URLSearchParams({
    action: 'requesttoken',
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  })

  const response = await fetch(WITHINGS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  const data = await response.json()

  if (data.status !== 0) {
    throw new Error(`Withings refresh error: ${data.status} - ${JSON.stringify(data)}`)
  }

  return data
}

/**
 * Fetch body measurements from Withings
 */
export async function fetchWithingsMeasurements(
  accessToken: string,
  startDate?: Date,
  endDate?: Date
): Promise<WithingsMeasureResponse> {
  const params = new URLSearchParams({
    action: 'getmeas',
    meastypes: Object.values(MEASURE_TYPES).join(','),
    category: '1', // Real measurements only (not user objectives)
  })

  if (startDate) {
    params.append('startdate', Math.floor(startDate.getTime() / 1000).toString())
  }
  if (endDate) {
    params.append('enddate', Math.floor(endDate.getTime() / 1000).toString())
  }

  const response = await fetch(WITHINGS_MEASURE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  const data = await response.json()

  if (data.status !== 0) {
    throw new Error(`Withings measure error: ${data.status} - ${JSON.stringify(data)}`)
  }

  return data
}

/**
 * Convert Withings measure value to real value
 * Withings stores values as: realValue = value * 10^unit
 */
function convertMeasureValue(value: number, unit: number): number {
  return value * Math.pow(10, unit)
}

/**
 * Parse Withings measurement groups into our format
 */
export function parseMeasurements(response: WithingsMeasureResponse): BodyMeasurement[] {
  const measurements: BodyMeasurement[] = []

  for (const group of response.body.measuregrps) {
    const measurement: BodyMeasurement = {
      measured_at: new Date(group.date * 1000),
      external_id: group.grpid.toString(),
    }

    for (const measure of group.measures) {
      const value = convertMeasureValue(measure.value, measure.unit)

      switch (measure.type) {
        case MEASURE_TYPES.WEIGHT:
          measurement.weight_kg = Math.round(value * 100) / 100
          break
        case MEASURE_TYPES.FAT_FREE_MASS:
          measurement.fat_free_mass_kg = Math.round(value * 100) / 100
          break
        case MEASURE_TYPES.FAT_RATIO:
          measurement.fat_ratio_percent = Math.round(value * 10) / 10
          break
        case MEASURE_TYPES.FAT_MASS_WEIGHT:
          measurement.fat_mass_kg = Math.round(value * 100) / 100
          break
        case MEASURE_TYPES.MUSCLE_MASS:
          measurement.muscle_mass_kg = Math.round(value * 100) / 100
          break
        case MEASURE_TYPES.BONE_MASS:
          measurement.bone_mass_kg = Math.round(value * 100) / 100
          break
        case MEASURE_TYPES.HYDRATION:
          measurement.hydration_kg = Math.round(value * 100) / 100
          break
      }
    }

    // Only include if we have at least weight
    if (measurement.weight_kg) {
      measurements.push(measurement)
    }
  }

  // Sort by date descending (most recent first)
  return measurements.sort((a, b) => b.measured_at.getTime() - a.measured_at.getTime())
}
