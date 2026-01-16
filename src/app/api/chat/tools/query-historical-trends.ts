import { z } from 'zod'
import { defineTool } from './types'
import { getSessions } from '@/lib/db/sessions'
import { getFitnessHistory } from '@/lib/db/fitness'
import { getDateRange, formatDateForApi } from '@/lib/intervals-icu'

const inputSchema = z.object({
  metric: z.enum(['tss', 'duration', 'intensity', 'fitness', 'volume']).describe('The metric to analyze'),
  period: z.enum(['week', 'month', '3months', '6months', 'year']).describe('Time period to analyze'),
})

type Input = z.infer<typeof inputSchema>

interface FitnessData {
  startCTL: number
  endCTL: number
  ctlChange: number
  avgTSB: number
  currentATL: number
  currentTSB: number
}

interface IntensityDistribution {
  low: number
  medium: number
  high: number
}

interface TrendsResponse {
  period: string
  sessionCount: number
  totalTSS: number
  avgTSSPerSession: number
  totalHours: number
  avgHoursPerSession: number
  avgIntensityFactor: number
  sessionsPerWeek: number
  fitnessData: FitnessData | null
  intensityDistribution: IntensityDistribution | null
  source: 'local' | 'intervals_icu'
}

interface NoDataResponse {
  message: string
}

interface ErrorResponse {
  error: string
}

type Output = TrendsResponse | NoDataResponse | ErrorResponse

const DAYS_MAP: Record<string, number> = {
  week: 7,
  month: 30,
  '3months': 90,
  '6months': 180,
  year: 365,
}

