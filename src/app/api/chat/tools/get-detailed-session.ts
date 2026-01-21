import { z } from 'zod'
import { defineTool } from './types'
import { getSession } from '@/lib/db/sessions'
import { getNormalizedPower, getAveragePower } from '@/lib/transforms'
import type { Session } from '@/types'

const inputSchema = z.object({
  sessionId: z.string().describe('The session ID to fetch details for'),
  includeStreams: z.boolean().optional().describe('Include detailed stream analysis (peak powers, pacing). Default true for comprehensive analysis.'),
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

interface PeakPowers {
  peak_5s: number | null
  peak_30s: number | null
  peak_1min: number | null
  peak_5min: number | null
  peak_20min: number | null
}

interface PacingAnalysis {
  firstHalfAvgPower: number | null
  secondHalfAvgPower: number | null
  negativeSplit: boolean  // Second half harder than first
  splitDifferencePercent: number | null  // Positive = negative split
  variabilityIndex: number | null  // NP / Avg Power - how steady was pacing
  matchBurns: number  // Count of efforts >120% FTP lasting >10s
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
    // Enhanced metrics
    peakPowers?: PeakPowers
    pacing?: PacingAnalysis
  }
  analysis: {
    isHighIntensity: boolean
    isPolarized: boolean
    efficiencyFactor: number | null
    decoupling?: string | null
    isLikelyRace: boolean
    sessionType: 'race' | 'workout' | 'endurance' | 'recovery' | 'unknown'
    pacingAssessment?: string
  }
  source: 'local' | 'intervals_icu'
}

interface ErrorResponse {
  error: string
}

type Output = SessionResponse | ErrorResponse

/**
 * Calculate peak power for a given duration from power stream
 */
function calculatePeakPower(watts: number[], durationSeconds: number): number | null {
  if (!watts || watts.length < durationSeconds) return null

  let maxAvg = 0
  let windowSum = 0

  // Initialize window
  for (let i = 0; i < durationSeconds && i < watts.length; i++) {
    windowSum += watts[i] || 0
  }
  maxAvg = windowSum / durationSeconds

  // Slide window
  for (let i = durationSeconds; i < watts.length; i++) {
    windowSum = windowSum - (watts[i - durationSeconds] || 0) + (watts[i] || 0)
    const avg = windowSum / durationSeconds
    if (avg > maxAvg) maxAvg = avg
  }

  return Math.round(maxAvg)
}

/**
 * Analyze pacing from power stream
 */
function analyzePacing(watts: number[], ftp: number | null): PacingAnalysis {
  const validWatts = watts.filter(w => w > 0)
  if (validWatts.length < 10) {
    return {
      firstHalfAvgPower: null,
      secondHalfAvgPower: null,
      negativeSplit: false,
      splitDifferencePercent: null,
      variabilityIndex: null,
      matchBurns: 0,
    }
  }

  const mid = Math.floor(validWatts.length / 2)
  const firstHalf = validWatts.slice(0, mid)
  const secondHalf = validWatts.slice(mid)

  const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
  const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
  const overallAvg = validWatts.reduce((a, b) => a + b, 0) / validWatts.length

  // Calculate normalized power for VI
  const thirtySecondRolling: number[] = []
  for (let i = 29; i < validWatts.length; i++) {
    const windowAvg = validWatts.slice(i - 29, i + 1).reduce((a, b) => a + b, 0) / 30
    thirtySecondRolling.push(Math.pow(windowAvg, 4))
  }
  const np = thirtySecondRolling.length > 0
    ? Math.pow(thirtySecondRolling.reduce((a, b) => a + b, 0) / thirtySecondRolling.length, 0.25)
    : overallAvg

  const variabilityIndex = overallAvg > 0 ? np / overallAvg : null

  // Count match burns (>120% FTP for >10s)
  let matchBurns = 0
  if (ftp) {
    const threshold = ftp * 1.2
    let currentBurnLength = 0
    for (const w of validWatts) {
      if (w > threshold) {
        currentBurnLength++
      } else {
        if (currentBurnLength >= 10) matchBurns++
        currentBurnLength = 0
      }
    }
    if (currentBurnLength >= 10) matchBurns++
  }

  const splitDiff = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : null

  return {
    firstHalfAvgPower: Math.round(firstHalfAvg),
    secondHalfAvgPower: Math.round(secondHalfAvg),
    negativeSplit: secondHalfAvg > firstHalfAvg,
    splitDifferencePercent: splitDiff ? Math.round(splitDiff * 10) / 10 : null,
    variabilityIndex: variabilityIndex ? Math.round(variabilityIndex * 100) / 100 : null,
    matchBurns,
  }
}

/**
 * Determine session type based on metrics
 */
function determineSessionType(
  intensityFactor: number | null,
  tss: number | null,
  durationSeconds: number | null,
  name: string | null
): 'race' | 'workout' | 'endurance' | 'recovery' | 'unknown' {
  const nameLower = (name || '').toLowerCase()

  // Check name for race indicators
  if (nameLower.includes('race') || nameLower.includes('event') ||
      nameLower.includes('competition') || nameLower.includes('gran fondo') ||
      nameLower.includes('crit') || nameLower.includes('tt ')) {
    return 'race'
  }

  if (!intensityFactor) return 'unknown'

  // High IF = race or hard workout
  if (intensityFactor > 0.95) {
    // Long duration + very high IF = likely race
    if (durationSeconds && durationSeconds > 3600) return 'race'
    return 'workout'
  }

  if (intensityFactor > 0.85) return 'workout'
  if (intensityFactor > 0.65) return 'endurance'
  if (intensityFactor < 0.65) return 'recovery'

  return 'unknown'
}

/**
 * Helper to build response from session data (local DB)
 * Uses raw_data field if available for additional metrics
 */
function buildSessionResponse(session: Session): SessionResponse {
  const powerZones = session.power_zones ?? null
  const sessionType = determineSessionType(
    session.intensity_factor ?? null,
    session.tss ?? null,
    session.duration_seconds,
    session.workout_type ?? null
  )

  // Extract additional metrics from raw_data if available
  const raw = session.raw_data as Record<string, unknown> | null
  const avgCadence = raw?.average_cadence as number | undefined
  const elevationGain = raw?.total_elevation_gain as number | undefined
  const decoupling = raw?.decoupling as number | undefined
  const calories = raw?.calories as number | undefined
  const icuFtp = raw?.icu_ftp as number | undefined

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
      avg_cadence: avgCadence,
      elevation_gain: elevationGain,
      decoupling,
      calories,
    },
    analysis: {
      isHighIntensity: (session.intensity_factor || 0) > 0.85,
      isPolarized: powerZones
        ? (powerZones.z1 + powerZones.z2) > 70 || (powerZones.z5 + powerZones.z6) > 20
        : false,
      efficiencyFactor: session.normalized_power && session.avg_hr
        ? Math.round((session.normalized_power / session.avg_hr) * 100) / 100
        : null,
      decoupling: decoupling
        ? `${decoupling.toFixed(1)}% (${decoupling < 5 ? 'good aerobic fitness' : 'needs more base work'})`
        : null,
      isLikelyRace: sessionType === 'race',
      sessionType,
    },
    source: 'local',
    // Include FTP context if available for the AI
    ...(icuFtp ? { athleteFtp: icuFtp } : {}),
  }
}

