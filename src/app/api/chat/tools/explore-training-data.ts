/**
 * Exploratory Training Data Tool
 *
 * Gives the AI flexible access to raw training data so it can discover
 * patterns that weren't explicitly coded in deterministic algorithms.
 *
 * This enables emergent insights like:
 * - "You perform worse after travel"
 * - "Your power drops in hot weather"
 * - "Threshold work improves when preceded by strength training"
 */

import { z } from 'zod'
import { defineTool } from './types'
import { getSessions } from '@/lib/db/sessions'
import { getFitnessHistory } from '@/lib/db/fitness'
import { getRaceResults } from '@/lib/db/race-results'
import { getWorkoutOutcomes } from '@/lib/db/workout-outcomes'
import { getMemories } from '@/lib/personalization/athlete-memory'

const exploreTrainingDataInputSchema = z.object({
  period: z.enum(['30d', '60d', '90d', '180d', '365d']).optional()
    .describe('Time period to analyze (default: 90d)'),
  focus: z.enum(['all', 'performance', 'recovery', 'racing', 'consistency']).optional()
    .describe('What aspect to focus on - affects which data is included'),
  includeRaw: z.boolean().optional()
    .describe('Include more granular session data (default: false, uses weekly summaries)'),
  question: z.string().optional()
    .describe('Specific question or hypothesis to investigate'),
})

type ExploreTrainingDataInput = z.infer<typeof exploreTrainingDataInputSchema>

interface WeeklySummary {
  weekStart: string
  sessions: number
  totalHours: number
  totalTSS: number
  avgPower: number | null
  avgHR: number | null
  avgIF: number | null
  hardSessions: number
  easySessions: number
  restDays: number
  endCTL: number | null
  endATL: number | null
  endTSB: number | null
  workoutTypes: Record<string, number>
  dayDistribution: Record<string, number>
}

interface SessionDetail {
  date: string
  dayOfWeek: string
  type: string
  name: string
  durationMin: number
  tss: number | null
  avgPower: number | null
  normalizedPower: number | null
  avgHR: number | null
  maxHR: number | null
  intensityFactor: number | null
  ctl: number | null
  atl: number | null
  tsb: number | null
  daysSinceLastHard: number | null
}

interface RaceSummary {
  date: string
  name: string
  category: string | null
  placement: number | null
  totalInCategory: number | null
  percentile: number | null
  avgPower: number | null
  tsbAtRace: number | null
  ctlAtRace: number | null
}

