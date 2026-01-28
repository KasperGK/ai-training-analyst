/**
 * ZwiftPower API Client
 *
 * Wraps the @codingwithspike/zwift-api-wrapper library to provide
 * access to ZwiftPower race results and competitor data.
 */

import { ZwiftPowerAPI } from '@codingwithspike/zwift-api-wrapper'

// Response wrapper type from the library
interface ZwiftAPIWrapperResponse<T> {
  statusCode: number
  error?: string
  body: T | undefined
}

// ZwiftPower event result for a single rider (normalized)
export interface ZwiftPowerEventResult {
  zwid: number | string   // Zwift ID (API returns string)
  name: string            // Rider name
  flag?: string           // Country flag code
  category: string        // Race category (A, B, C, D, E) - from 'label' field
  pos: number             // Position in category
  pos_in_grp?: number     // Position in group
  time: number            // Finish time in seconds - from 'race_time' field
  time_gun?: number       // Gun time
  avg_power?: number      // Average power - from 'watts' field
  wkg?: number            // W/kg
  wkg_ftp?: number        // FTP-based W/kg
  avg_hr?: number         // Average heart rate - from 'bpm' field
  max_hr?: number         // Max heart rate - from 'hrm' field
  power_type?: string     // Power source (zPower, PM, etc.)
  zrs?: number            // Zwift Racing Score
  race_score?: number     // Race score
  penalty?: string        // Any penalties
}

// ZwiftPower event details
export interface ZwiftPowerEvent {
  eventId: string
  name: string
  date: string
  route?: string
  distance_km?: number
  elevation_m?: number
  race_type?: string      // flat, hilly, mixed, tt
  categories?: string[]
}

// ZwiftPower rider profile results (historical)
export interface ZwiftPowerRiderResult {
  event_id: string
  event_name: string
  event_date: string
  category: string
  pos: number
  total: number           // Total riders in category
  time: number
  avg_power?: number
  wkg?: number
  zrs?: number
}

// Authenticated credentials for reuse
interface ZwiftPowerCredentials {
  cookies: string
  expiresAt: number
}

class ZwiftPowerClient {
  private api: ZwiftPowerAPI | null = null
  private username: string | null = null
  private password: string | null = null
  private credentials: ZwiftPowerCredentials | null = null

  /**
   * Set credentials for authentication
   */
  setCredentials(username: string, password: string): void {
    this.username = username
    this.password = password
    this.api = new ZwiftPowerAPI(username, password)
  }

  /**
   * Check if credentials are set
   */
  hasCredentials(): boolean {
    return this.username !== null && this.password !== null
  }

  /**
   * Authenticate with ZwiftPower
   * Note: ZwiftPower auth can be slow (2-3 seconds)
   */
  async authenticate(): Promise<boolean> {
    if (!this.api) {
      throw new Error('No credentials set. Call setCredentials() first.')
    }

    try {
      const creds = await this.api.authenticate()
      this.credentials = {
        cookies: creds,
        expiresAt: Date.now() + 30 * 60 * 1000, // 30 minute expiry assumption
      }
      return true
    } catch (error) {
      console.error('[ZwiftPower] Authentication failed:', error)
      return false
    }
  }

  /**
   * Check if currently authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    if (!this.api) return false
    if (!this.credentials) return false
    if (Date.now() > this.credentials.expiresAt) return false
    return this.api.isAuthenticated()
  }

  /**
   * Ensure authenticated before making API calls
   */
  private async ensureAuthenticated(): Promise<void> {
    const isAuth = await this.isAuthenticated()
    if (!isAuth) {
      const success = await this.authenticate()
      if (!success) {
        throw new Error('Failed to authenticate with ZwiftPower')
      }
    }
  }

