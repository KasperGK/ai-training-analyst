import { z } from 'zod'
import { defineTool } from './types'
import { getSessions } from '@/lib/db/sessions'
import { getRaceResults } from '@/lib/db/race-results'

const inputSchema = z.object({
  // Date-based filters
  dateFrom: z.string().optional().describe('Start date (YYYY-MM-DD) for date range search'),
  dateTo: z.string().optional().describe('End date (YYYY-MM-DD) for date range search'),
  daysBack: z.number().optional().describe('Number of days to look back from today (e.g., 7 for last week)'),

  // Name search
  nameSearch: z.string().optional()
    .describe('Search sessions by name (partial match). E.g. "Crit City", "Tour de Watopia"'),

  // Type-based filters
  sessionType: z.enum(['race', 'workout', 'endurance', 'recovery', 'any']).optional()
    .describe('Filter by session type. "race" finds high-intensity events, "workout" finds structured training'),

  // Characteristic filters
  minTSS: z.number().optional().describe('Minimum TSS'),
  maxTSS: z.number().optional().describe('Maximum TSS'),
  minDurationMinutes: z.number().optional().describe('Minimum duration in minutes'),
  minIntensityFactor: z.number().optional().describe('Minimum IF (e.g., 0.9 for race-level efforts)'),

  // Sorting and limits
  sortBy: z.enum(['date', 'tss', 'duration', 'intensity']).optional().describe('How to sort results'),
  limit: z.number().optional().describe('Max number of sessions to return (default 10)'),
})

type Input = z.infer<typeof inputSchema>

interface SessionSummary {
  id: string
  date: string
  name: string | null
  sport: string
  duration_minutes: number | null
  tss: number | null
  intensity_factor: number | null
  avg_power: number | null
  normalized_power: number | null
  avg_hr: number | null
  isLikelyRace: boolean
  source?: 'sessions' | 'zwiftpower'
  placement?: number | null
  totalInCategory?: number | null
  category?: string | null
}

interface Output {
  sessions: SessionSummary[]
  totalFound: number
  searchCriteria: string
}

/**
 * Determine if a session is likely a race based on characteristics
 */
function isLikelyRace(session: {
  workout_type?: string | null
  intensity_factor?: number | null
  tss?: number | null
  duration_seconds?: number | null
}): boolean {
  // Check name/type for race keywords
  const name = (session.workout_type || '').toLowerCase()
  if (name.includes('race') || name.includes('event') || name.includes('competition') ||
      name.includes('gran fondo') || name.includes('crit') || name.includes('tt ') ||
      name.includes('time trial') || name.includes('zwift racing') || name.includes('fondo') ||
      name.includes('series') || name.includes('championship') || name.includes('cup') ||
      name.includes('league') || name.includes('prix')) {
    return true
  }

  const durationMinutes = (session.duration_seconds || 0) / 60

  // High intensity factor suggests race effort (with duration guard: 15min-5hr)
  if (session.intensity_factor && session.intensity_factor > 0.85 &&
      durationMinutes >= 15 && durationMinutes <= 300) {
    return true
  }

  // High TSS relative to duration suggests race (>1.2 TSS per minute, with duration guard)
  if (session.tss && session.duration_seconds && durationMinutes >= 15 && durationMinutes <= 300) {
    const tssPerMinute = session.tss / durationMinutes
    if (tssPerMinute > 1.2) {
      return true
    }
  }

  return false
}