export const queryHistoricalTrends = defineTool<Input, Output>({
  description: 'Analyze training patterns and trends over a time period. Use for questions about training volume, intensity distribution, fitness progression, or comparing time periods.',
  inputSchema,
  execute: async ({ metric, period }, ctx) => {
    const days = DAYS_MAP[period]
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = formatDateForApi(startDate)

    // Try local Supabase first if feature flag is enabled
    if (ctx.flags.useLocalData && ctx.athleteId) {
      try {
        const [localSessions, localFitness] = await Promise.all([
          getSessions(ctx.athleteId, { startDate: startDateStr, limit: 200 }),
          metric === 'fitness' ? getFitnessHistory(ctx.athleteId, days) : Promise.resolve([]),
        ])

        if (localSessions.length > 0) {
          // Calculate statistics from local data
          const totalTSS = localSessions.reduce((sum, s) => sum + (s.tss || 0), 0)
          const totalDuration = localSessions.reduce((sum, s) => sum + s.duration_seconds, 0)
          const sessionsWithIF = localSessions.filter(s => s.intensity_factor)
          const avgIF = sessionsWithIF.length > 0
            ? sessionsWithIF.reduce((sum, s) => sum + (s.intensity_factor || 0), 0) / sessionsWithIF.length
            : 0

          // Get fitness trend if requested
          let fitnessData: FitnessData | null = null
          if (metric === 'fitness' && localFitness.length > 0) {
            const first = localFitness[0]
            const last = localFitness[localFitness.length - 1]
            const avgTSB = localFitness.reduce((sum, f) => sum + f.tsb, 0) / localFitness.length
            fitnessData = {
              startCTL: Math.round(first.ctl),
              endCTL: Math.round(last.ctl),
              ctlChange: Math.round((last.ctl - first.ctl) * 10) / 10,
              avgTSB: Math.round(avgTSB),
              currentATL: Math.round(last.atl),
              currentTSB: Math.round(last.tsb),
            }
          }

          // Calculate intensity distribution
          let intensityDistribution: IntensityDistribution | null = null
          if (metric === 'intensity') {
            const lowIntensity = localSessions.filter(s => (s.intensity_factor || 0) < 0.75).length
            const medIntensity = localSessions.filter(s => (s.intensity_factor || 0) >= 0.75 && (s.intensity_factor || 0) < 0.90).length
            const highIntensity = localSessions.filter(s => (s.intensity_factor || 0) >= 0.90).length
            intensityDistribution = {
              low: Math.round(lowIntensity / localSessions.length * 100),
              medium: Math.round(medIntensity / localSessions.length * 100),
              high: Math.round(highIntensity / localSessions.length * 100),
            }
          }

          return {
            period,
            sessionCount: localSessions.length,
            totalTSS: Math.round(totalTSS),
            avgTSSPerSession: Math.round(totalTSS / localSessions.length),
            totalHours: Math.round(totalDuration / 3600 * 10) / 10,
            avgHoursPerSession: Math.round(totalDuration / localSessions.length / 3600 * 10) / 10,
            avgIntensityFactor: Math.round(avgIF * 100) / 100,
            sessionsPerWeek: Math.round(localSessions.length / (days / 7) * 10) / 10,
            fitnessData,
            intensityDistribution,
            source: 'local',
          }
        }
      } catch {
        // Fall through to intervals.icu
      }
    }

    // Fall back to intervals.icu
    if (!ctx.intervalsConnected) {
      return { error: 'intervals.icu not connected. Please connect your account in Settings.' }
    }

    const { oldest, newest } = getDateRange(days)

    try {
      // Fetch activities and wellness data from intervals.icu
      const [activities, wellness] = await Promise.all([
        ctx.intervalsClient.getActivities(oldest, newest),
        metric === 'fitness' ? ctx.intervalsClient.getWellness(oldest, newest) : Promise.resolve([]),
      ])

      // Filter out STRAVA activities (same as dashboard)
      const sessions = activities.filter((a: { source?: string; type?: string; moving_time?: number }) =>
        a.source !== 'STRAVA' && a.type && a.moving_time
      )

      if (sessions.length === 0) {
        return { message: 'No training data found for this period' }
      }

      // Calculate statistics
      const totalTSS = sessions.reduce((sum: number, s: { icu_training_load?: number }) => sum + (s.icu_training_load || 0), 0)
      const totalDuration = sessions.reduce((sum: number, s: { moving_time?: number }) => sum + (s.moving_time || 0), 0)
      const sessionsWithIF = sessions.filter((s: { icu_intensity?: number }) => s.icu_intensity)
      const avgIF = sessionsWithIF.length > 0
        ? sessionsWithIF.reduce((sum: number, s: { icu_intensity?: number }) => sum + (s.icu_intensity || 0), 0) / sessionsWithIF.length
        : 0

      // Get fitness trend if requested
      let fitnessData: FitnessData | null = null
      if (metric === 'fitness' && wellness.length > 0) {
        const first = wellness[0]
        const last = wellness[wellness.length - 1]
        const avgTSB = wellness.reduce((sum: number, w: { ctl: number; atl: number }) => sum + (w.ctl - w.atl), 0) / wellness.length
        fitnessData = {
          startCTL: Math.round(first.ctl),
          endCTL: Math.round(last.ctl),
          ctlChange: Math.round((last.ctl - first.ctl) * 10) / 10,
          avgTSB: Math.round(avgTSB),
          currentATL: Math.round(last.atl),
          currentTSB: Math.round(last.ctl - last.atl),
        }
      }

      // Calculate intensity distribution
      let intensityDistribution: IntensityDistribution | null = null
      if (metric === 'intensity') {
        const lowIntensity = sessions.filter((s: { icu_intensity?: number }) => (s.icu_intensity || 0) < 0.75).length
        const medIntensity = sessions.filter((s: { icu_intensity?: number }) => (s.icu_intensity || 0) >= 0.75 && (s.icu_intensity || 0) < 0.90).length
        const highIntensity = sessions.filter((s: { icu_intensity?: number }) => (s.icu_intensity || 0) >= 0.90).length
        intensityDistribution = {
          low: Math.round(lowIntensity / sessions.length * 100),
          medium: Math.round(medIntensity / sessions.length * 100),
          high: Math.round(highIntensity / sessions.length * 100),
        }
      }

      return {
        period,
        sessionCount: sessions.length,
        totalTSS: Math.round(totalTSS),
        avgTSSPerSession: Math.round(totalTSS / sessions.length),
        totalHours: Math.round(totalDuration / 3600 * 10) / 10,
        avgHoursPerSession: Math.round(totalDuration / sessions.length / 3600 * 10) / 10,
        avgIntensityFactor: Math.round(avgIF * 100) / 100,
        sessionsPerWeek: Math.round(sessions.length / (days / 7) * 10) / 10,
        fitnessData,
        intensityDistribution,
        source: 'intervals_icu',
      }
    } catch (error) {
      return { error: `Failed to fetch trends: ${error instanceof Error ? error.message : 'Unknown error'}` }
    }
  },
})