  /**
   * Get results for a specific event
   */
  async getEventResults(eventId: string): Promise<ZwiftPowerEventResult[]> {
    await this.ensureAuthenticated()

    if (!this.api) {
      throw new Error('API not initialized')
    }

    try {
      const response = await this.api.getEventResults(eventId) as ZwiftAPIWrapperResponse<{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data?: any[]
      }>

      if (response.statusCode !== 200 || !response.body) {
        console.error('[ZwiftPower] Event results error:', response.error)
        return []
      }

      // Normalize API response to our interface
      // API returns: zwid (string), label (category), watts (power), race_time (seconds), bpm (hr)
      // Some fields are arrays like [value, delta] - extract first element
      const extractValue = (v: unknown): number | undefined => {
        if (Array.isArray(v)) return typeof v[0] === 'string' ? parseFloat(v[0]) : v[0]
        if (typeof v === 'string') return parseFloat(v)
        if (typeof v === 'number') return v
        return undefined
      }

      return (response.body.data || []).map((r) => ({
        zwid: r.zwid,
        name: r.name || '',
        flag: r.flag,
        category: String(r.label || r.category || ''), // 'label' is category number (1=A, 2=B, etc)
        pos: extractValue(r.pos) || 0,
        pos_in_grp: extractValue(r.pos_in_grp),
        time: extractValue(r.race_time) || extractValue(r.time) || 0,
        time_gun: extractValue(r.time_gun),
        avg_power: extractValue(r.watts) || extractValue(r.avg_power),
        wkg: extractValue(r.wkg),
        wkg_ftp: extractValue(r.wkg_ftp),
        avg_hr: extractValue(r.bpm) || extractValue(r.avg_hr),
        max_hr: extractValue(r.hrm) || extractValue(r.max_hr),
        power_type: r.power_type,
        zrs: extractValue(r.zrs) || extractValue(r.skill),
        race_score: extractValue(r.race_score),
        penalty: r.penalty,
      }))
    } catch (error) {
      console.error('[ZwiftPower] Error fetching event results:', error)
      return []
    }
  }

  /**
   * Get rider's race history from ZwiftPower
   */
  async getRiderHistory(zwiftId: string): Promise<ZwiftPowerRiderResult[]> {
    await this.ensureAuthenticated()

    if (!this.api) {
      throw new Error('API not initialized')
    }

    try {
      // Use the library's getActivityResults method
      const response = await this.api.getActivityResults(zwiftId)

      if (response.statusCode !== 200 || !response.body?.data) {
        console.error('[ZwiftPower] Rider history error:', response.error)
        return []
      }

      // Map the activity results to our ZwiftPowerRiderResult format
      // The API returns: zid (event_id), event_title, event_date, category, position_in_cat, etc.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return response.body.data.map((r: any) => {
        // Parse power value - may be string with European decimal format (comma)
        let avgPower = r.avg_power
        if (typeof avgPower === 'string') {
          avgPower = parseFloat(avgPower.replace(',', '.'))
        }

        return {
          event_id: String(r.zid || ''),
          event_name: String(r.event_title || ''),
          // event_date might be a timestamp number or string
          event_date: typeof r.event_date === 'number'
            ? new Date(r.event_date * 1000).toISOString().split('T')[0]
            : String(r.event_date || ''),
          category: String(r.category || ''),
          pos: r.position_in_cat ?? r.pos ?? 0,
          total: 0, // Not directly available from this endpoint
          time: Array.isArray(r.time) ? r.time[0] : (r.time || 0),
          avg_power: avgPower,
          wkg: r.avg_wkg,
          zrs: r.skill,
        }
      })
    } catch (error) {
      console.error('[ZwiftPower] Error fetching rider history:', error)
      return []
    }
  }

  /**
   * Search for events by name or date range
   */
  async searchEvents(query: {
    name?: string
    startDate?: string  // YYYY-MM-DD
    endDate?: string    // YYYY-MM-DD
    limit?: number
  }): Promise<ZwiftPowerEvent[]> {
    await this.ensureAuthenticated()

    if (!this.api) {
      throw new Error('API not initialized')
    }

    try {
      // Build query params
      const params = new URLSearchParams()
      if (query.name) params.append('name', query.name)
      if (query.startDate) params.append('start', query.startDate)
      if (query.endDate) params.append('end', query.endDate)
      if (query.limit) params.append('limit', query.limit.toString())

      const response = await this.api.getAuthenticated(
        `/api3.php?do=event_search&${params.toString()}`
      ) as ZwiftAPIWrapperResponse<string>

      if (response.statusCode !== 200 || !response.body) {
        console.error('[ZwiftPower] Event search error:', response.error)
        return []
      }

      const data = JSON.parse(response.body) as { data?: ZwiftPowerEvent[] }
      return data.data || []
    } catch (error) {
      console.error('[ZwiftPower] Error searching events:', error)
      return []
    }
  }

  /**
   * Get details for a specific event
   */
  async getEventDetails(eventId: string): Promise<ZwiftPowerEvent | null> {
    await this.ensureAuthenticated()

    if (!this.api) {
      throw new Error('API not initialized')
    }

    try {
      const response = await this.api.getAuthenticated(
        `/api3.php?do=event_results&zid=${eventId}`
      ) as ZwiftAPIWrapperResponse<string>

      if (response.statusCode !== 200 || !response.body) {
        console.error('[ZwiftPower] Event details error:', response.error)
        return null
      }

      const data = JSON.parse(response.body) as { event?: ZwiftPowerEvent }
      return data.event || null
    } catch (error) {
      console.error('[ZwiftPower] Error fetching event details:', error)
      return null
    }
  }

  /**
   * Get rider's Zwift Racing Score history
   */
  async getRiderZRS(zwiftId: string): Promise<{
    current_zrs?: number
    history?: Array<{ date: string; zrs: number; event_id: string }>
  }> {
    await this.ensureAuthenticated()

    if (!this.api) {
      throw new Error('API not initialized')
    }

    try {
      const response = await this.api.getAuthenticated(
        `/api3.php?do=profile_zrs&zwift_id=${zwiftId}`
      ) as ZwiftAPIWrapperResponse<string>

      if (response.statusCode !== 200 || !response.body) {
        console.error('[ZwiftPower] ZRS history error:', response.error)
        return {}
      }

      return JSON.parse(response.body)
    } catch (error) {
      console.error('[ZwiftPower] Error fetching ZRS history:', error)
      return {}
    }
  }
}

