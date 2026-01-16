import { z } from 'zod'
import { defineTool } from './types'
import { getFitnessHistory } from '@/lib/db/fitness'
import { getSessions } from '@/lib/db/sessions'
import { getDateRange } from '@/lib/intervals-icu'
import type { Session } from '@/types'

const inputSchema = z.object({
  chartType: z.enum(['line', 'bar', 'area']).describe('Type of chart: line for trends, bar for comparisons, area for cumulative data'),
  title: z.string().describe('Short title for the chart'),
  dataType: z.enum(['fitness_trend', 'weekly_tss', 'power_zones', 'training_load', 'custom']).describe('What data to visualize'),
  period: z.enum(['7d', '14d', '30d', '90d']).optional().describe('Time period for trend data'),
  customData: z.array(z.object({
    label: z.string(),
    value: z.number(),
    category: z.string().optional(),
  })).optional().describe('Custom data points if dataType is "custom"'),
})

type Input = z.infer<typeof inputSchema>

interface ChartDataPoint {
  name: string
  [key: string]: string | number | undefined
}

interface ChartResponse {
  chartType: 'line' | 'bar' | 'area'
  title: string
  data: ChartDataPoint[]
  dataKeys: string[]
  colors: string[]
  useFillFromData?: boolean
}

interface ErrorResponse {
  error: string
}

type Output = ChartResponse | ErrorResponse

const PERIOD_DAYS: Record<string, number> = {
  '7d': 7,
  '14d': 14,
  '30d': 30,
  '90d': 90,
}

