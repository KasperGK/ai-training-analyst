import { z } from 'zod'
import { defineTool } from './types'
import { getSession } from '@/lib/db/sessions'
import { getNormalizedPower, getAveragePower } from '@/lib/transforms'
import type { Session } from '@/types'

const inputSchema = z.object({
  sessionId: z.string().describe('The session ID to fetch details for'),
})

type Input = z.infer<typeof inputSchema>

interface PowerZones {
  z1: number
  z2: number
  z3: number
  z4: number
  z5: number
  z6: number
}

interface SessionResponse {
  session: {
    id: string
    date: string
    name: string | null
    type: string | null
    duration_seconds: number | null
    distance_meters: number | null
    tss: number | null
    intensity_factor: number | null
    normalized_power: number | null
    avg_power: number | null
    max_power: number | null
    avg_hr: number | null
    max_hr: number | null
    power_zones: PowerZones | null
    avg_cadence?: number
    elevation_gain?: number
    decoupling?: number
    calories?: number
  }
  analysis: {
    isHighIntensity: boolean
    isPolarized: boolean
    efficiencyFactor: number | null
    decoupling?: string | null
  }
  source: 'local' | 'intervals_icu'
}

interface ErrorResponse {
  error: string
}

type Output = SessionResponse | ErrorResponse

/**
 * Helper to build response from session data
 */
function buildSessionResponse(session: Session): SessionResponse {
  const powerZones = session.power_zones ?? null
  return {
    session: {
      id: session.id,
      date: session.date,
      name: session.workout_type ?? session.sport,
      type: session.sport,
      duration_seconds: session.duration_seconds,
      distance_meters: session.distance_meters ?? null,
      tss: session.tss ?? null,
      intensity_factor: session.intensity_factor ?? null,
      normalized_power: session.normalized_power ?? null,
      avg_power: session.avg_power ?? null,
      max_power: session.max_power ?? null,
      avg_hr: session.avg_hr ?? null,
      max_hr: session.max_hr ?? null,
      power_zones: powerZones,
    },
    analysis: {
      isHighIntensity: (session.intensity_factor || 0) > 0.85,
      isPolarized: powerZones
        ? (powerZones.z1 + powerZones.z2) > 70 || (powerZones.z5 + powerZones.z6) > 20
        : false,
      efficiencyFactor: session.normalized_power && session.avg_hr
        ? Math.round((session.normalized_power / session.avg_hr) * 100) / 100
        : null,
    },
    source: 'local',
  }
}

export const getDetailedSession = defineTool<Input, Output>({
  description: 'Fetch detailed data for a specific training session including power zones, HR zones, and full metrics. Use when the user asks about a specific workout or you need more details about a session.',
  inputSchema,
  execute: async ({ sessionId }, ctx) => {
    // Try local Supabase first if feature flag is enabled
    if (ctx.flags.useLocalData && ctx.athleteId) {
      try {
        const localSession = await getSession(sessionId)
        if (localSession) {
          return buildSessionResponse(localSession)
        }
      } catch {
        // Fall through to intervals.icu
      }
    }

    // Fall back to intervals.icu
    if (!ctx.intervalsConnected) {
      return { error: 'intervals.icu not connected. Please connect your account in Settings.' }
    }

    try {
      const activity = await ctx.intervalsClient.getActivity(sessionId)
      if (!activity) {
        return { error: 'Session not found' }
      }

      // Calculate power zone distribution if available
      let powerZones: PowerZones | null = null
      if (activity.power_zone_times && activity.power_zone_times.length > 0) {
        const total = activity.power_zone_times.reduce((a: number, b: number) => a + b, 0)
        if (total > 0) {
          powerZones = {
            z1: Math.round((activity.power_zone_times[0] || 0) / total * 100),
            z2: Math.round((activity.power_zone_times[1] || 0) / total * 100),
            z3: Math.round((activity.power_zone_times[2] || 0) / total * 100),
            z4: Math.round((activity.power_zone_times[3] || 0) / total * 100),
            z5: Math.round((activity.power_zone_times[4] || 0) / total * 100),
            z6: Math.round((activity.power_zone_times[5] || 0) / total * 100),
          }
        }
      }

      const session = {
        id: activity.id,
        date: activity.start_date_local,
        name: activity.name,
        type: activity.type,
        duration_seconds: activity.moving_time,
        distance_meters: activity.distance,
        tss: activity.icu_training_load,
        intensity_factor: activity.icu_intensity,
        normalized_power: getNormalizedPower(activity),
        avg_power: getAveragePower(activity),
        max_power: activity.max_watts,
        avg_hr: activity.average_heartrate,
        max_hr: activity.max_heartrate,
        avg_cadence: activity.average_cadence,
        elevation_gain: activity.total_elevation_gain,
        power_zones: powerZones,
        decoupling: activity.decoupling,
        calories: activity.calories,
      }

      return {
        session,
        analysis: {
          isHighIntensity: (activity.icu_intensity || 0) > 0.85,
          isPolarized: powerZones
            ? (powerZones.z1 + powerZones.z2) > 70 || (powerZones.z5 + powerZones.z6) > 20
            : false,
          efficiencyFactor: session.normalized_power && session.avg_hr
            ? Math.round((session.normalized_power / session.avg_hr) * 100) / 100
            : null,
          decoupling: activity.decoupling
            ? `${activity.decoupling.toFixed(1)}% (${activity.decoupling < 5 ? 'good aerobic fitness' : 'needs more base work'})`
            : null,
        },
        source: 'intervals_icu',
      }
    } catch (error) {
      return { error: `Failed to fetch session: ${error instanceof Error ? error.message : 'Unknown error'}` }
    }
  },
})
