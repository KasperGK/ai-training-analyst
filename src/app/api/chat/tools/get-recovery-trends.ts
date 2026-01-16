import { z } from 'zod'
import { defineTool } from './types'
import { getFitnessHistory } from '@/lib/db/fitness'
import { getDateRange } from '@/lib/intervals-icu'

const inputSchema = z.object({
  days: z.number().optional().describe('Number of days to analyze (default 30, max 90)'),
})

type Input = z.infer<typeof inputSchema>

interface Averages {
  sleepHours: number | null
  hrv: number | null
  restingHr: number | null
}

interface Trends {
  sleepTrend: 'improving' | 'declining' | 'stable' | null
  hrvTrend: 'improving' | 'declining' | 'stable' | null
  restingHrTrend: 'improving' | 'elevated' | 'stable' | null
}

interface RecoveryResponse {
  period: string
  dataPoints: number
  averages: Averages
  recent7DayAverages: Averages
  trends: Trends
  source: 'local' | 'intervals_icu'
}

interface NoDataResponse {
  message: string
}

interface ErrorResponse {
  error: string
}

type Output = RecoveryResponse | NoDataResponse | ErrorResponse

function calculateTrend(
  overallAvg: number | null,
  recentAvg: number | null,
  type: 'higher_is_better' | 'lower_is_better'
): 'improving' | 'declining' | 'stable' | 'elevated' | null {
  if (overallAvg === null || recentAvg === null) return null
  if (Math.abs(recentAvg - overallAvg) < 0.5) return 'stable'

  if (type === 'higher_is_better') {
    return recentAvg > overallAvg ? 'improving' : 'declining'
  } else {
    return recentAvg < overallAvg ? 'improving' : 'elevated'
  }
}