export const findSessions = defineTool<Input, Output>({
  description: `Search for sessions by various criteria including name search. Use this to find specific sessions like "last race", "Crit City race", "yesterday's ride", or "hardest workout this month".

When searching for races, this tool also checks the race_results table (ZwiftPower) for definitive race data including placement and category.

Common patterns:
- "last race" → sessionType: "race", limit: 1, sortBy: "date"
- "Crit City race" → nameSearch: "Crit City"
- "yesterday" → daysBack: 1
- "this week" → daysBack: 7
- "longest ride this month" → daysBack: 30, sortBy: "duration"
- "hardest workout" → sortBy: "intensity", limit: 1`,

  inputSchema,

  execute: async (input, ctx) => {
    console.log('[findSessions] Querying with athleteId:', ctx.athleteId)

    if (!ctx.athleteId) {
      console.log('[findSessions] No athleteId - returning empty')
      return {
        sessions: [],
        totalFound: 0,
        searchCriteria: 'No athlete connected',
      }
    }

    // Calculate date range
    let dateFrom: string | undefined = input.dateFrom
    let dateTo: string | undefined = input.dateTo

    if (input.daysBack) {
      const now = new Date()
      dateTo = now.toISOString().split('T')[0]
      const fromDate = new Date(now)
      fromDate.setDate(fromDate.getDate() - input.daysBack)
      dateFrom = fromDate.toISOString().split('T')[0]
    }

    // Build search criteria description
    const criteriaDesc: string[] = []
    if (dateFrom && dateTo) criteriaDesc.push(`${dateFrom} to ${dateTo}`)
    else if (dateFrom) criteriaDesc.push(`from ${dateFrom}`)
    else if (dateTo) criteriaDesc.push(`until ${dateTo}`)
    if (input.nameSearch) criteriaDesc.push(`name: "${input.nameSearch}"`)
    if (input.sessionType && input.sessionType !== 'any') criteriaDesc.push(`type: ${input.sessionType}`)
    if (input.minTSS) criteriaDesc.push(`TSS >= ${input.minTSS}`)
    if (input.minIntensityFactor) criteriaDesc.push(`IF >= ${input.minIntensityFactor}`)

    try {
      // Get sessions from database
      const allSessions = await getSessions(ctx.athleteId, {
        limit: 200,
        startDate: dateFrom,
        endDate: dateTo,
        nameSearch: input.nameSearch,
      })
      console.log('[findSessions] Got', allSessions.length, 'sessions from DB')
      if (allSessions.length > 0) {
        console.log('[findSessions] First session:', {
          id: allSessions[0].id,
          date: allSessions[0].date,
          workout_type: allSessions[0].workout_type,
        })
      }

      // Apply additional filters
      let filtered = allSessions.filter(s => {
        // Type filter
        if (input.sessionType === 'race' && !isLikelyRace(s)) return false
        if (input.sessionType === 'recovery' && (s.intensity_factor || 0) > 0.65) return false
        if (input.sessionType === 'endurance' && ((s.intensity_factor || 0) > 0.85 || (s.intensity_factor || 0) < 0.55)) return false
        if (input.sessionType === 'workout' && (s.intensity_factor || 0) < 0.75) return false

        // Numeric filters
        if (input.minTSS && (s.tss || 0) < input.minTSS) return false
        if (input.maxTSS && (s.tss || 0) > input.maxTSS) return false
        if (input.minDurationMinutes && (s.duration_seconds || 0) / 60 < input.minDurationMinutes) return false
        if (input.minIntensityFactor && (s.intensity_factor || 0) < input.minIntensityFactor) return false

        return true
      })

      // Map sessions to summaries with source tag
      let sessions: SessionSummary[] = filtered.map(s => ({
        id: s.id,
        date: s.date,
        name: s.workout_type || null,
        sport: s.sport,
        duration_minutes: s.duration_seconds ? Math.round(s.duration_seconds / 60) : null,
        tss: s.tss || null,
        intensity_factor: s.intensity_factor || null,
        avg_power: s.avg_power || null,
        normalized_power: s.normalized_power || null,
        avg_hr: s.avg_hr || null,
        isLikelyRace: isLikelyRace(s),
        source: 'sessions' as const,
      }))

      // Cross-check race_results when looking for races or searching by name
      if (input.sessionType === 'race' || input.nameSearch) {
        const raceResults = await getRaceResults(ctx.athleteId, {
          limit: 200,
          startDate: dateFrom,
          endDate: dateTo,
          nameSearch: input.nameSearch,
        })
        console.log('[findSessions] Got', raceResults.length, 'race results from ZwiftPower')

        if (raceResults.length > 0) {
          // Build a set of session dates for deduplication
          const sessionDates = new Set(sessions.map(s => s.date.split('T')[0]))

          for (const race of raceResults) {
            const raceDate = race.race_date.split('T')[0]
            // Check if we already have a session for this date
            const existingIdx = sessions.findIndex(s => s.date.split('T')[0] === raceDate)

            if (existingIdx >= 0) {
              // Enrich existing session with race_results data
              sessions[existingIdx].placement = race.placement ?? null
              sessions[existingIdx].totalInCategory = race.total_in_category ?? null
              sessions[existingIdx].category = race.category ?? null
              sessions[existingIdx].isLikelyRace = true
              // Keep source as 'sessions' since we have both
            } else if (!sessionDates.has(raceDate)) {
              // Add as new entry from ZwiftPower
              sessionDates.add(raceDate)
              sessions.push({
                id: race.id,
                date: race.race_date,
                name: race.race_name + (race.route_name ? ` (${race.route_name})` : ''),
                sport: 'cycling',
                duration_minutes: race.duration_seconds ? Math.round(race.duration_seconds / 60) : null,
                tss: null,
                intensity_factor: null,
                avg_power: race.avg_power ?? null,
                normalized_power: race.normalized_power ?? null,
                avg_hr: race.avg_hr ?? null,
                isLikelyRace: true,
                source: 'zwiftpower',
                placement: race.placement ?? null,
                totalInCategory: race.total_in_category ?? null,
                category: race.category ?? null,
              })
            }
          }
        }
      }

      // Sort
      if (input.sortBy === 'tss') {
        sessions.sort((a, b) => (b.tss || 0) - (a.tss || 0))
      } else if (input.sortBy === 'duration') {
        sessions.sort((a, b) => (b.duration_minutes || 0) - (a.duration_minutes || 0))
      } else if (input.sortBy === 'intensity') {
        sessions.sort((a, b) => (b.intensity_factor || 0) - (a.intensity_factor || 0))
      } else {
        // Default: sort by date descending (most recent first)
        sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      }

      // Apply limit
      const limit = input.limit || 10
      const totalFound = sessions.length
      sessions = sessions.slice(0, limit)

      return {
        sessions,
        totalFound,
        searchCriteria: criteriaDesc.length > 0 ? criteriaDesc.join(', ') : 'all recent sessions',
      }
    } catch (error) {
      return {
        sessions: [],
        totalFound: 0,
        searchCriteria: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  },
})
