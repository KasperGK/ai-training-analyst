import { z } from 'zod'
import { defineTool, parseAthleteContext } from './types'
import { getUpcomingEvents, getNextAEvent } from '@/lib/db/events'
import { getActiveGoals } from '@/lib/db/goals'
import { getCurrentFitness } from '@/lib/db/fitness'
import { formatDateForApi } from '@/lib/intervals-icu'

const inputSchema = z.object({})

type Input = z.infer<typeof inputSchema>

interface Goal {
  title: string
  targetType: string
  targetValue: number | null
  currentValue: number | null
  deadline: string | null
  progress: number | null
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
    let goals: Array<{ title: string; target_type: string; target_value: number | null; current_value: number | null; deadline: string | null }> = []
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

    // Get current fitness - try local Supabase first
    let currentFitness: CurrentFitness | null = null

    if (ctx.flags.useLocalData && ctx.athleteId) {
      try {
        const localFitness = await getCurrentFitness(ctx.athleteId)
        if (localFitness) {
          currentFitness = {
            ctl: Math.round(localFitness.ctl),
            atl: Math.round(localFitness.atl),
            tsb: Math.round(localFitness.tsb),
          }
        }
      } catch {
        // Fall through to intervals.icu
      }
    }

    // Fall back to intervals.icu if no local fitness
    if (!currentFitness && ctx.intervalsConnected) {
      try {
        const today = formatDateForApi(new Date())
        const wellness = await ctx.intervalsClient.getWellnessForDate(today)
        if (wellness) {
          currentFitness = {
            ctl: Math.round(wellness.ctl),
            atl: Math.round(wellness.atl),
            tsb: Math.round(wellness.ctl - wellness.atl),
          }
        }
      } catch {
        // Fallback to context if available
        const parsed = parseAthleteContext(ctx.athleteContext)
        if (parsed.currentFitness) {
          currentFitness = {
            ctl: Math.round(parsed.currentFitness.ctl || 0),
            atl: Math.round(parsed.currentFitness.atl || 0),
            tsb: Math.round(parsed.currentFitness.tsb || 0),
          }
        }
      }
    }

    // Last resort: try context
    if (!currentFitness) {
      const parsed = parseAthleteContext(ctx.athleteContext)
      if (parsed.currentFitness) {
        currentFitness = {
          ctl: Math.round(parsed.currentFitness.ctl || 0),
          atl: Math.round(parsed.currentFitness.atl || 0),
          tsb: Math.round(parsed.currentFitness.tsb || 0),
        }
      }
    }

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
        progress: g.target_value && g.current_value
          ? Math.round((g.current_value / g.target_value) * 100)
          : null,
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