export const generateChart = defineTool<Input, Output>({
  description: 'Generate a chart to visualize training data. Use this when data would be better understood visually - trends over time, comparisons, distributions, etc.',
  inputSchema,
  execute: async ({ chartType, title, dataType, period = '30d', customData }, ctx) => {
    const periodDays = PERIOD_DAYS[period]

    // Generate data based on type
    if (dataType === 'custom' && customData) {
      return {
        chartType,
        title,
        data: customData.map(d => ({ name: d.label, value: d.value, category: d.category })),
        dataKeys: ['value'],
        colors: ['hsl(var(--primary))'],
      }
    }

    if (dataType === 'fitness_trend') {
      // Get fitness history
      let fitnessData: Array<{ date: string; ctl: number; atl: number; tsb: number }> = []

      if (ctx.flags.useLocalData && ctx.athleteId) {
        try {
          const history = await getFitnessHistory(ctx.athleteId, periodDays)
          fitnessData = history.map(h => ({
            date: h.date,
            ctl: Math.round(h.ctl),
            atl: Math.round(h.atl),
            tsb: Math.round(h.tsb),
          }))
        } catch {
          // Fall through
        }
      }

      if (fitnessData.length === 0 && ctx.intervalsConnected) {
        try {
          const { oldest, newest } = getDateRange(periodDays)
          const wellness = await ctx.intervalsClient.getWellness(oldest, newest)
          fitnessData = wellness.map((w: { id: string; ctl: number; atl: number }) => ({
            date: w.id,
            ctl: Math.round(w.ctl),
            atl: Math.round(w.atl),
            tsb: Math.round(w.ctl - w.atl),
          }))
        } catch {
          // Use empty
        }
      }

      // Sample data if too many points
      const maxPoints = 30
      if (fitnessData.length > maxPoints) {
        const step = Math.ceil(fitnessData.length / maxPoints)
        fitnessData = fitnessData.filter((_, i) => i % step === 0)
      }

      return {
        chartType: 'line',
        title,
        data: fitnessData.map(d => ({
          name: d.date.slice(5), // MM-DD format
          CTL: d.ctl,
          ATL: d.atl,
          TSB: d.tsb,
        })),
        dataKeys: ['CTL', 'ATL', 'TSB'],
        colors: ['hsl(142, 76%, 36%)', 'hsl(0, 84%, 60%)', 'hsl(221, 83%, 53%)'],
      }
    }

    if (dataType === 'weekly_tss' || dataType === 'training_load') {
      // Get sessions and aggregate by week
      let sessions: Session[] = []

      if (ctx.flags.useLocalData && ctx.athleteId) {
        try {
          const endDate = new Date()
          const startDateObj = new Date()
          startDateObj.setDate(startDateObj.getDate() - periodDays)
          sessions = await getSessions(ctx.athleteId, {
            startDate: startDateObj.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            limit: 200,
          })
        } catch {
          // Fall through
        }
      }

      if (sessions.length === 0 && ctx.intervalsConnected) {
        try {
          const { oldest, newest } = getDateRange(periodDays)
          const activities = await ctx.intervalsClient.getActivities(oldest, newest)
          sessions = activities.map((a: { id: string; start_date_local: string; icu_training_load: number; moving_time: number }) => ({
            id: a.id,
            date: a.start_date_local?.split('T')[0] || '',
            tss: a.icu_training_load || 0,
            duration_seconds: a.moving_time || 0,
          })) as Session[]
        } catch {
          // Use empty
        }
      }

      // Aggregate by week
      const weeklyData: Record<string, { tss: number; hours: number; count: number }> = {}
      sessions.forEach(s => {
        const date = new Date(s.date)
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        const weekKey = weekStart.toISOString().split('T')[0]
        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = { tss: 0, hours: 0, count: 0 }
        }
        weeklyData[weekKey].tss += s.tss || 0
        weeklyData[weekKey].hours += (s.duration_seconds || 0) / 3600
        weeklyData[weekKey].count += 1
      })

      const data = Object.entries(weeklyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([week, stats]) => ({
          name: week.slice(5), // MM-DD
          TSS: Math.round(stats.tss),
          Hours: Math.round(stats.hours * 10) / 10,
        }))

      return {
        chartType: 'bar',
        title,
        data,
        dataKeys: dataType === 'weekly_tss' ? ['TSS'] : ['TSS', 'Hours'],
        colors: ['hsl(var(--primary))', 'hsl(var(--muted-foreground))'],
      }
    }

    if (dataType === 'power_zones') {
      // Try to get zone distribution from recent sessions
      let zoneData = { z1: 20, z2: 35, z3: 20, z4: 15, z5: 7, z6: 3 } // defaults

      if (ctx.flags.useLocalData && ctx.athleteId) {
        try {
          const startDateObj = new Date()
          startDateObj.setDate(startDateObj.getDate() - periodDays)
          const sessions = await getSessions(ctx.athleteId, {
            startDate: startDateObj.toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
            limit: 200,
          })
          const totals = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, z6: 0 }
          let count = 0
          sessions.forEach(s => {
            if (s.power_zones) {
              totals.z1 += s.power_zones.z1 || 0
              totals.z2 += s.power_zones.z2 || 0
              totals.z3 += s.power_zones.z3 || 0
              totals.z4 += s.power_zones.z4 || 0
              totals.z5 += s.power_zones.z5 || 0
              totals.z6 += s.power_zones.z6 || 0
              count++
            }
          })
          if (count > 0) {
            zoneData = {
              z1: Math.round(totals.z1 / count),
              z2: Math.round(totals.z2 / count),
              z3: Math.round(totals.z3 / count),
              z4: Math.round(totals.z4 / count),
              z5: Math.round(totals.z5 / count),
              z6: Math.round(totals.z6 / count),
            }
          }
        } catch {
          // Use defaults
        }
      }

      return {
        chartType: 'bar',
        title,
        data: [
          { name: 'Z1', value: zoneData.z1, fill: 'hsl(142, 76%, 60%)' },
          { name: 'Z2', value: zoneData.z2, fill: 'hsl(142, 76%, 45%)' },
          { name: 'Z3', value: zoneData.z3, fill: 'hsl(47, 100%, 50%)' },
          { name: 'Z4', value: zoneData.z4, fill: 'hsl(25, 95%, 53%)' },
          { name: 'Z5', value: zoneData.z5, fill: 'hsl(0, 84%, 60%)' },
          { name: 'Z6', value: zoneData.z6, fill: 'hsl(0, 84%, 45%)' },
        ],
        dataKeys: ['value'],
        colors: [],
        useFillFromData: true,
      }
    }

    return { error: 'Unknown chart data type' }
  },
})
