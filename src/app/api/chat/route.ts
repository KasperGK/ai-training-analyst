import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import { z } from 'zod'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'
import { getSession, getSessions } from '@/lib/db/sessions'
import { getFitnessHistory, getCurrentFitness } from '@/lib/db/fitness'
import { getUpcomingEvents, getNextAEvent } from '@/lib/db/events'
import { getActiveGoals } from '@/lib/db/goals'
import type { WorkoutSuggestion } from '@/types'

export const maxDuration = 30

interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  parts?: { type: string; text: string }[]
  content?: string
}

export async function POST(req: Request) {
  const { messages, athleteContext, athleteId } = await req.json()

  const systemPrompt = buildSystemPrompt(athleteContext)

  // Convert UI messages (with parts) to API messages (with content)
  const convertedMessages = (messages as UIMessage[]).map(msg => ({
    role: msg.role,
    content: msg.content || msg.parts?.filter(p => p.type === 'text').map(p => p.text).join('') || '',
  }))

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: systemPrompt,
    messages: convertedMessages,
    tools: {
      // Tool 1: Get detailed session data
      getDetailedSession: {
        description: 'Fetch detailed data for a specific training session including power zones, HR zones, and full metrics. Use when the user asks about a specific workout or you need more details about a session.',
        inputSchema: z.object({
          sessionId: z.string().describe('The session ID to fetch details for'),
        }),
        execute: async ({ sessionId }: { sessionId: string }) => {
          const session = await getSession(sessionId)
          if (!session) {
            return { error: 'Session not found' }
          }
          return {
            session,
            analysis: {
              isHighIntensity: (session.intensity_factor || 0) > 0.85,
              isPolarized: session.power_zones
                ? (session.power_zones.z1 + session.power_zones.z2) > 70 ||
                  (session.power_zones.z5 + (session.power_zones.z6 || 0)) > 20
                : false,
              efficiencyFactor: session.normalized_power && session.avg_hr
                ? Math.round((session.normalized_power / session.avg_hr) * 100) / 100
                : null,
            },
          }
        },
      },

      // Tool 2: Query historical trends
      queryHistoricalTrends: {
        description: 'Analyze training patterns and trends over a time period. Use for questions about training volume, intensity distribution, fitness progression, or comparing time periods.',
        inputSchema: z.object({
          metric: z.enum(['tss', 'duration', 'intensity', 'fitness', 'volume']).describe('The metric to analyze'),
          period: z.enum(['week', 'month', '3months', '6months', 'year']).describe('Time period to analyze'),
        }),
        execute: async ({ metric, period }: { metric: string; period: string }) => {
          if (!athleteId) {
            return { error: 'No athlete context available' }
          }

          const daysMap: Record<string, number> = {
            week: 7,
            month: 30,
            '3months': 90,
            '6months': 180,
            year: 365,
          }
          const days = daysMap[period]

          // Get sessions for the period
          const endDate = new Date()
          const startDate = new Date()
          startDate.setDate(startDate.getDate() - days)

          const sessions = await getSessions(athleteId, {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            limit: 500,
          })

          if (sessions.length === 0) {
            return { message: 'No training data found for this period' }
          }

          // Calculate statistics based on metric
          const totalTSS = sessions.reduce((sum, s) => sum + (s.tss || 0), 0)
          const totalDuration = sessions.reduce((sum, s) => sum + s.duration_seconds, 0)
          const avgIF = sessions.filter(s => s.intensity_factor).reduce((sum, s, _, arr) =>
            sum + (s.intensity_factor || 0) / arr.length, 0)

          // Get fitness trend if requested
          let fitnessData = null
          if (metric === 'fitness') {
            const history = await getFitnessHistory(athleteId, days)
            if (history.length > 0) {
              const first = history[0]
              const last = history[history.length - 1]
              fitnessData = {
                startCTL: first.ctl,
                endCTL: last.ctl,
                ctlChange: Math.round((last.ctl - first.ctl) * 10) / 10,
                avgTSB: history.reduce((sum, h) => sum + h.tsb, 0) / history.length,
              }
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
          }
        },
      },

      // Tool 3: Get athlete goals and events
      getAthleteGoals: {
        description: 'Get the athlete\'s current training goals and upcoming events. Use to provide context-aware recommendations based on their targets.',
        inputSchema: z.object({}),
        execute: async () => {
          if (!athleteId) {
            return { error: 'No athlete context available' }
          }

          const [goals, upcomingEvents, nextAEvent, currentFitness] = await Promise.all([
            getActiveGoals(athleteId),
            getUpcomingEvents(athleteId, 5),
            getNextAEvent(athleteId),
            getCurrentFitness(athleteId),
          ])

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
      },

      // Tool 4: Suggest a workout
      suggestWorkout: {
        description: 'Generate a specific workout recommendation based on current fitness, fatigue, and training goals. Returns a structured workout the athlete can follow.',
        inputSchema: z.object({
          type: z.enum(['recovery', 'endurance', 'tempo', 'threshold', 'intervals', 'any']).describe('Type of workout to suggest, or "any" to let the system decide'),
          durationMinutes: z.number().optional().describe('Target duration in minutes'),
          targetTSS: z.number().optional().describe('Target TSS for the workout'),
        }),
        execute: async ({ type, durationMinutes, targetTSS }: { type: string; durationMinutes?: number; targetTSS?: number }) => {
          // Get current fitness to inform recommendation
          let currentTSB = 0
          let athleteFTP = 250 // default

          if (athleteId) {
            const fitness = await getCurrentFitness(athleteId)
            if (fitness) {
              currentTSB = fitness.tsb
            }
            // Try to get FTP from athlete context
            try {
              const ctx = JSON.parse(athleteContext || '{}')
              athleteFTP = ctx.athlete?.ftp || 250
            } catch {
              // Use default
            }
          }

          // Auto-select type based on TSB if "any"
          let selectedType = type
          if (type === 'any') {
            if (currentTSB < -20) selectedType = 'recovery'
            else if (currentTSB < -10) selectedType = 'endurance'
            else if (currentTSB < 5) selectedType = 'tempo'
            else selectedType = 'threshold'
          }

          // Generate workout based on type
          const workouts: Record<string, WorkoutSuggestion> = {
            recovery: {
              type: 'recovery',
              duration_minutes: durationMinutes || 45,
              description: 'Easy spin keeping HR in Zone 1. Focus on smooth pedaling and relaxation. No hard efforts.',
              target_tss: targetTSS || 25,
            },
            endurance: {
              type: 'endurance',
              duration_minutes: durationMinutes || 90,
              description: 'Steady Zone 2 ride. Keep power between 55-75% of FTP. Maintain conversation pace.',
              target_tss: targetTSS || 60,
            },
            tempo: {
              type: 'tempo',
              duration_minutes: durationMinutes || 75,
              description: `Warm up 15min, then 3x15min at ${Math.round(athleteFTP * 0.80)}-${Math.round(athleteFTP * 0.88)}W (76-88% FTP) with 5min recovery. Cool down 10min.`,
              target_tss: targetTSS || 75,
              intervals: {
                sets: 3,
                duration_seconds: 900,
                rest_seconds: 300,
                target_power_percent: 82,
              },
            },
            threshold: {
              type: 'threshold',
              duration_minutes: durationMinutes || 60,
              description: `Warm up 15min, then 2x20min at ${Math.round(athleteFTP * 0.95)}-${Math.round(athleteFTP * 1.0)}W (95-100% FTP) with 5min recovery. Cool down 10min.`,
              target_tss: targetTSS || 80,
              intervals: {
                sets: 2,
                duration_seconds: 1200,
                rest_seconds: 300,
                target_power_percent: 97,
              },
            },
            intervals: {
              type: 'intervals',
              duration_minutes: durationMinutes || 60,
              description: `Warm up 15min, then 5x4min at ${Math.round(athleteFTP * 1.1)}-${Math.round(athleteFTP * 1.2)}W (110-120% FTP) with 4min recovery. Cool down 10min.`,
              target_tss: targetTSS || 85,
              intervals: {
                sets: 5,
                duration_seconds: 240,
                rest_seconds: 240,
                target_power_percent: 115,
              },
            },
          }

          const workout = workouts[selectedType] || workouts.endurance

          return {
            workout,
            context: {
              currentTSB,
              selectedBecause: type === 'any'
                ? `Based on your current form (TSB: ${currentTSB}), a ${selectedType} workout is recommended.`
                : `You requested a ${type} workout.`,
              ftp: athleteFTP,
            },
          }
        },
      },
    },
  })

  return result.toUIMessageStreamResponse()
}
