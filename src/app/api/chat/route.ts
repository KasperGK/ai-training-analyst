import { anthropic } from '@ai-sdk/anthropic'
import { streamText, stepCountIs } from 'ai'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'
import { intervalsClient, getDateRange, formatDateForApi } from '@/lib/intervals-icu'
import { getUpcomingEvents, getNextAEvent } from '@/lib/db/events'
import { getActiveGoals } from '@/lib/db/goals'
import { getSessions, getSession } from '@/lib/db/sessions'
import { getFitnessHistory, getCurrentFitness } from '@/lib/db/fitness'
import { searchWiki, searchSessions } from '@/lib/rag/vector-store'
import type { WorkoutSuggestion, Session } from '@/types'

// Feature flags
const USE_LOCAL_DATA = process.env.FEATURE_LOCAL_DATA === 'true'
const ENABLE_RAG = process.env.FEATURE_RAG === 'true'

export const maxDuration = 30

interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  parts?: { type: string; text: string }[]
  content?: string
}

export async function POST(req: Request) {
  const { messages, athleteContext, athleteId } = await req.json()

  // Get intervals.icu credentials (same pattern as /api/intervals/data)
  const cookieStore = await cookies()
  let accessToken = cookieStore.get('intervals_access_token')?.value
  let intervalsAthleteId = cookieStore.get('intervals_athlete_id')?.value

  // Fallback to env vars
  if (!accessToken || !intervalsAthleteId) {
    accessToken = process.env.INTERVALS_ICU_API_KEY
    intervalsAthleteId = process.env.INTERVALS_ICU_ATHLETE_ID
  }

  // Set credentials if available
  const intervalsConnected = !!(accessToken && intervalsAthleteId)
  if (intervalsConnected) {
    intervalsClient.setCredentials(accessToken!, intervalsAthleteId!)
  }

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
    stopWhen: stepCountIs(5), // Allow up to 5 tool call + response cycles
    tools: {
      // Tool 1: Get detailed session data
      getDetailedSession: {
        description: 'Fetch detailed data for a specific training session including power zones, HR zones, and full metrics. Use when the user asks about a specific workout or you need more details about a session.',
        inputSchema: z.object({
          sessionId: z.string().describe('The session ID to fetch details for'),
        }),
        execute: async ({ sessionId }: { sessionId: string }) => {
          // Helper to build response from session data
          const buildSessionResponse = (session: Session) => {
            const powerZones = session.power_zones
            return {
              session: {
                id: session.id,
                date: session.date,
                name: session.workout_type || session.sport,
                type: session.sport,
                duration_seconds: session.duration_seconds,
                distance_meters: session.distance_meters,
                tss: session.tss,
                intensity_factor: session.intensity_factor,
                normalized_power: session.normalized_power,
                avg_power: session.avg_power,
                max_power: session.max_power,
                avg_hr: session.avg_hr,
                max_hr: session.max_hr,
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

          // Try local Supabase first if feature flag is enabled
          if (USE_LOCAL_DATA && athleteId) {
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
          if (!intervalsConnected) {
            return { error: 'intervals.icu not connected. Please connect your account in Settings.' }
          }

          try {
            const activity = await intervalsClient.getActivity(sessionId)
            if (!activity) {
              return { error: 'Session not found' }
            }

            // Calculate power zone distribution if available
            let powerZones = null
            if (activity.power_zone_times && activity.power_zone_times.length > 0) {
              const total = activity.power_zone_times.reduce((a, b) => a + b, 0)
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
              normalized_power: activity.icu_weighted_avg_watts || activity.weighted_average_watts,
              avg_power: activity.icu_average_watts || activity.average_watts,
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
      },

      // Tool 2: Query historical trends
      queryHistoricalTrends: {
        description: 'Analyze training patterns and trends over a time period. Use for questions about training volume, intensity distribution, fitness progression, or comparing time periods.',
        inputSchema: z.object({
          metric: z.enum(['tss', 'duration', 'intensity', 'fitness', 'volume']).describe('The metric to analyze'),
          period: z.enum(['week', 'month', '3months', '6months', 'year']).describe('Time period to analyze'),
        }),
        execute: async ({ metric, period }: { metric: string; period: string }) => {
          const daysMap: Record<string, number> = {
            week: 7,
            month: 30,
            '3months': 90,
            '6months': 180,
            year: 365,
          }
          const days = daysMap[period]
          const startDate = new Date()
          startDate.setDate(startDate.getDate() - days)
          const startDateStr = formatDateForApi(startDate)

          // Try local Supabase first if feature flag is enabled
          if (USE_LOCAL_DATA && athleteId) {
            try {
              const [localSessions, localFitness] = await Promise.all([
                getSessions(athleteId, { startDate: startDateStr, limit: 500 }),
                metric === 'fitness' ? getFitnessHistory(athleteId, days) : Promise.resolve([]),
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
                let fitnessData = null
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
                let intensityDistribution = null
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
          if (!intervalsConnected) {
            return { error: 'intervals.icu not connected. Please connect your account in Settings.' }
          }

          const { oldest, newest } = getDateRange(days)

          try {
            // Fetch activities and wellness data from intervals.icu
            const [activities, wellness] = await Promise.all([
              intervalsClient.getActivities(oldest, newest),
              metric === 'fitness' ? intervalsClient.getWellness(oldest, newest) : Promise.resolve([]),
            ])

            // Filter out STRAVA activities (same as dashboard)
            const sessions = activities.filter(a => a.source !== 'STRAVA' && a.type && a.moving_time)

            if (sessions.length === 0) {
              return { message: 'No training data found for this period' }
            }

            // Calculate statistics
            const totalTSS = sessions.reduce((sum, s) => sum + (s.icu_training_load || 0), 0)
            const totalDuration = sessions.reduce((sum, s) => sum + (s.moving_time || 0), 0)
            const sessionsWithIF = sessions.filter(s => s.icu_intensity)
            const avgIF = sessionsWithIF.length > 0
              ? sessionsWithIF.reduce((sum, s) => sum + (s.icu_intensity || 0), 0) / sessionsWithIF.length
              : 0

            // Get fitness trend if requested
            let fitnessData = null
            if (metric === 'fitness' && wellness.length > 0) {
              const first = wellness[0]
              const last = wellness[wellness.length - 1]
              const avgTSB = wellness.reduce((sum, w) => sum + (w.ctl - w.atl), 0) / wellness.length
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
            let intensityDistribution = null
            if (metric === 'intensity') {
              const lowIntensity = sessions.filter(s => (s.icu_intensity || 0) < 0.75).length
              const medIntensity = sessions.filter(s => (s.icu_intensity || 0) >= 0.75 && (s.icu_intensity || 0) < 0.90).length
              const highIntensity = sessions.filter(s => (s.icu_intensity || 0) >= 0.90).length
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
      },

      // Tool 3: Get athlete goals and events
      getAthleteGoals: {
        description: 'Get the athlete\'s current training goals and upcoming events. Use to provide context-aware recommendations based on their targets.',
        inputSchema: z.object({}),
        execute: async () => {
          // Try to get goals/events from database if user is logged in
          let goals: Array<{ title: string; target_type: string; target_value: number | null; current_value: number | null; deadline: string | null }> = []
          let upcomingEvents: Array<{ name: string; date: string; priority: string }> = []
          let nextAEvent: { name: string; date: string } | null = null

          if (athleteId) {
            try {
              const [dbGoals, dbEvents, dbNextAEvent] = await Promise.all([
                getActiveGoals(athleteId),
                getUpcomingEvents(athleteId, 5),
                getNextAEvent(athleteId),
              ])
              goals = dbGoals
              upcomingEvents = dbEvents
              nextAEvent = dbNextAEvent
            } catch {
              // Database not available, continue without goals/events
            }
          }

          // Get current fitness - try local Supabase first
          let currentFitness = null
          let fitnessSource = 'none'

          if (USE_LOCAL_DATA && athleteId) {
            try {
              const localFitness = await getCurrentFitness(athleteId)
              if (localFitness) {
                currentFitness = {
                  ctl: Math.round(localFitness.ctl),
                  atl: Math.round(localFitness.atl),
                  tsb: Math.round(localFitness.tsb),
                }
                fitnessSource = 'local'
              }
            } catch {
              // Fall through to intervals.icu
            }
          }

          // Fall back to intervals.icu if no local fitness
          if (!currentFitness && intervalsConnected) {
            try {
              const today = formatDateForApi(new Date())
              const wellness = await intervalsClient.getWellnessForDate(today)
              if (wellness) {
                currentFitness = {
                  ctl: Math.round(wellness.ctl),
                  atl: Math.round(wellness.atl),
                  tsb: Math.round(wellness.ctl - wellness.atl),
                }
                fitnessSource = 'intervals_icu'
              }
            } catch {
              // Fallback to context if available
              try {
                const ctx = JSON.parse(athleteContext || '{}')
                currentFitness = ctx.currentFitness || null
                fitnessSource = 'context'
              } catch {
                // Use null
              }
            }
          }

          // Last resort: try context
          if (!currentFitness) {
            try {
              const ctx = JSON.parse(athleteContext || '{}')
              currentFitness = ctx.currentFitness || null
              fitnessSource = 'context'
            } catch {
              // Use null
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
          let currentCTL = 0
          let currentATL = 0
          let athleteFTP = 250 // default
          let fitnessSource = 'default'

          // Try to get FTP from athlete context first
          try {
            const ctx = JSON.parse(athleteContext || '{}')
            athleteFTP = ctx.athlete?.ftp || 250
            // Also try to get fitness from context as fallback
            if (ctx.currentFitness) {
              currentTSB = ctx.currentFitness.tsb || 0
              currentCTL = ctx.currentFitness.ctl || 0
              currentATL = ctx.currentFitness.atl || 0
              fitnessSource = 'context'
            }
          } catch {
            // Use defaults
          }

          // Try local Supabase first if feature flag is enabled
          if (USE_LOCAL_DATA && athleteId) {
            try {
              const localFitness = await getCurrentFitness(athleteId)
              if (localFitness) {
                currentCTL = localFitness.ctl
                currentATL = localFitness.atl
                currentTSB = localFitness.tsb
                fitnessSource = 'local'
              }
            } catch {
              // Fall through to intervals.icu
            }
          }

          // Fall back to intervals.icu if no local data
          if (fitnessSource !== 'local' && intervalsConnected) {
            try {
              const today = formatDateForApi(new Date())
              const wellness = await intervalsClient.getWellnessForDate(today)
              if (wellness) {
                currentCTL = wellness.ctl
                currentATL = wellness.atl
                currentTSB = wellness.ctl - wellness.atl
                fitnessSource = 'intervals_icu'
              }
            } catch {
              // Use fallback values from context
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
              currentTSB: Math.round(currentTSB),
              currentCTL: Math.round(currentCTL),
              currentATL: Math.round(currentATL),
              selectedBecause: type === 'any'
                ? `Based on your current form (TSB: ${Math.round(currentTSB)}, CTL: ${Math.round(currentCTL)}), a ${selectedType} workout is recommended.`
                : `You requested a ${type} workout.`,
              ftp: athleteFTP,
            },
          }
        },
      },

      // Tool 5: Generate chart visualization
      generateChart: {
        description: 'Generate a chart to visualize training data. Use this when data would be better understood visually - trends over time, comparisons, distributions, etc.',
        inputSchema: z.object({
          chartType: z.enum(['line', 'bar', 'area']).describe('Type of chart: line for trends, bar for comparisons, area for cumulative data'),
          title: z.string().describe('Short title for the chart'),
          dataType: z.enum(['fitness_trend', 'weekly_tss', 'power_zones', 'training_load', 'custom']).describe('What data to visualize'),
          period: z.enum(['7d', '14d', '30d', '90d']).optional().describe('Time period for trend data'),
          customData: z.array(z.object({
            label: z.string(),
            value: z.number(),
            category: z.string().optional(),
          })).optional().describe('Custom data points if dataType is "custom"'),
        }),
        execute: async ({ chartType, title, dataType, period = '30d', customData }: {
          chartType: 'line' | 'bar' | 'area'
          title: string
          dataType: 'fitness_trend' | 'weekly_tss' | 'power_zones' | 'training_load' | 'custom'
          period?: '7d' | '14d' | '30d' | '90d'
          customData?: Array<{ label: string; value: number; category?: string }>
        }) => {
          const periodDays = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 }[period]

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

            if (USE_LOCAL_DATA && athleteId) {
              try {
                const history = await getFitnessHistory(athleteId, periodDays)
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

            if (fitnessData.length === 0 && intervalsConnected) {
              try {
                const { oldest, newest } = getDateRange(periodDays)
                const wellness = await intervalsClient.getWellness(oldest, newest)
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

            if (USE_LOCAL_DATA && athleteId) {
              try {
                const endDate = new Date()
                const startDateObj = new Date()
                startDateObj.setDate(startDateObj.getDate() - periodDays)
                sessions = await getSessions(athleteId, {
                  startDate: startDateObj.toISOString().split('T')[0],
                  endDate: endDate.toISOString().split('T')[0],
                  limit: 500,
                })
              } catch {
                // Fall through
              }
            }

            if (sessions.length === 0 && intervalsConnected) {
              try {
                const { oldest, newest } = getDateRange(periodDays)
                const activities = await intervalsClient.getActivities(oldest, newest)
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

            if (USE_LOCAL_DATA && athleteId) {
              try {
                const startDateObj = new Date()
                startDateObj.setDate(startDateObj.getDate() - periodDays)
                const sessions = await getSessions(athleteId, {
                  startDate: startDateObj.toISOString().split('T')[0],
                  endDate: new Date().toISOString().split('T')[0],
                  limit: 500,
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
      },

      // Tool 6: Search knowledge base (RAG)
      ...(ENABLE_RAG ? {
        searchKnowledge: {
          description: 'Search the training science wiki and athlete session history for relevant information. Use when answering questions about training concepts, periodization, nutrition, recovery, or when looking for patterns in past training.',
          inputSchema: z.object({
            query: z.string().describe('The search query - be specific about what information you need'),
            sources: z.array(z.enum(['wiki', 'sessions'])).optional().describe('Which sources to search. Defaults to wiki only. Include "sessions" to search athlete history.'),
          }),
          execute: async ({ query, sources = ['wiki'] }: { query: string; sources?: ('wiki' | 'sessions')[] }) => {
            const results: {
              wiki?: Array<{ title: string; content: string; relevance: number }>
              sessions?: Array<{ summary: string; relevance: number }>
            } = {}

            // Search wiki if requested
            if (sources.includes('wiki')) {
              try {
                const wikiResults = await searchWiki(query, { matchCount: 3, matchThreshold: 0.4 })
                results.wiki = wikiResults.map(r => ({
                  title: r.title,
                  content: r.content,
                  relevance: Math.round((r.similarity || 0) * 100),
                }))
              } catch (error) {
                console.error('[searchKnowledge] Wiki search error:', error)
              }
            }

            // Search sessions if requested (requires athleteId)
            if (sources.includes('sessions') && athleteId) {
              try {
                const sessionResults = await searchSessions(query, athleteId, { matchCount: 3, matchThreshold: 0.4 })
                results.sessions = sessionResults.map(r => ({
                  summary: r.summary,
                  relevance: Math.round((r.similarity || 0) * 100),
                }))
              } catch (error) {
                console.error('[searchKnowledge] Session search error:', error)
              }
            }

            const totalResults = (results.wiki?.length || 0) + (results.sessions?.length || 0)

            if (totalResults === 0) {
              return { message: 'No relevant information found. Try rephrasing your query or being more specific.' }
            }

            return {
              query,
              results,
              totalResults,
              tip: 'Use this information to provide accurate, evidence-based advice to the athlete.',
            }
          },
        },
      } : {}),
    },
  })

  return result.toUIMessageStreamResponse()
}
