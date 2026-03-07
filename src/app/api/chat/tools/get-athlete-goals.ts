import { z } from 'zod'
import { defineTool } from './types'
import { enrichAthleteContext } from './utils/athlete-context-utils'
import { getUpcomingEvents, getNextAEvent } from '@/lib/db/events'
import { getActiveGoals, type Goal as DbGoal } from '@/lib/db/goals'
import { calculateGoalProgress, calculateGoalRiskLevel } from '@/lib/goals/progress-detector'
import type { MetricGoalType, MetricConditions } from '@/types'

const inputSchema = z.object({})

type Input = z.infer<typeof inputSchema>

interface Goal {
  title: string
  targetType: string
  targetValue: number | null
  currentValue: number | null
  deadline: string | null
  progress: number | null
  metricType: MetricGoalType | null
  metricConditions: MetricConditions | null
  riskLevel: 'on_track' | 'at_risk' | 'achieved' | 'no_deadline'
  lastCheckedAt: string | null
}

interface UpcomingEvent {
  name: string
  date: string
  priority: string
  daysUntil: number
}

interface CurrentFitness {
  ctl: number
  atl: number
  tsb: number
}

interface Output {
  goals: Goal[]
  upcomingEvents: UpcomingEvent[]
  nextAEvent: {
    name: string
    date: string
    weeksAway: number | null
  } | null
  periodizationPhase: string
  currentFitness: CurrentFitness | null
}

export const getAthleteGoals = defineTool<Input, Output>({
  description: 'Get the athlete\'s current training goals and upcoming events. Use to provide context-aware recommendations based on their targets.',
  inputSchema,
  execute: async (_input, ctx) => {
    // Try to get goals/events from database if user is logged in
    let goals: DbGoal[] = []
    let upcomingEvents: Array<{ name: string; date: string; priority: string }> = []
    let nextAEvent: { name: string; date: string } | null = null

    if (ctx.athleteId) {
      try {
        const [dbGoals, dbEvents, dbNextAEvent] = await Promise.all([
          getActiveGoals(ctx.athleteId),
          getUpcomingEvents(ctx.athleteId, 5),
          getNextAEvent(ctx.athleteId),
        ])
        goals = dbGoals
        upcomingEvents = dbEvents
        nextAEvent = dbNextAEvent
      } catch {
        // Database not available, continue without goals/events
      }
    }

    // Get current fitness from best available source
    const enriched = await enrichAthleteContext(ctx)
    const currentFitness: CurrentFitness | null =
      enriched.fitness_source !== 'default'
        ? {
            ctl: Math.round(enriched.ctl),
            atl: Math.round(enriched.atl),
            tsb: Math.round(enriched.tsb),
          }
        : null

    // Calculate periodization phase based on next A event
    let periodizationPhase = 'base'
    let weeksToEvent: number | null = null

    if (nextAEvent) {
      const eventDate = new Date(nextAEvent.date)
      const today = new Date()
      const daysToEvent = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      weeksToEvent = Math.ceil(daysToEvent / 7)

      if (weeksToEvent <= 1) periodizationPhase = 'taper'
      else if (weeksToEvent <= 3) periodizationPhase = 'peak'
      else if (weeksToEvent <= 8) periodizationPhase = 'build'
      else periodizationPhase = 'base'
    }

    return {
      goals: goals.map(g => ({
        title: g.title,
        targetType: g.target_type,
        targetValue: g.target_value,
        currentValue: g.current_value,
        deadline: g.deadline,
        progress: calculateGoalProgress(g),
        metricType: g.metric_type || null,
        metricConditions: g.metric_conditions || null,
        riskLevel: calculateGoalRiskLevel(g),
        lastCheckedAt: g.last_checked_at || null,
      })),
      upcomingEvents: upcomingEvents.map(e => ({
        name: e.name,
        date: e.date,
        priority: e.priority,
        daysUntil: Math.ceil((new Date(e.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      })),
      nextAEvent: nextAEvent ? {
        name: nextAEvent.name,
        date: nextAEvent.date,
        weeksAway: weeksToEvent,
      } : null,
      periodizationPhase,
      currentFitness,
    }
  },
})
