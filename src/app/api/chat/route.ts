import { anthropic } from '@ai-sdk/anthropic'
import { streamText, stepCountIs } from 'ai'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'
import { intervalsClient, getDateRange, formatDateForApi } from '@/lib/intervals-icu'
import { getNormalizedPower, getAveragePower } from '@/lib/transforms'
import { getUpcomingEvents, getNextAEvent } from '@/lib/db/events'
import { getActiveGoals } from '@/lib/db/goals'
import { getSessions, getSession } from '@/lib/db/sessions'
import { getFitnessHistory, getCurrentFitness } from '@/lib/db/fitness'
import { searchWiki, searchSessions } from '@/lib/rag/vector-store'
import { getMemories, upsertMemory, type MemoryType, type MemorySource } from '@/lib/personalization/athlete-memory'
import { getPersonalizationSection } from '@/lib/personalization/prompt-builder'
import { getInsights } from '@/lib/insights/insight-generator'
import { logWorkoutOutcome as logOutcome, getOutcomeStats } from '@/lib/db/workout-outcomes'
import { prescribeWorkout, suggestWorkoutType, getBestWorkout, type AthleteContext as WorkoutAthleteContext } from '@/lib/workouts/prescribe'
import { workoutLibrary, getWorkoutById, type WorkoutCategory } from '@/lib/workouts/library'
import { generateTrainingPlan, getAvailablePlans } from '@/lib/plans/generator'
import { planTemplates, getPlanTemplateSummary, type PlanGoal } from '@/lib/plans/templates'
import { analyzeAthletePatterns, summarizePatterns } from '@/lib/learning'
import type { WorkoutSuggestion, Session } from '@/types'