export const exploreTrainingData = defineTool<ExploreTrainingDataInput, unknown>({
  description: `Get raw training data for exploratory analysis. Use this when you want to discover patterns that might not be captured by standard analysis tools. You can look for correlations, anomalies, and insights that emerge from examining the actual data. This is useful for answering questions like "Is there a pattern I'm missing?" or investigating specific hypotheses.`,

  inputSchema: exploreTrainingDataInputSchema,

  execute: async ({ period = '90d', focus = 'all', includeRaw = false, question }, ctx) => {
    if (!ctx.athleteId) {
      return { error: 'Athlete not authenticated' }
    }

    // Calculate date range
    const days = { '30d': 30, '60d': 60, '90d': 90, '180d': 180, '365d': 365 }[period]
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString().split('T')[0]

    // Fetch all relevant data in parallel
    const [sessions, fitnessHistory, raceResults, outcomes, memories] = await Promise.all([
      getSessions(ctx.athleteId, { startDate: startDateStr, limit: 500 }),
      getFitnessHistory(ctx.athleteId, days),
      focus === 'all' || focus === 'racing'
        ? getRaceResults(ctx.athleteId, { startDate: startDateStr, limit: 100 })
        : Promise.resolve([]),
      focus === 'all' || focus === 'performance'
        ? getWorkoutOutcomes(ctx.athleteId, { limit: 100 })
        : Promise.resolve([]),
      getMemories(ctx.athleteId, { limit: 50 }),
    ])

    if (sessions.length === 0) {
      return {
        error: 'No training data found for this period',
        suggestion: 'Try a longer time period or sync more data from intervals.icu',
      }
    }

    // Build fitness lookup map
    const fitnessMap = new Map(
      fitnessHistory.map(f => [f.date.split('T')[0], f])
    )

    // Process sessions
    const getDayOfWeek = (date: string) => {
      const d = new Date(date)
      return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()]
    }

    const isHardSession = (s: typeof sessions[0]) =>
      (s.intensity_factor && s.intensity_factor > 0.85) ||
      (s.tss && s.tss > 80)

    // Calculate days since last hard session for each session
    const sortedSessions = [...sessions].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    let lastHardDate: Date | null = null
    const sessionsWithContext: SessionDetail[] = sortedSessions.map(s => {
      const sessionDate = new Date(s.date)
      const dateStr = sessionDate.toISOString().split('T')[0]
      const fitness = fitnessMap.get(dateStr)

      const daysSinceLastHard = lastHardDate
        ? Math.floor((sessionDate.getTime() - lastHardDate.getTime()) / (1000 * 60 * 60 * 24))
        : null

      if (isHardSession(s)) {
        lastHardDate = sessionDate
      }

      return {
        date: dateStr,
        dayOfWeek: getDayOfWeek(dateStr),
        type: s.workout_type || s.sport || 'unknown',
        name: s.workout_type || '',
        durationMin: Math.round((s.duration_seconds || 0) / 60),
        tss: s.tss ? Math.round(s.tss) : null,
        avgPower: s.avg_power ? Math.round(s.avg_power) : null,
        normalizedPower: s.normalized_power ? Math.round(s.normalized_power) : null,
        avgHR: s.avg_hr ? Math.round(s.avg_hr) : null,
        maxHR: s.max_hr ? Math.round(s.max_hr) : null,
        intensityFactor: s.intensity_factor ? Math.round(s.intensity_factor * 100) / 100 : null,
        ctl: fitness?.ctl ? Math.round(fitness.ctl) : null,
        atl: fitness?.atl ? Math.round(fitness.atl) : null,
        tsb: fitness ? Math.round(fitness.ctl - fitness.atl) : null,
        daysSinceLastHard,
      }
    })

    // Generate weekly summaries
    const weeklyData: Map<string, typeof sessionsWithContext> = new Map()
    sessionsWithContext.forEach(s => {
      const weekStart = getWeekStart(s.date)
      if (!weeklyData.has(weekStart)) {
        weeklyData.set(weekStart, [])
      }
      weeklyData.get(weekStart)!.push(s)
    })

    const weeklySummaries: WeeklySummary[] = Array.from(weeklyData.entries())
      .map(([weekStart, weekSessions]) => {
        const lastSession = weekSessions[weekSessions.length - 1]
        const workoutTypes: Record<string, number> = {}
        const dayDistribution: Record<string, number> = {}

        weekSessions.forEach(s => {
          workoutTypes[s.type] = (workoutTypes[s.type] || 0) + 1
          dayDistribution[s.dayOfWeek] = (dayDistribution[s.dayOfWeek] || 0) + 1
        })

        const sessionsWithPower = weekSessions.filter(s => s.avgPower)
        const sessionsWithHR = weekSessions.filter(s => s.avgHR)
        const sessionsWithIF = weekSessions.filter(s => s.intensityFactor)

        return {
          weekStart,
          sessions: weekSessions.length,
          totalHours: Math.round(weekSessions.reduce((sum, s) => sum + s.durationMin, 0) / 60 * 10) / 10,
          totalTSS: weekSessions.reduce((sum, s) => sum + (s.tss || 0), 0),
          avgPower: sessionsWithPower.length > 0
            ? Math.round(sessionsWithPower.reduce((sum, s) => sum + s.avgPower!, 0) / sessionsWithPower.length)
            : null,
          avgHR: sessionsWithHR.length > 0
            ? Math.round(sessionsWithHR.reduce((sum, s) => sum + s.avgHR!, 0) / sessionsWithHR.length)
            : null,
          avgIF: sessionsWithIF.length > 0
            ? Math.round(sessionsWithIF.reduce((sum, s) => sum + s.intensityFactor!, 0) / sessionsWithIF.length * 100) / 100
            : null,
          hardSessions: weekSessions.filter(s => s.intensityFactor && s.intensityFactor > 0.85).length,
          easySessions: weekSessions.filter(s => s.intensityFactor && s.intensityFactor < 0.75).length,
          restDays: 7 - new Set(weekSessions.map(s => s.dayOfWeek)).size,
          endCTL: lastSession.ctl,
          endATL: lastSession.atl,
          endTSB: lastSession.tsb,
          workoutTypes,
          dayDistribution,
        }
      })
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart))

    // Process race results
    const raceSummaries: RaceSummary[] = raceResults.map(r => ({
      date: typeof r.race_date === 'string' ? r.race_date.split('T')[0] : r.race_date,
      name: r.race_name,
      category: r.category ?? null,
      placement: r.placement ?? null,
      totalInCategory: r.total_in_category ?? null,
      percentile: r.placement && r.total_in_category
        ? Math.round((1 - r.placement / r.total_in_category) * 100)
        : null,
      avgPower: r.avg_power ?? null,
      tsbAtRace: r.tsb_at_race ?? null,
      ctlAtRace: r.ctl_at_race ?? null,
    }))

    // Calculate aggregate statistics for context
    const totalSessions = sessions.length
    const totalHours = Math.round(sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / 3600)
    const avgSessionsPerWeek = Math.round(totalSessions / (days / 7) * 10) / 10
    const avgHoursPerWeek = Math.round(totalHours / (days / 7) * 10) / 10

    // Day of week analysis
    const dayStats: Record<string, { count: number; avgTSS: number; avgIF: number }> = {}
    sessionsWithContext.forEach(s => {
      if (!dayStats[s.dayOfWeek]) {
        dayStats[s.dayOfWeek] = { count: 0, avgTSS: 0, avgIF: 0 }
      }
      dayStats[s.dayOfWeek].count++
    })
    Object.keys(dayStats).forEach(day => {
      const daySessions = sessionsWithContext.filter(s => s.dayOfWeek === day)
      const withTSS = daySessions.filter(s => s.tss)
      const withIF = daySessions.filter(s => s.intensityFactor)
      dayStats[day].avgTSS = withTSS.length > 0
        ? Math.round(withTSS.reduce((sum, s) => sum + s.tss!, 0) / withTSS.length)
        : 0
      dayStats[day].avgIF = withIF.length > 0
        ? Math.round(withIF.reduce((sum, s) => sum + s.intensityFactor!, 0) / withIF.length * 100) / 100
        : 0
    })

    // Build response based on focus
    const response: Record<string, unknown> = {
      metadata: {
        period,
        startDate: startDateStr,
        endDate: new Date().toISOString().split('T')[0],
        totalSessions,
        totalHours,
        avgSessionsPerWeek,
        avgHoursPerWeek,
        dataQuality: {
          sessionsWithPower: sessions.filter(s => s.avg_power).length,
          sessionsWithHR: sessions.filter(s => s.avg_hr).length,
          sessionsWithTSS: sessions.filter(s => s.tss).length,
        },
      },

      aggregates: {
        byDayOfWeek: dayStats,
        workoutTypeBreakdown: sessionsWithContext.reduce((acc, s) => {
          acc[s.type] = (acc[s.type] || 0) + 1
          return acc
        }, {} as Record<string, number>),
      },

      weeklySummaries,

      analysisHints: [
        'Look for correlations between TSB and performance/session quality',
        'Check if certain days of week have better intensity sessions',
        'Examine what happens after rest days vs consecutive training days',
        'Look for patterns in workout type sequencing',
        'Check if there are trends in the weekly data over time',
      ],
    }

    // Add detailed session data if requested
    if (includeRaw) {
      response.sessions = sessionsWithContext
    }

    // Add race data if available and relevant
    if (raceSummaries.length > 0 && (focus === 'all' || focus === 'racing')) {
      response.races = raceSummaries
      response.raceAnalysisHints = [
        'Compare TSB at race time with placement percentile',
        'Look for CTL ranges that produce best results',
        'Check preparation patterns before successful races',
      ]
    }

    // Add outcome data if available
    if (outcomes.length > 0) {
      const outcomesSummary = outcomes.slice(0, 30).map(o => ({
        date: o.created_at,
        suggestedType: o.suggested_type,
        actualType: o.actual_type,
        followedSuggestion: o.followed_suggestion,
        rpe: o.rpe,
        feedback: o.feedback?.slice(0, 100),
      }))
      response.workoutOutcomes = outcomesSummary
    }

    // Add existing memories for context
    if (memories.length > 0) {
      response.existingKnowledge = memories.map(m => ({
        type: m.memory_type,
        content: m.content,
        confidence: m.confidence,
      }))
    }

    // Add the investigation question if provided
    if (question) {
      response.investigationQuestion = question
      response.investigationHint = `Focus your analysis on answering: "${question}". Look for data that supports or refutes hypotheses related to this question.`
    }

    return response
  },
})

// Helper to get Monday of the week
function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Sunday
  date.setDate(diff)
  return date.toISOString().split('T')[0]
}