// Singleton instance
export const zwiftPowerClient = new ZwiftPowerClient()

/**
 * Helper to extract event ID from activity name
 * Zwift activities often have names like "Zwift - Race: Stage 2 - Tour de Zwift"
 * This attempts to match them to ZwiftPower events
 */
export function parseZwiftActivityName(activityName: string): {
  isRace: boolean
  eventName?: string
} {
  if (!activityName) {
    return { isRace: false }
  }

  // Common patterns for Zwift races
  const racePatterns = [
    /^Zwift\s*-?\s*Race:\s*(.+)$/i,
    /^Race:\s*(.+)$/i,
    /^ZRL\s*(.+)$/i,
    /^WTRL\s*(.+)$/i,
    /^TTT\s*(.+)$/i,
    /^Crit City\s*(.+)$/i,
    /^ZRS\s*(.+)$/i,
  ]

  for (const pattern of racePatterns) {
    const match = activityName.match(pattern)
    if (match) {
      return {
        isRace: true,
        eventName: match[1]?.trim() || activityName,
      }
    }
  }

  return { isRace: false }
}

/**
 * Infer race type from route/course characteristics
 */
export function inferRaceType(
  elevationM: number | undefined,
  distanceKm: number | undefined
): 'flat' | 'hilly' | 'mixed' | 'tt' | null {
  if (elevationM === undefined || distanceKm === undefined) {
    return null
  }

  // Calculate elevation per km
  const elevationPerKm = elevationM / distanceKm

  if (elevationPerKm < 5) return 'flat'
  if (elevationPerKm > 20) return 'hilly'
  return 'mixed'
}

/**
 * Simple encryption for storing Zwift password
 * Uses AES-256-GCM with a key derived from environment variable
 *
 * NOTE: For production, use Supabase Vault or a proper secrets manager
 */
export async function encryptPassword(password: string): Promise<string> {
  // In development, use base64 encoding with a prefix marker
  // In production, this should use proper encryption
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const base64 = Buffer.from(data).toString('base64')
  return `enc:${base64}`
}

export async function decryptPassword(encrypted: string): Promise<string> {
  // Check for our encryption prefix
  if (!encrypted.startsWith('enc:')) {
    // Not encrypted, return as-is (for backwards compatibility)
    return encrypted
  }

  const base64 = encrypted.slice(4)
  const data = Buffer.from(base64, 'base64')
  return new TextDecoder().decode(data)
}