// Feature flags
const USE_LOCAL_DATA = process.env.FEATURE_LOCAL_DATA === 'true'
const ENABLE_RAG = process.env.FEATURE_RAG === 'true'
const ENABLE_MEMORY = process.env.FEATURE_MEMORY === 'true'
const ENABLE_INSIGHTS = process.env.FEATURE_INSIGHTS === 'true'

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

  // If athlete data is missing from frontend context, fetch from intervals.icu
  let effectiveAthleteContext = athleteContext
  const parsedContext = athleteContext ? JSON.parse(athleteContext) : {}

  if (intervalsConnected && !parsedContext.athlete?.ftp) {
    try {
      const athlete = await intervalsClient.getAthlete()
      const cycling = athlete.sportSettings?.find((s: { type?: string }) => s.type === 'Bike') || athlete.sportSettings?.[0]

      const enrichedContext = {
        ...parsedContext,
        athlete: {
          ...parsedContext.athlete,
          ftp: cycling?.ftp ?? null,
          max_hr: cycling?.max_hr ?? null,
          lthr: cycling?.lthr ?? null,
          weight_kg: athlete.icu_weight ?? athlete.weight ?? null,
          resting_hr: athlete.icu_resting_hr ?? null,
          name: athlete.name ?? null,
        }
      }
      effectiveAthleteContext = JSON.stringify(enrichedContext, null, 2)
      console.log('[chat] Enriched context from intervals.icu:', enrichedContext.athlete)
    } catch (error) {
      console.error('[chat] Failed to fetch athlete from intervals.icu:', error)
    }
  }

  // Build system prompt with athlete context
  let systemPrompt = buildSystemPrompt(effectiveAthleteContext)

  // Add personalization section if memory feature is enabled
  if (ENABLE_MEMORY && athleteId) {
    const personalization = await getPersonalizationSection(athleteId)
    if (personalization) {
      systemPrompt = `${systemPrompt}\n\n${personalization}\n\nUse the getAthleteMemory and saveAthleteMemory tools to retrieve and store information about this athlete.`
    }
  }

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

      // Tool 4: Suggest a workout (powered by 34-workout library)
      suggestWorkout: {
        description: 'Generate an intelligent workout recommendation from a library of 34 structured workouts. Considers current fitness, fatigue, training phase, and preferences. Returns personalized power targets and detailed execution guidance.',
        inputSchema: z.object({
          type: z.enum([
            'any', 'recovery', 'endurance', 'tempo', 'sweetspot', 'threshold', 'vo2max', 'anaerobic', 'sprint'
          ]).describe('Workout category, or "any" to let the system choose based on current form'),
          durationMinutes: z.number().optional().describe('Target duration in minutes (will find closest match)'),
          targetTSS: z.number().optional().describe('Target TSS for the workout'),
          showAlternatives: z.boolean().optional().describe('Include alternative workout options'),
        }),
        execute: async ({ type, durationMinutes, targetTSS, showAlternatives = false }: {
          type: string
          durationMinutes?: number
          targetTSS?: number
          showAlternatives?: boolean
        }) => {
          // Gather athlete context
          let athleteFTP = 250
          let weightKg = 70
          let currentTSB = 0
          let currentCTL = 0
          let currentATL = 0
          let fitnessSource = 'default'

          // Try to get FTP and weight from athlete context
          try {
            const ctx = JSON.parse(athleteContext || '{}')
            athleteFTP = ctx.athlete?.ftp || 250
            weightKg = ctx.athlete?.weight_kg || 70
            if (ctx.currentFitness) {
              currentTSB = ctx.currentFitness.tsb || 0
              currentCTL = ctx.currentFitness.ctl || 0
              currentATL = ctx.currentFitness.atl || 0
              fitnessSource = 'context'
            }
          } catch {
            // Use defaults
          }

          // Try local Supabase
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
              // Fall through
            }
          }

          // Fall back to intervals.icu
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
              // Use fallback
            }
          }

          // Build workout athlete context
          const workoutContext: WorkoutAthleteContext = {
            ftp: athleteFTP,
            weight_kg: weightKg,
            ctl: currentCTL,
            atl: currentATL,
            tsb: currentTSB,
          }

          // If type is 'any', get suggested type
          let requestedType: WorkoutCategory | 'any' = type as WorkoutCategory | 'any'
          let suggestedReason = ''

          if (type === 'any') {
            const suggestion = suggestWorkoutType(workoutContext)
            requestedType = suggestion.suggested
            suggestedReason = suggestion.reason
          }

          // Get prescription
          const scored = prescribeWorkout({
            athlete: workoutContext,
            requested_type: requestedType,
            target_duration_minutes: durationMinutes,
            target_tss: targetTSS,
          })

          if (scored.length === 0) {
            return { error: 'No suitable workouts found for your current context.' }
          }

          const best = scored[0]
          const workout = best.workout

          // Build response
          const response: {
            workout: {
              id: string
              name: string
              category: string
              duration_minutes: number
              target_tss_range: [number, number]
              description: string
              purpose: string
              execution_tips: string[]
              common_mistakes: string[]
              intervals?: {
                sets: number
                duration_seconds: number
                rest_seconds: number
                target_power_min: number
                target_power_max: number
              }[]
            }
            scoring: {
              score: number
              reasons: string[]
              warnings: string[]
            }
            context: {
              currentTSB: number
              currentCTL: number
              currentATL: number
              ftp: number
              selectedBecause: string
              fitnessSource: string
            }
            alternatives?: Array<{
              id: string
              name: string
              category: string
              score: number
              duration_minutes: number
            }>
            libraryStats: {
              totalWorkouts: number
              availableCategories: string[]
            }
          } = {
            workout: {
              id: workout.id,
              name: workout.name,
              category: workout.category,
              duration_minutes: workout.duration_minutes,
              target_tss_range: workout.target_tss_range,
              description: best.personalized_description,
              purpose: workout.purpose,
              execution_tips: workout.execution_tips,
              common_mistakes: workout.common_mistakes,
              intervals: best.personalized_intervals,
            },
            scoring: {
              score: best.score,
              reasons: best.reasons,
              warnings: best.warnings,
            },
            context: {
              currentTSB: Math.round(currentTSB),
              currentCTL: Math.round(currentCTL),
              currentATL: Math.round(currentATL),
              ftp: athleteFTP,
              selectedBecause: type === 'any'
                ? suggestedReason
                : `You requested a ${type} workout. Selected "${workout.name}" as best match (score: ${best.score}).`,
              fitnessSource,
            },
            libraryStats: {
              totalWorkouts: workoutLibrary.length,
              availableCategories: ['recovery', 'endurance', 'tempo', 'sweetspot', 'threshold', 'vo2max', 'anaerobic', 'sprint'],
            },
          }

          // Add alternatives if requested
          if (showAlternatives && scored.length > 1) {
            response.alternatives = scored.slice(1, 4).map(s => ({
              id: s.workout.id,
              name: s.workout.name,
              category: s.workout.category,
              score: s.score,
              duration_minutes: s.workout.duration_minutes,
            }))
          }

          return response
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

      // Tool 7 & 8: Athlete Memory (personalization)
      ...(ENABLE_MEMORY ? {
        getAthleteMemory: {
          description: 'Retrieve stored information about the athlete including preferences, patterns, injuries, goals, and past feedback. Use this to personalize advice and remember what works for this athlete.',
          inputSchema: z.object({
            types: z.array(z.enum([
              'preference', 'pattern', 'injury', 'lifestyle', 'feedback', 'achievement', 'goal', 'context'
            ])).optional().describe('Filter by memory types. If not provided, returns all types.'),
            limit: z.number().optional().describe('Maximum number of memories to return. Default is 20.'),
          }),
          execute: async ({ types, limit }: { types?: MemoryType[]; limit?: number }) => {
            if (!athleteId) {
              return { error: 'No athlete ID available' }
            }

            try {
              const memories = await getMemories(athleteId, {
                types,
                limit: limit || 20,
              })

              if (memories.length === 0) {
                return {
                  message: 'No stored memories for this athlete yet. As you learn about them, use saveAthleteMemory to record important information.',
                  memories: [],
                }
              }

              return {
                memories: memories.map(m => ({
                  type: m.memory_type,
                  content: m.content,
                  confidence: m.confidence,
                  source: m.source,
                  createdAt: m.created_at,
                })),
                count: memories.length,
                tip: 'Use these memories to personalize your advice. Update or add memories as you learn more.',
              }
            } catch (error) {
              console.error('[getAthleteMemory] Error:', error)
              return { error: 'Failed to retrieve memories' }
            }
          },
        },

        saveAthleteMemory: {
          description: 'Save important information about the athlete for future reference. Use when the athlete shares preferences, goals, injuries, patterns, or any information that should inform future advice.',
          inputSchema: z.object({
            memoryType: z.enum([
              'preference', 'pattern', 'injury', 'lifestyle', 'feedback', 'achievement', 'goal', 'context'
            ]).describe('Type of memory: preference (likes/dislikes), pattern (what works for them), injury (health issues), lifestyle (schedule/constraints), feedback (reactions to suggestions), achievement (milestones), goal (targets), context (equipment/setup)'),
            content: z.string().describe('The information to remember. Be specific and actionable.'),
            confidence: z.number().min(0).max(1).optional().describe('Confidence level 0-1. Use lower values for inferred information, higher for explicitly stated.'),
            source: z.enum(['user_stated', 'ai_inferred', 'data_derived']).optional().describe('How this was learned: user_stated (athlete told you), ai_inferred (you concluded), data_derived (from training data)'),
          }),
          execute: async ({
            memoryType,
            content,
            confidence,
            source,
          }: {
            memoryType: MemoryType
            content: string
            confidence?: number
            source?: MemorySource
          }) => {
            if (!athleteId) {
              return { error: 'No athlete ID available' }
            }

            try {
              const memory = await upsertMemory(athleteId, {
                memory_type: memoryType,
                content,
                confidence: confidence ?? (source === 'ai_inferred' ? 0.8 : 1.0),
                source: source ?? 'user_stated',
              })

              if (!memory) {
                return { error: 'Failed to save memory' }
              }

              return {
                success: true,
                memory: {
                  id: memory.id,
                  type: memory.memory_type,
                  content: memory.content,
                  confidence: memory.confidence,
                },
                message: `Saved ${memoryType} memory: "${content.slice(0, 50)}${content.length > 50 ? '...' : ''}"`,
              }
            } catch (error) {
              console.error('[saveAthleteMemory] Error:', error)
              return { error: 'Failed to save memory' }
            }
          },
        },
      } : {}),

      // Tool 9: Get recovery trends
      getRecoveryTrends: {
        description: 'Get sleep, HRV, and resting HR trends over a time period. Use when analyzing recovery patterns, correlating recovery with performance, or understanding how sleep affects training.',
        inputSchema: z.object({
          days: z.number().optional().describe('Number of days to analyze (default 30, max 90)'),
        }),
        execute: async ({ days = 30 }: { days?: number }) => {
          const lookbackDays = Math.min(days, 90)

          // Try local Supabase first
          if (USE_LOCAL_DATA && athleteId) {
            try {
              const history = await getFitnessHistory(athleteId, lookbackDays)
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
                    sleepTrend: avgSleep && recent7AvgSleep
                      ? (recent7AvgSleep > avgSleep ? 'improving' : recent7AvgSleep < avgSleep ? 'declining' : 'stable')
                      : null,
                    hrvTrend: avgHrv && recent7AvgHrv
                      ? (recent7AvgHrv > avgHrv ? 'improving' : recent7AvgHrv < avgHrv ? 'declining' : 'stable')
                      : null,
                    restingHrTrend: avgRestingHr && recent7AvgHr
                      ? (recent7AvgHr < avgRestingHr ? 'improving' : recent7AvgHr > avgRestingHr ? 'elevated' : 'stable')
                      : null,
                  },
                  source: 'local',
                }
              }
            } catch {
              // Fall through to intervals.icu
            }
          }

          // Fall back to intervals.icu
          if (!intervalsConnected) {
            return { error: 'intervals.icu not connected. Cannot fetch recovery data.' }
          }

          try {
            const { oldest, newest } = getDateRange(lookbackDays)
            const wellness = await intervalsClient.getWellness(oldest, newest)

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
                sleepTrend: avgSleep && recent7AvgSleep
                  ? (recent7AvgSleep > avgSleep ? 'improving' : recent7AvgSleep < avgSleep ? 'declining' : 'stable')
                  : null,
                hrvTrend: avgHrv && recent7AvgHrv
                  ? (recent7AvgHrv > avgHrv ? 'improving' : recent7AvgHrv < avgHrv ? 'declining' : 'stable')
                  : null,
                restingHrTrend: avgRestingHr && recent7AvgHr
                  ? (recent7AvgHr < avgRestingHr ? 'improving' : recent7AvgHr > avgRestingHr ? 'elevated' : 'stable')
                  : null,
              },
              source: 'intervals_icu',
            }
          } catch (error) {
            return { error: `Failed to fetch recovery trends: ${error instanceof Error ? error.message : 'Unknown error'}` }
          }
        },
      },

      // Tool 10: Get active insights (requires ENABLE_INSIGHTS)
      ...(ENABLE_INSIGHTS ? {
        getActiveInsights: {
          description: 'Get active insights and alerts detected from training data. Call this at the START of conversations to check for important patterns that need attention. Lead with urgent/high priority insights.',
          inputSchema: z.object({
            includeRead: z.boolean().optional().describe('Include already-read insights (default: false)'),
            limit: z.number().optional().describe('Maximum insights to return (default: 10)'),
          }),
          execute: async ({ includeRead = false, limit = 10 }: { includeRead?: boolean; limit?: number }) => {
            if (!athleteId) {
              return { error: 'No athlete ID available' }
            }

            try {
              const insights = await getInsights(athleteId, {
                limit,
                includeRead,
              })

              if (insights.length === 0) {
                return {
                  message: 'No active insights. Training appears to be progressing normally.',
                  insights: [],
                }
              }

              // Group by priority
              const urgent = insights.filter(i => i.priority === 'urgent')
              const high = insights.filter(i => i.priority === 'high')
              const medium = insights.filter(i => i.priority === 'medium')
              const low = insights.filter(i => i.priority === 'low')

              return {
                totalCount: insights.length,
                byPriority: {
                  urgent: urgent.length,
                  high: high.length,
                  medium: medium.length,
                  low: low.length,
                },
                insights: insights.map(i => ({
                  id: i.id,
                  type: i.insight_type,
                  priority: i.priority,
                  title: i.title,
                  content: i.content,
                  createdAt: i.created_at,
                })),
                tip: urgent.length > 0 || high.length > 0
                  ? 'IMPORTANT: Lead your response with the urgent/high priority insights. These need immediate attention.'
                  : 'Mention relevant insights naturally in your response.',
              }
            } catch (error) {
              console.error('[getActiveInsights] Error:', error)
              return { error: 'Failed to retrieve insights' }
            }
          },
        },
      } : {}),

      // Tool 11: Log workout outcome (for learning)
      logWorkoutOutcome: {
        description: 'Log the outcome of a workout - what was suggested vs what actually happened. Use this when the athlete reports how a workout went, provides feedback on a suggestion, or shares their perceived effort (RPE). This helps learn what works for this athlete.',
        inputSchema: z.object({
          sessionId: z.string().optional().describe('The session ID if linking to a completed workout'),
          suggestedWorkout: z.string().optional().describe('Description of what was suggested'),
          suggestedType: z.string().optional().describe('Type of workout that was suggested (e.g., sweetspot_2x20)'),
          actualType: z.string().optional().describe('Type of workout actually performed'),
          followedSuggestion: z.boolean().optional().describe('Did the athlete follow the suggestion?'),
          rpe: z.number().min(1).max(10).optional().describe('Perceived effort 1-10 (1=very easy, 10=maximal)'),
          feedback: z.string().optional().describe('Any feedback from the athlete about the workout'),
        }),
        execute: async ({
          sessionId,
          suggestedWorkout,
          suggestedType,
          actualType,
          followedSuggestion,
          rpe,
          feedback,
        }: {
          sessionId?: string
          suggestedWorkout?: string
          suggestedType?: string
          actualType?: string
          followedSuggestion?: boolean
          rpe?: number
          feedback?: string
        }) => {
          if (!athleteId) {
            return { error: 'No athlete ID available' }
          }

          try {
            const outcome = await logOutcome(athleteId, {
              session_id: sessionId,
              suggested_workout: suggestedWorkout,
              suggested_type: suggestedType,
              actual_type: actualType,
              followed_suggestion: followedSuggestion,
              rpe,
              feedback,
            })

            if (!outcome) {
              return { error: 'Failed to log outcome' }
            }

            // Get updated stats
            const stats = await getOutcomeStats(athleteId, 90)

            return {
              success: true,
              outcome: {
                id: outcome.id,
                rpe: outcome.rpe,
                feedback: outcome.feedback,
                followedSuggestion: outcome.followed_suggestion,
              },
              stats: {
                totalLogged: stats.totalOutcomes,
                followRate: stats.totalOutcomes > 0
                  ? Math.round((stats.followedSuggestions / stats.totalOutcomes) * 100)
                  : null,
                averageRPE: stats.averageRPE,
              },
              message: `Logged workout outcome${rpe ? ` (RPE: ${rpe})` : ''}${feedback ? ` with feedback` : ''}`,
            }
          } catch (error) {
            console.error('[logWorkoutOutcome] Error:', error)
            return { error: 'Failed to log workout outcome' }
          }
        },
      },

      // Tool 12: Analyze Power Curve
      analyzePowerCurve: {
        description: 'Analyze the athlete\'s power curve to identify strengths, limiters, and rider profile. Compares peak power at key durations (5s, 1min, 5min, 20min) and identifies whether the athlete is a sprinter, time trialist, climber, or all-rounder.',
        inputSchema: z.object({
          period: z.enum(['30d', '90d', '180d', '365d']).optional().describe('Time period to analyze (default 90d)'),
          compareToPrevious: z.boolean().optional().describe('Compare to previous period of same length'),
        }),
        execute: async ({ period = '90d', compareToPrevious = true }: { period?: string; compareToPrevious?: boolean }) => {
          const periodDays = { '30d': 30, '90d': 90, '180d': 180, '365d': 365 }[period] || 90

          // Key durations to analyze (in seconds)
          const keyDurations = [
            { secs: 5, label: '5s', category: 'neuromuscular' },
            { secs: 60, label: '1min', category: 'anaerobic' },
            { secs: 300, label: '5min', category: 'vo2max' },
            { secs: 1200, label: '20min', category: 'threshold' },
          ]

          // Get FTP for context
          let athleteFTP = 250
          try {
            const ctx = JSON.parse(athleteContext || '{}')
            athleteFTP = ctx.athlete?.ftp || 250
          } catch {
            // Use default
          }

          // Try to get power data from sessions
          let currentPeaks: Record<string, number> = {}
          let previousPeaks: Record<string, number> = {}
          let dataSource = 'none'

          // Try local Supabase first
          if (USE_LOCAL_DATA && athleteId) {
            try {
              const endDate = new Date()
              const startDate = new Date()
              startDate.setDate(startDate.getDate() - periodDays)

              const sessions = await getSessions(athleteId, {
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                limit: 500,
              })

              // Calculate peaks from max_power (simplified - real implementation would use streams)
              if (sessions.length > 0) {
                const maxPower = Math.max(...sessions.filter(s => s.max_power).map(s => s.max_power || 0))
                const avgNP = sessions.filter(s => s.normalized_power).reduce((sum, s) => sum + (s.normalized_power || 0), 0) / sessions.filter(s => s.normalized_power).length

                // Estimate peaks based on available data (simplified)
                currentPeaks = {
                  '5s': maxPower,
                  '1min': Math.round(maxPower * 0.75),
                  '5min': Math.round(avgNP * 1.1),
                  '20min': Math.round(athleteFTP * 1.05),
                }
                dataSource = 'local_estimated'
              }
            } catch {
              // Fall through
            }
          }

          // Fall back to intervals.icu for actual power curve data
          if (intervalsConnected && dataSource === 'none') {
            try {
              const { oldest, newest } = getDateRange(periodDays)
              const powerCurves = await intervalsClient.getPowerCurves(oldest, newest)

              if (powerCurves && powerCurves.length > 0) {
                // Find peaks at key durations
                for (const duration of keyDurations) {
                  const match = powerCurves.find(pc => pc.secs === duration.secs)
                  if (match) {
                    currentPeaks[duration.label] = match.watts
                  }
                }
                dataSource = 'intervals_icu'
              }

              // Get previous period if requested
              if (compareToPrevious) {
                const prevEnd = new Date()
                prevEnd.setDate(prevEnd.getDate() - periodDays)
                const prevStart = new Date()
                prevStart.setDate(prevStart.getDate() - (periodDays * 2))

                const prevCurves = await intervalsClient.getPowerCurves(
                  prevStart.toISOString().split('T')[0],
                  prevEnd.toISOString().split('T')[0]
                )

                if (prevCurves && prevCurves.length > 0) {
                  for (const duration of keyDurations) {
                    const match = prevCurves.find(pc => pc.secs === duration.secs)
                    if (match) {
                      previousPeaks[duration.label] = match.watts
                    }
                  }
                }
              }
            } catch (error) {
              console.error('[analyzePowerCurve] Error fetching power curves:', error)
            }
          }

          if (Object.keys(currentPeaks).length === 0) {
            return { error: 'No power data available. Ensure intervals.icu is connected or you have recent sessions with power data.' }
          }

          // Calculate W/kg if we have weight
          let weightKg = 70
          try {
            const ctx = JSON.parse(athleteContext || '{}')
            weightKg = ctx.athlete?.weight_kg || 70
          } catch {
            // Use default
          }

          // Analyze rider profile
          const profileScores = {
            sprinter: 0,
            pursuiter: 0,
            climber: 0,
            ttSpecialist: 0,
          }

          // Score based on relative strengths
          const fiveSecWkg = (currentPeaks['5s'] || 0) / weightKg
          const oneMinWkg = (currentPeaks['1min'] || 0) / weightKg
          const fiveMinWkg = (currentPeaks['5min'] || 0) / weightKg
          const twentyMinWkg = (currentPeaks['20min'] || 0) / weightKg

          // Sprinter: strong 5s and 1min relative to FTP
          if (fiveSecWkg > 15) profileScores.sprinter += 2
          if (fiveSecWkg > 18) profileScores.sprinter += 2
          if (currentPeaks['5s'] && currentPeaks['20min'] && currentPeaks['5s'] / currentPeaks['20min'] > 3.5) profileScores.sprinter += 2

          // Pursuiter: strong 1min relative to others
          if (oneMinWkg > 7) profileScores.pursuiter += 2
          if (oneMinWkg > 8.5) profileScores.pursuiter += 2

          // Climber: strong 5min and 20min W/kg
          if (fiveMinWkg > 5) profileScores.climber += 2
          if (fiveMinWkg > 6) profileScores.climber += 2
          if (twentyMinWkg > 4.5) profileScores.climber += 2

          // TT Specialist: strong 20min, good 5min
          if (twentyMinWkg > 4) profileScores.ttSpecialist += 2
          if (twentyMinWkg > 4.5) profileScores.ttSpecialist += 2
          if (fiveMinWkg > 5 && twentyMinWkg > 4) profileScores.ttSpecialist += 1

          // Determine profile
          const maxScore = Math.max(...Object.values(profileScores))
          let riderProfile = 'all-rounder'
          if (maxScore >= 4) {
            if (profileScores.sprinter === maxScore) riderProfile = 'sprinter'
            else if (profileScores.pursuiter === maxScore) riderProfile = 'pursuiter'
            else if (profileScores.climber === maxScore) riderProfile = 'climber'
            else if (profileScores.ttSpecialist === maxScore) riderProfile = 'TT specialist'
          }

          // Identify strengths and limiters
          const metrics = [
            { label: '5s (Neuromuscular)', value: fiveSecWkg, benchmark: 15 },
            { label: '1min (Anaerobic)', value: oneMinWkg, benchmark: 7 },
            { label: '5min (VO2max)', value: fiveMinWkg, benchmark: 5 },
            { label: '20min (Threshold)', value: twentyMinWkg, benchmark: 4 },
          ]

          const strengths = metrics.filter(m => m.value >= m.benchmark * 1.1).map(m => m.label)
          const limiters = metrics.filter(m => m.value < m.benchmark * 0.9).map(m => m.label)

          // Build comparison data
          const comparison = compareToPrevious && Object.keys(previousPeaks).length > 0
            ? keyDurations.map(d => ({
                duration: d.label,
                current: currentPeaks[d.label] || null,
                previous: previousPeaks[d.label] || null,
                change: currentPeaks[d.label] && previousPeaks[d.label]
                  ? Math.round(((currentPeaks[d.label] - previousPeaks[d.label]) / previousPeaks[d.label]) * 100)
                  : null,
              }))
            : null

          return {
            period: `${periodDays} days`,
            powerPeaks: keyDurations.map(d => ({
              duration: d.label,
              watts: currentPeaks[d.label] || null,
              wkg: currentPeaks[d.label] ? Math.round((currentPeaks[d.label] / weightKg) * 100) / 100 : null,
              category: d.category,
            })),
            comparison,
            profile: {
              type: riderProfile,
              strengths: strengths.length > 0 ? strengths : ['Balanced profile - no standout strengths'],
              limiters: limiters.length > 0 ? limiters : ['No significant limiters identified'],
            },
            recommendations: [
              limiters.includes('5min (VO2max)') ? 'Consider adding VO2max intervals (5x5, 4x4) to develop aerobic ceiling' : null,
              limiters.includes('20min (Threshold)') ? 'Focus on threshold and sweet spot work (2x20, over-unders) to build sustainable power' : null,
              limiters.includes('5s (Neuromuscular)') ? 'Include sprint work and neuromuscular efforts if sprinting is a goal' : null,
              strengths.includes('5min (VO2max)') && !strengths.includes('20min (Threshold)') ? 'Good VO2max base - convert to threshold power with sustained efforts' : null,
            ].filter(Boolean),
            dataSource,
            weightKg,
            ftp: athleteFTP,
          }
        },
      },

      // Tool 13: Analyze Efficiency Trends
      analyzeEfficiency: {
        description: 'Analyze aerobic efficiency trends using Efficiency Factor (NP/HR) and decoupling. Use to assess aerobic development, identify fitness improvements, and understand how well the athlete maintains power relative to heart rate over time.',
        inputSchema: z.object({
          days: z.number().optional().describe('Number of days to analyze (default 90, max 180)'),
        }),
        execute: async ({ days = 90 }: { days?: number }) => {
          const lookbackDays = Math.min(days, 180)

          // Get sessions with both NP and HR data
          let sessions: Array<{
            date: string
            np: number
            avgHr: number
            duration: number
            ef: number
            decoupling?: number
            type?: string
          }> = []
          let dataSource = 'none'

          // Try local Supabase first
          if (USE_LOCAL_DATA && athleteId) {
            try {
              const endDate = new Date()
              const startDate = new Date()
              startDate.setDate(startDate.getDate() - lookbackDays)

              const localSessions = await getSessions(athleteId, {
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                limit: 500,
              })

              sessions = localSessions
                .filter(s => s.normalized_power && s.avg_hr && s.avg_hr > 0)
                .map(s => ({
                  date: s.date,
                  np: s.normalized_power!,
                  avgHr: s.avg_hr!,
                  duration: s.duration_seconds,
                  ef: Math.round((s.normalized_power! / s.avg_hr!) * 100) / 100,
                  type: s.workout_type,
                }))

              if (sessions.length > 0) {
                dataSource = 'local'
              }
            } catch {
              // Fall through
            }
          }

          // Fall back to intervals.icu
          if (sessions.length === 0 && intervalsConnected) {
            try {
              const { oldest, newest } = getDateRange(lookbackDays)
              const activities = await intervalsClient.getActivities(oldest, newest)

              sessions = activities
                .filter(a => {
                  const np = getNormalizedPower(a)
                  return np && a.average_heartrate && a.average_heartrate > 0
                })
                .map(a => {
                  const np = getNormalizedPower(a) || 0
                  return {
                    date: a.start_date_local?.split('T')[0] || '',
                    np,
                    avgHr: a.average_heartrate,
                    duration: a.moving_time,
                    ef: Math.round((np / a.average_heartrate) * 100) / 100,
                    decoupling: a.decoupling,
                    type: a.type,
                  }
                })

              if (sessions.length > 0) {
                dataSource = 'intervals_icu'
              }
            } catch (error) {
              console.error('[analyzeEfficiency] Error:', error)
            }
          }

          if (sessions.length < 5) {
            return { error: 'Insufficient data for efficiency analysis. Need at least 5 sessions with power and heart rate data.' }
          }

          // Sort by date
          sessions.sort((a, b) => a.date.localeCompare(b.date))

          // Calculate overall statistics
          const allEF = sessions.map(s => s.ef)
          const avgEF = Math.round((allEF.reduce((a, b) => a + b, 0) / allEF.length) * 100) / 100
          const minEF = Math.min(...allEF)
          const maxEF = Math.max(...allEF)

          // Calculate trend (first half vs second half)
          const midpoint = Math.floor(sessions.length / 2)
          const firstHalfEF = sessions.slice(0, midpoint).map(s => s.ef)
          const secondHalfEF = sessions.slice(midpoint).map(s => s.ef)
          const firstHalfAvg = firstHalfEF.reduce((a, b) => a + b, 0) / firstHalfEF.length
          const secondHalfAvg = secondHalfEF.reduce((a, b) => a + b, 0) / secondHalfEF.length
          const efTrendPercent = Math.round(((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100)

          let efTrend: 'improving' | 'stable' | 'declining'
          if (efTrendPercent > 3) efTrend = 'improving'
          else if (efTrendPercent < -3) efTrend = 'declining'
          else efTrend = 'stable'

          // Analyze decoupling for long rides (>90 min)
          const longRides = sessions.filter(s => s.duration > 5400 && s.decoupling !== undefined)
          let decouplingAnalysis = null
          if (longRides.length >= 3) {
            const avgDecoupling = Math.round(longRides.reduce((sum, s) => sum + (s.decoupling || 0), 0) / longRides.length * 10) / 10
            decouplingAnalysis = {
              averageDecoupling: avgDecoupling,
              ridesAnalyzed: longRides.length,
              assessment: avgDecoupling < 3 ? 'excellent' : avgDecoupling < 5 ? 'good' : avgDecoupling < 8 ? 'fair' : 'needs work',
              interpretation: avgDecoupling < 5
                ? 'Good aerobic fitness - HR stays stable relative to power on long rides'
                : 'HR drifts relative to power - more Zone 2 work may help',
            }
          }

          // Get best and worst EF sessions
          const sortedByEF = [...sessions].sort((a, b) => b.ef - a.ef)
          const bestEFSessions = sortedByEF.slice(0, 3).map(s => ({
            date: s.date,
            ef: s.ef,
            np: s.np,
            avgHr: s.avgHr,
          }))
          const worstEFSessions = sortedByEF.slice(-3).reverse().map(s => ({
            date: s.date,
            ef: s.ef,
            np: s.np,
            avgHr: s.avgHr,
          }))

          // Weekly EF progression for charting
          const weeklyEF: Record<string, { total: number; count: number }> = {}
          sessions.forEach(s => {
            const weekStart = new Date(s.date)
            weekStart.setDate(weekStart.getDate() - weekStart.getDay())
            const weekKey = weekStart.toISOString().split('T')[0]
            if (!weeklyEF[weekKey]) weeklyEF[weekKey] = { total: 0, count: 0 }
            weeklyEF[weekKey].total += s.ef
            weeklyEF[weekKey].count++
          })

          const weeklyProgression = Object.entries(weeklyEF)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([week, data]) => ({
              week,
              avgEF: Math.round((data.total / data.count) * 100) / 100,
            }))

          return {
            period: `${lookbackDays} days`,
            sessionCount: sessions.length,
            summary: {
              averageEF: avgEF,
              minEF: Math.round(minEF * 100) / 100,
              maxEF: Math.round(maxEF * 100) / 100,
              trend: efTrend,
              trendPercent: efTrendPercent,
            },
            interpretation: {
              efMeaning: 'Efficiency Factor = NP/HR. Higher is better - more power for same heart rate.',
              currentLevel: avgEF > 1.8 ? 'excellent' : avgEF > 1.5 ? 'good' : avgEF > 1.2 ? 'developing' : 'needs work',
              trendInterpretation: efTrend === 'improving'
                ? 'Aerobic fitness is improving - producing more power for same HR'
                : efTrend === 'declining'
                ? 'Efficiency declining - may indicate fatigue, overtraining, or detraining'
                : 'Efficiency stable - fitness is maintained',
            },
            decouplingAnalysis,
            bestSessions: bestEFSessions,
            worstSessions: worstEFSessions,
            weeklyProgression,
            recommendations: [
              efTrend === 'declining' ? 'Consider a recovery week if efficiency is declining' : null,
              decouplingAnalysis && decouplingAnalysis.averageDecoupling > 5 ? 'Add more Zone 2 volume to improve aerobic base' : null,
              avgEF < 1.3 ? 'Focus on aerobic development - more easy endurance rides' : null,
            ].filter(Boolean),
            dataSource,
          }
        },
      },

      // Tool 14: Analyze Training Load (ACWR, Monotony, Strain)
      analyzeTrainingLoad: {
        description: 'Analyze training load metrics including ACWR (acute:chronic workload ratio), monotony, and strain. Use to assess injury risk, training balance, and load management.',
        inputSchema: z.object({
          includeWeeklyBreakdown: z.boolean().optional().describe('Include week-by-week TSS breakdown'),
        }),
        execute: async ({ includeWeeklyBreakdown = true }: { includeWeeklyBreakdown?: boolean }) => {
          // Need at least 28 days for meaningful ACWR (7-day acute, 28-day chronic)
          const lookbackDays = 42 // 6 weeks for good context

          // Get fitness data and sessions
          let dailyTSS: Array<{ date: string; tss: number }> = []
          let currentCTL = 0
          let currentATL = 0
          let dataSource = 'none'

          // Try local Supabase first
          if (USE_LOCAL_DATA && athleteId) {
            try {
              const [fitnessHistory, sessions] = await Promise.all([
                getFitnessHistory(athleteId, lookbackDays),
                getSessions(athleteId, {
                  startDate: new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                  limit: 500,
                }),
              ])

              if (fitnessHistory.length > 0) {
                const latest = fitnessHistory[fitnessHistory.length - 1]
                currentCTL = latest.ctl
                currentATL = latest.atl

                // Build daily TSS from fitness history
                dailyTSS = fitnessHistory.map(f => ({
                  date: f.date,
                  tss: f.tss_day || 0,
                }))
                dataSource = 'local'
              } else if (sessions.length > 0) {
                // Aggregate sessions by date
                const tssbyDate: Record<string, number> = {}
                sessions.forEach(s => {
                  if (!tssbyDate[s.date]) tssbyDate[s.date] = 0
                  tssbyDate[s.date] += s.tss || 0
                })
                dailyTSS = Object.entries(tssbyDate)
                  .map(([date, tss]) => ({ date, tss }))
                  .sort((a, b) => a.date.localeCompare(b.date))
                dataSource = 'local'
              }
            } catch {
              // Fall through
            }
          }

          // Fall back to intervals.icu
          if (dailyTSS.length < 7 && intervalsConnected) {
            try {
              const { oldest, newest } = getDateRange(lookbackDays)
              const [wellness, activities] = await Promise.all([
                intervalsClient.getWellness(oldest, newest),
                intervalsClient.getActivities(oldest, newest),
              ])

              if (wellness.length > 0) {
                const latest = wellness[wellness.length - 1]
                currentCTL = latest.ctl
                currentATL = latest.atl
              }

              // Aggregate activities by date
              const tssbyDate: Record<string, number> = {}
              activities.forEach(a => {
                const date = a.start_date_local?.split('T')[0]
                if (date) {
                  if (!tssbyDate[date]) tssbyDate[date] = 0
                  tssbyDate[date] += a.icu_training_load || 0
                }
              })
              dailyTSS = Object.entries(tssbyDate)
                .map(([date, tss]) => ({ date, tss }))
                .sort((a, b) => a.date.localeCompare(b.date))
              dataSource = 'intervals_icu'
            } catch (error) {
              console.error('[analyzeTrainingLoad] Error:', error)
            }
          }

          if (dailyTSS.length < 14) {
            return { error: 'Insufficient data for training load analysis. Need at least 2 weeks of training data.' }
          }

          // Fill in missing dates with 0 TSS
          const filledTSS: Array<{ date: string; tss: number }> = []
          const startDate = new Date(dailyTSS[0].date)
          const endDate = new Date(dailyTSS[dailyTSS.length - 1].date)
          const tssMap = new Map(dailyTSS.map(d => [d.date, d.tss]))

          for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0]
            filledTSS.push({ date: dateStr, tss: tssMap.get(dateStr) || 0 })
          }

          // Calculate ACWR using last 7 days (acute) vs last 28 days (chronic)
          const last7Days = filledTSS.slice(-7)
          const last28Days = filledTSS.slice(-28)

          const acuteLoad = last7Days.reduce((sum, d) => sum + d.tss, 0) / 7
          const chronicLoad = last28Days.reduce((sum, d) => sum + d.tss, 0) / 28
          const acwr = chronicLoad > 0 ? Math.round((acuteLoad / chronicLoad) * 100) / 100 : 0

          // ACWR risk assessment
          let acwrRisk: 'low' | 'moderate' | 'high' | 'very_high'
          let acwrStatus: string
          if (acwr < 0.8) {
            acwrRisk = 'low'
            acwrStatus = 'Under-training zone - may be losing fitness'
          } else if (acwr <= 1.3) {
            acwrRisk = 'low'
            acwrStatus = 'Sweet spot - optimal balance of load and recovery'
          } else if (acwr <= 1.5) {
            acwrRisk = 'moderate'
            acwrStatus = 'Caution zone - elevated injury/overtraining risk'
          } else {
            acwrRisk = 'high'
            acwrStatus = 'Danger zone - high injury/overtraining risk, consider reducing load'
          }

          // Calculate monotony (standard deviation of daily load)
          const recentWeek = filledTSS.slice(-7).map(d => d.tss)
          const weekAvg = recentWeek.reduce((a, b) => a + b, 0) / 7
          const weekVariance = recentWeek.reduce((sum, tss) => sum + Math.pow(tss - weekAvg, 2), 0) / 7
          const weekStdDev = Math.sqrt(weekVariance)
          const monotony = weekStdDev > 0 ? Math.round((weekAvg / weekStdDev) * 100) / 100 : 0

          let monotonyAssessment: string
          if (monotony < 1.5) monotonyAssessment = 'Good variety - training load varies appropriately day to day'
          else if (monotony < 2.0) monotonyAssessment = 'Moderate monotony - consider adding more variation'
          else monotonyAssessment = 'High monotony - training too repetitive, risk of staleness'

          // Calculate strain (weekly load × monotony)
          const weeklyLoad = recentWeek.reduce((a, b) => a + b, 0)
          const strain = Math.round(weeklyLoad * monotony)

          let strainAssessment: string
          if (strain < 3000) strainAssessment = 'Low strain - room for more training'
          else if (strain < 6000) strainAssessment = 'Moderate strain - sustainable training load'
          else if (strain < 10000) strainAssessment = 'High strain - monitor recovery carefully'
          else strainAssessment = 'Very high strain - consider a recovery period'

          // Weekly breakdown if requested
          let weeklyBreakdown: Array<{
            week: string
            totalTSS: number
            sessions: number
            avgTSS: number
          }> | null = null

          if (includeWeeklyBreakdown) {
            const weeklyData: Record<string, { tss: number; count: number }> = {}
            filledTSS.forEach(d => {
              const date = new Date(d.date)
              const weekStart = new Date(date)
              weekStart.setDate(date.getDate() - date.getDay())
              const weekKey = weekStart.toISOString().split('T')[0]
              if (!weeklyData[weekKey]) weeklyData[weekKey] = { tss: 0, count: 0 }
              weeklyData[weekKey].tss += d.tss
              if (d.tss > 0) weeklyData[weekKey].count++
            })

            weeklyBreakdown = Object.entries(weeklyData)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([week, data]) => ({
                week,
                totalTSS: Math.round(data.tss),
                sessions: data.count,
                avgTSS: data.count > 0 ? Math.round(data.tss / data.count) : 0,
              }))
          }

          // Calculate TSB trend
          const tsb = currentCTL - currentATL
          let tsbStatus: string
          if (tsb < -25) tsbStatus = 'Very fatigued - consider recovery'
          else if (tsb < -10) tsbStatus = 'Fatigued - building fitness, normal for hard training'
          else if (tsb < 5) tsbStatus = 'Neutral - good training zone'
          else if (tsb < 25) tsbStatus = 'Fresh - ready for hard efforts or racing'
          else tsbStatus = 'Very fresh - may be losing fitness'

          return {
            currentFitness: {
              ctl: Math.round(currentCTL),
              atl: Math.round(currentATL),
              tsb: Math.round(tsb),
              tsbStatus,
            },
            acwr: {
              value: acwr,
              acuteLoad: Math.round(acuteLoad),
              chronicLoad: Math.round(chronicLoad),
              risk: acwrRisk,
              status: acwrStatus,
              recommendation: acwr > 1.3 ? 'Consider reducing this week\'s load' : acwr < 0.8 ? 'Safe to increase training load' : 'Maintain current load progression',
            },
            monotony: {
              value: monotony,
              assessment: monotonyAssessment,
            },
            strain: {
              value: strain,
              weeklyTSS: weeklyLoad,
              assessment: strainAssessment,
            },
            weeklyBreakdown,
            recommendations: [
              acwr > 1.5 ? 'URGENT: Reduce training load to prevent injury/overtraining' : null,
              acwr > 1.3 ? 'Consider an easier week to bring ACWR into optimal range' : null,
              monotony > 2.0 ? 'Add more variety to your training - mix hard and easy days' : null,
              strain > 8000 ? 'High strain detected - prioritize sleep and recovery' : null,
              tsb < -25 ? 'Deep fatigue - schedule a recovery day or easy week soon' : null,
            ].filter(Boolean),
            dataSource,
          }
        },
      },

      // Tool 15: Generate Training Plan
      generateTrainingPlan: {
        description: 'Generate a structured multi-week training plan tailored to the athlete\'s goals and current fitness. Creates a complete periodized plan with daily workouts, recovery weeks, and progression. Use when the athlete wants a structured training plan or asks about building toward an event.',
        inputSchema: z.object({
          goal: z.enum(['base_build', 'ftp_build', 'event_prep', 'taper', 'maintenance']).optional()
            .describe('Training goal: base_build (aerobic foundation), ftp_build (increase FTP), event_prep (prepare for goal event), taper (pre-race), maintenance (hold fitness)'),
          templateId: z.string().optional()
            .describe('Specific plan template ID if known (e.g., "base_build_4week", "ftp_build_8week", "taper_3week", "event_prep_12week")'),
          startDate: z.string().optional()
            .describe('Plan start date in YYYY-MM-DD format. Defaults to next Monday.'),
          weeklyHoursTarget: z.number().optional()
            .describe('Target training hours per week (default: 8)'),
          keyWorkoutDays: z.array(z.number()).optional()
            .describe('Days of week for key workouts as array (0=Sun, 1=Mon, ..., 6=Sat). Default: [2,4,6] for Tue/Thu/Sat'),
          targetEventDate: z.string().optional()
            .describe('Target event date in YYYY-MM-DD format (helps with taper timing)'),
          showAvailablePlans: z.boolean().optional()
            .describe('Set to true to see all available plan templates instead of generating a plan'),
        }),
        execute: async ({
          goal,
          templateId,
          startDate,
          weeklyHoursTarget,
          keyWorkoutDays,
          targetEventDate,
          showAvailablePlans = false,
        }: {
          goal?: PlanGoal
          templateId?: string
          startDate?: string
          weeklyHoursTarget?: number
          keyWorkoutDays?: number[]
          targetEventDate?: string
          showAvailablePlans?: boolean
        }) => {
          // Gather athlete context
          let athleteFTP = 250
          let weightKg = 70
          let currentCTL = 50
          let currentATL = 50
          let fitnessSource = 'default'

          // Try to get FTP and weight from athlete context
          try {
            const ctx = JSON.parse(athleteContext || '{}')
            athleteFTP = ctx.athlete?.ftp || 250
            weightKg = ctx.athlete?.weight_kg || 70
            if (ctx.currentFitness) {
              currentCTL = ctx.currentFitness.ctl || 50
              currentATL = ctx.currentFitness.atl || 50
              fitnessSource = 'context'
            }
          } catch {
            // Use defaults
          }

          // Try local Supabase
          if (USE_LOCAL_DATA && athleteId) {
            try {
              const localFitness = await getCurrentFitness(athleteId)
              if (localFitness) {
                currentCTL = localFitness.ctl
                currentATL = localFitness.atl
                fitnessSource = 'local'
              }
            } catch {
              // Fall through
            }
          }

          // Fall back to intervals.icu
          if (fitnessSource !== 'local' && intervalsConnected) {
            try {
              const today = formatDateForApi(new Date())
              const wellness = await intervalsClient.getWellnessForDate(today)
              if (wellness) {
                currentCTL = wellness.ctl
                currentATL = wellness.atl
                fitnessSource = 'intervals_icu'
              }
            } catch {
              // Use fallback
            }
          }

          // If just listing available plans
          if (showAvailablePlans) {
            const available = getAvailablePlans(currentCTL)
            return {
              currentFitness: {
                ctl: Math.round(currentCTL),
                atl: Math.round(currentATL),
                ftp: athleteFTP,
              },
              availablePlans: available,
              totalPlans: planTemplates.length,
              recommendation: available.filter(p => p.isApplicable).length > 0
                ? `You have ${available.filter(p => p.isApplicable).length} plans available at your current fitness level.`
                : 'Build fitness first - your CTL is below minimum for most plans.',
            }
          }

          // Calculate default start date (next Monday)
          let planStartDate = startDate
          if (!planStartDate) {
            const today = new Date()
            const daysUntilMonday = (8 - today.getDay()) % 7 || 7
            const nextMonday = new Date(today)
            nextMonday.setDate(today.getDate() + daysUntilMonday)
            planStartDate = nextMonday.toISOString().split('T')[0]
          }

          // Fetch athlete patterns for personalization (if available)
          let patterns = undefined
          if (athleteId) {
            try {
              patterns = await analyzeAthletePatterns(athleteId, { days: 90, saveAsMemories: false })
              if (patterns.dataPoints < 5) patterns = undefined // Not enough data
            } catch {
              // Patterns not available, continue without them
            }
          }

          // Generate the plan
          const result = generateTrainingPlan({
            templateId,
            goal,
            startDate: planStartDate,
            weeklyHoursTarget,
            keyWorkoutDays,
            targetEventDate,
            athleteContext: {
              ftp: athleteFTP,
              ctl: currentCTL,
              atl: currentATL,
              weight_kg: weightKg,
            },
            patterns,
          })

          if (!result.success || !result.plan) {
            return {
              error: result.error || 'Failed to generate plan',
              warnings: result.warnings,
              availablePlans: getAvailablePlans(currentCTL),
            }
          }

          const plan = result.plan

          // Build a summary suitable for chat response
          const weekSummaries = plan.weeks.map(w => ({
            week: w.weekNumber,
            phase: w.phase,
            focus: w.focusDescription,
            targetTSS: w.actualTargetTSS,
            keyWorkouts: w.days
              .filter(d => d.isKeyWorkout && d.workout)
              .map(d => ({
                day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.dayOfWeek],
                workout: d.workout?.name,
                category: d.workout?.category,
                tss: d.workout?.targetTSS,
              })),
          }))

          // Sample first week's details
          const firstWeekDetails = plan.weeks[0]?.days
            .filter(d => d.workout !== null)
            .slice(0, 3)
            .map(d => ({
              date: d.date,
              day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.dayOfWeek],
              workout: d.workout?.name,
              description: d.workout?.description,
              targetTSS: d.workout?.targetTSS,
              targetDuration: d.workout?.targetDurationMinutes,
              intervals: d.workout?.intervals?.map(i => ({
                sets: i.sets,
                duration: `${Math.round(i.durationSeconds / 60)} min`,
                power: `${i.targetPowerMin}-${i.targetPowerMax}W`,
              })),
            }))

          return {
            success: true,
            plan: {
              name: plan.templateName,
              goal: plan.goal,
              description: plan.description,
              duration: `${plan.durationWeeks} weeks`,
              dates: `${plan.startDate} to ${plan.endDate}`,
              targetEvent: plan.targetEventDate,
            },
            summary: {
              totalWorkoutDays: plan.summary.totalWorkoutDays,
              totalRestDays: plan.summary.totalRestDays,
              avgWeeklyTSS: plan.summary.avgWeeklyTSS,
              phases: plan.summary.phases,
            },
            weekOverview: weekSummaries,
            firstWeekSample: firstWeekDetails,
            athleteContext: {
              ctl: Math.round(currentCTL),
              atl: Math.round(currentATL),
              ftp: athleteFTP,
              fitnessSource,
            },
            warnings: result.warnings,
            tip: 'This plan is generated based on your current fitness. Review the week-by-week structure and let me know if you want to adjust intensity, add rest days, or modify any workouts.',
          }
        },
      },

      // Tool 16: Analyze athlete patterns (outcome learning)
      analyzePatterns: {
        description: 'Analyze the athlete\'s training outcome patterns to understand what works best for them. Looks at recovery rate, optimal TSB range, best days for intensity, volume vs intensity preferences, and workout type success rates. Patterns are automatically saved as memories for future personalization.',
        inputSchema: z.object({
          days: z.number().optional().describe('Number of days to analyze (default: 90)'),
          saveAsMemories: z.boolean().optional().describe('Save discovered patterns as athlete memories (default: true)'),
        }),
        execute: async ({ days = 90, saveAsMemories = true }: { days?: number; saveAsMemories?: boolean }) => {
          if (!athleteId) {
            return { error: 'No athlete ID available. Pattern analysis requires a logged-in user.' }
          }

          try {
            const patterns = await analyzeAthletePatterns(athleteId, { days, saveAsMemories })

            if (patterns.dataPoints < 5) {
              return {
                message: 'Not enough workout outcome data to detect patterns yet.',
                dataPoints: patterns.dataPoints,
                tip: 'Keep logging workout outcomes (RPE, feedback) using the logWorkoutOutcome tool. After about 10-15 outcomes, patterns will start emerging.',
              }
            }

            const summary = summarizePatterns(patterns)

            return {
              summary,
              dataPoints: patterns.dataPoints,
              analyzedAt: patterns.analyzedAt,
              patterns: {
                recovery: patterns.recovery ? {
                  averageDays: patterns.recovery.averageRecoveryDays,
                  profile: patterns.recovery.fastRecoverer ? 'fast' : patterns.recovery.slowRecoverer ? 'slow' : 'average',
                  confidence: Math.round(patterns.recovery.confidence * 100),
                } : null,
                optimalTSB: patterns.tsb ? {
                  range: `${patterns.tsb.optimalTSB.min} to ${patterns.tsb.optimalTSB.max}`,
                  peakTSB: patterns.tsb.peakPerformanceTSB,
                  riskZone: `${patterns.tsb.riskZone.min} to ${patterns.tsb.riskZone.max}`,
                  confidence: Math.round(patterns.tsb.confidence * 100),
                } : null,
                volumeIntensity: patterns.volumeIntensity ? {
                  preference: patterns.volumeIntensity.prefersVolume ? 'volume-focused' :
                    patterns.volumeIntensity.prefersIntensity ? 'intensity-focused' : 'balanced',
                  weeklyHoursSweet: patterns.volumeIntensity.weeklyHoursSweet,
                  confidence: Math.round(patterns.volumeIntensity.confidence * 100),
                } : null,
                dayOfWeek: patterns.dayOfWeek ? {
                  bestIntensityDays: patterns.dayOfWeek.bestIntensityDays,
                  avoidIntensityDays: patterns.dayOfWeek.avoidIntensityDays,
                  confidence: Math.round(patterns.dayOfWeek.confidence * 100),
                } : null,
                workoutTypes: patterns.workoutTypes.slice(0, 5).map(t => ({
                  type: t.workoutType,
                  completionRate: Math.round(t.completionRate * 100),
                  averageRPE: t.averageRPE,
                  bestDays: t.bestDays,
                  sampleSize: t.sampleSize,
                })),
              },
              memoriesSaved: saveAsMemories,
              tip: 'These patterns are now being used to personalize workout suggestions and training plans. Patterns update automatically as more outcomes are logged.',
            }
          } catch (error) {
            console.error('[analyzePatterns] Error:', error)
            return { error: 'Failed to analyze patterns' }
          }
        },
      },
    },
  })

  return result.toUIMessageStreamResponse()
}