export const getRecoveryTrends = defineTool<Input, Output>({
  description: 'Get sleep, HRV, and resting HR trends over a time period. Use when analyzing recovery patterns, correlating recovery with performance, or understanding how sleep affects training.',
  inputSchema,
  execute: async ({ days = 30 }, ctx) => {
    const lookbackDays = Math.min(days, 90)

    // Try local Supabase first
    if (ctx.flags.useLocalData && ctx.athleteId) {
      try {
        const history = await getFitnessHistory(ctx.athleteId, lookbackDays)
        if (history.length > 0) {
          // Calculate averages
          const sleepData = history.filter(h => h.sleep_seconds && h.sleep_seconds > 0)
          const hrvData = history.filter(h => h.hrv && h.hrv > 0)
          const hrData = history.filter(h => h.resting_hr && h.resting_hr > 0)

          const avgSleep = sleepData.length > 0
            ? Math.round(sleepData.reduce((sum, h) => sum + (h.sleep_seconds || 0), 0) / sleepData.length / 3600 * 10) / 10
            : null
          const avgHrv = hrvData.length > 0
            ? Math.round(hrvData.reduce((sum, h) => sum + (h.hrv || 0), 0) / hrvData.length)
            : null
          const avgRestingHr = hrData.length > 0
            ? Math.round(hrData.reduce((sum, h) => sum + (h.resting_hr || 0), 0) / hrData.length)
            : null

          // Get recent 7-day averages for comparison
          const recent7 = history.slice(-7)
          const recent7Sleep = recent7.filter(h => h.sleep_seconds && h.sleep_seconds > 0)
          const recent7Hrv = recent7.filter(h => h.hrv && h.hrv > 0)
          const recent7Hr = recent7.filter(h => h.resting_hr && h.resting_hr > 0)

          const recent7AvgSleep = recent7Sleep.length > 0
            ? Math.round(recent7Sleep.reduce((sum, h) => sum + (h.sleep_seconds || 0), 0) / recent7Sleep.length / 3600 * 10) / 10
            : null
          const recent7AvgHrv = recent7Hrv.length > 0
            ? Math.round(recent7Hrv.reduce((sum, h) => sum + (h.hrv || 0), 0) / recent7Hrv.length)
            : null
          const recent7AvgHr = recent7Hr.length > 0
            ? Math.round(recent7Hr.reduce((sum, h) => sum + (h.resting_hr || 0), 0) / recent7Hr.length)
            : null

          return {
            period: `${lookbackDays} days`,
            dataPoints: history.length,
            averages: {
              sleepHours: avgSleep,
              hrv: avgHrv,
              restingHr: avgRestingHr,
            },
            recent7DayAverages: {
              sleepHours: recent7AvgSleep,
              hrv: recent7AvgHrv,
              restingHr: recent7AvgHr,
            },
            trends: {
              sleepTrend: calculateTrend(avgSleep, recent7AvgSleep, 'higher_is_better') as 'improving' | 'declining' | 'stable' | null,
              hrvTrend: calculateTrend(avgHrv, recent7AvgHrv, 'higher_is_better') as 'improving' | 'declining' | 'stable' | null,
              restingHrTrend: calculateTrend(avgRestingHr, recent7AvgHr, 'lower_is_better') as 'improving' | 'elevated' | 'stable' | null,
            },
            source: 'local',
          }
        }
      } catch {
        // Fall through to intervals.icu
      }
    }

    // Fall back to intervals.icu
    if (!ctx.intervalsConnected) {
      return { error: 'intervals.icu not connected. Cannot fetch recovery data.' }
    }

    try {
      const { oldest, newest } = getDateRange(lookbackDays)
      const wellness = await ctx.intervalsClient.getWellness(oldest, newest)

      if (wellness.length === 0) {
        return { message: 'No recovery data found for this period' }
      }

      // Calculate averages
      const sleepData = wellness.filter((w: { sleepSecs?: number }) => w.sleepSecs && w.sleepSecs > 0)
      const hrvData = wellness.filter((w: { hrv?: number }) => w.hrv && w.hrv > 0)
      const hrData = wellness.filter((w: { restingHR?: number }) => w.restingHR && w.restingHR > 0)

      const avgSleep = sleepData.length > 0
        ? Math.round(sleepData.reduce((sum: number, w: { sleepSecs?: number }) => sum + (w.sleepSecs || 0), 0) / sleepData.length / 3600 * 10) / 10
        : null
      const avgHrv = hrvData.length > 0
        ? Math.round(hrvData.reduce((sum: number, w: { hrv?: number }) => sum + (w.hrv || 0), 0) / hrvData.length)
        : null
      const avgRestingHr = hrData.length > 0
        ? Math.round(hrData.reduce((sum: number, w: { restingHR?: number }) => sum + (w.restingHR || 0), 0) / hrData.length)
        : null

      // Get recent 7-day averages
      const recent7 = wellness.slice(-7)
      const recent7Sleep = recent7.filter((w: { sleepSecs?: number }) => w.sleepSecs && w.sleepSecs > 0)
      const recent7Hrv = recent7.filter((w: { hrv?: number }) => w.hrv && w.hrv > 0)
      const recent7Hr = recent7.filter((w: { restingHR?: number }) => w.restingHR && w.restingHR > 0)

      const recent7AvgSleep = recent7Sleep.length > 0
        ? Math.round(recent7Sleep.reduce((sum: number, w: { sleepSecs?: number }) => sum + (w.sleepSecs || 0), 0) / recent7Sleep.length / 3600 * 10) / 10
        : null
      const recent7AvgHrv = recent7Hrv.length > 0
        ? Math.round(recent7Hrv.reduce((sum: number, w: { hrv?: number }) => sum + (w.hrv || 0), 0) / recent7Hrv.length)
        : null
      const recent7AvgHr = recent7Hr.length > 0
        ? Math.round(recent7Hr.reduce((sum: number, w: { restingHR?: number }) => sum + (w.restingHR || 0), 0) / recent7Hr.length)
        : null

      return {
        period: `${lookbackDays} days`,
        dataPoints: wellness.length,
        averages: {
          sleepHours: avgSleep,
          hrv: avgHrv,
          restingHr: avgRestingHr,
        },
        recent7DayAverages: {
          sleepHours: recent7AvgSleep,
          hrv: recent7AvgHrv,
          restingHr: recent7AvgHr,
        },
        trends: {
          sleepTrend: calculateTrend(avgSleep, recent7AvgSleep, 'higher_is_better') as 'improving' | 'declining' | 'stable' | null,
          hrvTrend: calculateTrend(avgHrv, recent7AvgHrv, 'higher_is_better') as 'improving' | 'declining' | 'stable' | null,
          restingHrTrend: calculateTrend(avgRestingHr, recent7AvgHr, 'lower_is_better') as 'improving' | 'elevated' | 'stable' | null,
        },
        source: 'intervals_icu',
      }
    } catch (error) {
      return { error: `Failed to fetch recovery trends: ${error instanceof Error ? error.message : 'Unknown error'}` }
    }
  },
})