export const getDetailedSession = defineTool<Input, Output>({
  description: `Fetch comprehensive data for a specific training session including power zones, peak powers, pacing analysis, and performance metrics.

Use this after finding a session with findSessions. Includes:
- Basic metrics (power, HR, TSS, IF)
- Peak powers (5s, 30s, 1min, 5min, 20min)
- Pacing analysis (splits, variability index, match burns)
- Session type classification (race, workout, endurance, recovery)`,
  inputSchema,
  execute: async ({ sessionId, includeStreams = true }, ctx) => {
    // Try local Supabase first if feature flag is enabled
    if (ctx.flags.useLocalData && ctx.athleteId) {
      try {
        const localSession = await getSession(sessionId)
        if (localSession) {
          const response = buildSessionResponse(localSession)

          // If streams requested and intervals.icu connected, fetch peak powers & pacing
          if (includeStreams && ctx.intervalsConnected && localSession.external_id) {
            try {
              const raw = localSession.raw_data as Record<string, unknown> | null
              const ftp = (raw?.icu_ftp as number) || null
              const streams = await ctx.intervalsClient.getActivityStreams(localSession.external_id, ['watts'])
              if (streams.watts && streams.watts.length > 0) {
                response.session.peakPowers = {
                  peak_5s: calculatePeakPower(streams.watts, 5),
                  peak_30s: calculatePeakPower(streams.watts, 30),
                  peak_1min: calculatePeakPower(streams.watts, 60),
                  peak_5min: calculatePeakPower(streams.watts, 300),
                  peak_20min: calculatePeakPower(streams.watts, 1200),
                }
                response.session.pacing = analyzePacing(streams.watts, ftp)

                // Add pacing assessment
                const pacing = response.session.pacing
                if (pacing) {
                  let pacingAssessment: string | undefined
                  if (pacing.variabilityIndex && pacing.variabilityIndex > 1.1) {
                    pacingAssessment = `Variable pacing (VI: ${pacing.variabilityIndex}) - power fluctuated significantly`
                  } else if (pacing.variabilityIndex && pacing.variabilityIndex < 1.02) {
                    pacingAssessment = `Very steady pacing (VI: ${pacing.variabilityIndex}) - excellent power control`
                  }
                  if (pacing.negativeSplit && pacing.splitDifferencePercent) {
                    pacingAssessment = (pacingAssessment ? pacingAssessment + '. ' : '') +
                      `Negative split (+${pacing.splitDifferencePercent}% second half) - strong finish`
                  } else if (!pacing.negativeSplit && pacing.splitDifferencePercent && pacing.splitDifferencePercent < -5) {
                    pacingAssessment = (pacingAssessment ? pacingAssessment + '. ' : '') +
                      `Positive split (${pacing.splitDifferencePercent}% fade) - started too hard`
                  }
                  if (pacing.matchBurns > 5) {
                    pacingAssessment = (pacingAssessment ? pacingAssessment + '. ' : '') +
                      `${pacing.matchBurns} match burns - high anaerobic cost`
                  }
                  response.analysis.pacingAssessment = pacingAssessment
                }
              }
            } catch {
              // Streams not available, continue without
            }
          }

          return response
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

      // Get FTP for analysis
      const ftp = activity.icu_ftp || null

      // Fetch streams for detailed analysis if requested
      let peakPowers: PeakPowers | undefined
      let pacing: PacingAnalysis | undefined

      if (includeStreams) {
        try {
          const streams = await ctx.intervalsClient.getActivityStreams(sessionId, ['watts'])
          if (streams.watts && streams.watts.length > 0) {
            peakPowers = {
              peak_5s: calculatePeakPower(streams.watts, 5),
              peak_30s: calculatePeakPower(streams.watts, 30),
              peak_1min: calculatePeakPower(streams.watts, 60),
              peak_5min: calculatePeakPower(streams.watts, 300),
              peak_20min: calculatePeakPower(streams.watts, 1200),
            }
            pacing = analyzePacing(streams.watts, ftp)
          }
        } catch {
          // Streams not available, continue without
        }
      }

      const normalizedPower = getNormalizedPower(activity)
      const avgPower = getAveragePower(activity)
      const sessionType = determineSessionType(
        activity.icu_intensity,
        activity.icu_training_load,
        activity.moving_time,
        activity.name
      )

      const session = {
        id: activity.id,
        date: activity.start_date_local,
        name: activity.name,
        type: activity.type,
        duration_seconds: activity.moving_time,
        distance_meters: activity.distance,
        tss: activity.icu_training_load,
        intensity_factor: activity.icu_intensity,
        normalized_power: normalizedPower,
        avg_power: avgPower,
        max_power: activity.max_watts,
        avg_hr: activity.average_heartrate,
        max_hr: activity.max_heartrate,
        avg_cadence: activity.average_cadence,
        elevation_gain: activity.total_elevation_gain,
        power_zones: powerZones,
        decoupling: activity.decoupling,
        calories: activity.calories,
        peakPowers,
        pacing,
      }

      // Generate pacing assessment
      let pacingAssessment: string | undefined
      if (pacing) {
        if (pacing.variabilityIndex && pacing.variabilityIndex > 1.1) {
          pacingAssessment = `Variable pacing (VI: ${pacing.variabilityIndex}) - power fluctuated significantly`
        } else if (pacing.variabilityIndex && pacing.variabilityIndex < 1.02) {
          pacingAssessment = `Very steady pacing (VI: ${pacing.variabilityIndex}) - excellent power control`
        }

        if (pacing.negativeSplit && pacing.splitDifferencePercent) {
          pacingAssessment = (pacingAssessment ? pacingAssessment + '. ' : '') +
            `Negative split (+${pacing.splitDifferencePercent}% second half) - strong finish`
        } else if (!pacing.negativeSplit && pacing.splitDifferencePercent && pacing.splitDifferencePercent < -5) {
          pacingAssessment = (pacingAssessment ? pacingAssessment + '. ' : '') +
            `Positive split (${pacing.splitDifferencePercent}% fade) - started too hard`
        }

        if (pacing.matchBurns > 5) {
          pacingAssessment = (pacingAssessment ? pacingAssessment + '. ' : '') +
            `${pacing.matchBurns} match burns - high anaerobic cost`
        }
      }

      return {
        session,
        analysis: {
          isHighIntensity: (activity.icu_intensity || 0) > 0.85,
          isPolarized: powerZones
            ? (powerZones.z1 + powerZones.z2) > 70 || (powerZones.z5 + powerZones.z6) > 20
            : false,
          efficiencyFactor: normalizedPower && session.avg_hr
            ? Math.round((normalizedPower / session.avg_hr) * 100) / 100
            : null,
          decoupling: activity.decoupling
            ? `${activity.decoupling.toFixed(1)}% (${activity.decoupling < 5 ? 'good aerobic fitness' : 'needs more base work'})`
            : null,
          isLikelyRace: sessionType === 'race',
          sessionType,
          pacingAssessment,
        },
        source: 'intervals_icu',
      }
    } catch (error) {
      return { error: `Failed to fetch session: ${error instanceof Error ? error.message : 'Unknown error'}` }
    }
  },
})
