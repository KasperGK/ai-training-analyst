import { z } from 'zod'
import { defineTool } from './types'
import { getSessions } from '@/lib/db/sessions'
import { getRaceResults } from '@/lib/db/race-results'

const inputSchema = z.object({
  // Date-based filters
  dateFrom: z.string().optional().describe('Start date (YYYY-MM-DD) for date range search'),
  dateTo: z.string().optional().describe('End date (YYYY-MM-DD) for date range search'),
  daysBack: z.number().optional().describe('Number of days to look back from today. Use 0 for today only, 1 for yesterday+today, 7 for last week.'),

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
  start_time: string | null
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
  // 0.95+ is threshold/race territory; 0.85 catches sweet spot workouts (false positives)
  if (session.intensity_factor && session.intensity_factor > 0.95 &&
      durationMinutes >= 15 && durationMinutes <= 300) {
    return true
  }

  // High TSS relative to duration suggests race (>1.5 TSS per minute, with duration guard)
  // 1.2 catches hard interval sessions (false positives)
  if (session.tss && session.duration_seconds && durationMinutes >= 15 && durationMinutes <= 300) {
    const tssPerMinute = session.tss / durationMinutes
    if (tssPerMinute > 1.5) {
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
- "today" / "this morning" → daysBack: 0
- "yesterday" → daysBack: 1
- "this week" → daysBack: 7
- "longest ride this month" → daysBack: 30, sortBy: "duration"
- "hardest workout" → sortBy: "intensity", limit: 1`,

  inputSchema,

  execute: async (input, ctx) => {
    if (!ctx.athleteId) {
      return {
        sessions: [],
        totalFound: 0,
        searchCriteria: 'No athlete connected',
      }
    }

    // Calculate date range
    let dateFrom: string | undefined = input.dateFrom
    let dateTo: string | undefined = input.dateTo

    if (input.daysBack != null) {
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
    if (input.minTSS != null) criteriaDesc.push(`TSS >= ${input.minTSS}`)
    if (input.minIntensityFactor != null) criteriaDesc.push(`IF >= ${input.minIntensityFactor}`)

    try {
      // Get sessions from database
      const allSessions = await getSessions(ctx.athleteId, {
        limit: 200,
        startDate: dateFrom,
        endDate: dateTo,
        nameSearch: input.nameSearch,
      })
      // Apply additional filters
      let filtered = allSessions.filter(s => {
        // Type filter
        if (input.sessionType === 'race' && !isLikelyRace(s)) return false
        if (input.sessionType === 'recovery' && (s.intensity_factor || 0) > 0.65) return false
        if (input.sessionType === 'endurance' && ((s.intensity_factor || 0) > 0.85 || (s.intensity_factor || 0) < 0.55)) return false
        if (input.sessionType === 'workout' && (s.intensity_factor || 0) < 0.75) return false

        // Numeric filters
        if (input.minTSS != null && (s.tss || 0) < input.minTSS) return false
        if (input.maxTSS != null && (s.tss || 0) > input.maxTSS) return false
        if (input.minDurationMinutes != null && (s.duration_seconds || 0) / 60 < input.minDurationMinutes) return false
        if (input.minIntensityFactor != null && (s.intensity_factor || 0) < input.minIntensityFactor) return false

        return true
      })

      // Helper: extract start time from raw_data
      const getStartTime = (s: { raw_data?: Record<string, unknown> }): string | null => {
        const startDateLocal = s.raw_data?.start_date_local as string | undefined
        return startDateLocal?.includes('T') ? startDateLocal.split('T')[1]?.slice(0, 5) ?? null : null
      }

      // For race queries, use ZwiftPower as primary source, then supplement with heuristic
      if (input.sessionType === 'race') {
        // Step 1: Query ZwiftPower race_results (ground truth)
        const raceResults = await getRaceResults(ctx.athleteId, {
          limit: 200,
          startDate: dateFrom,
          endDate: dateTo,
          nameSearch: input.nameSearch,
        })

        // Step 2: Build sessions from ZwiftPower results, enriched with session metrics where available
        const zwiftpowerSessions: SessionSummary[] = []
        const matchedSessionIds = new Set<string>()

        for (const race of raceResults) {
          const raceDate = race.race_date.split('T')[0]
          // Find matching session by date
          const matchingSession = allSessions.find(s => s.date.split('T')[0] === raceDate)

          if (matchingSession) {
            matchedSessionIds.add(matchingSession.id)
            zwiftpowerSessions.push({
              id: matchingSession.id,
              date: matchingSession.date,
              start_time: getStartTime(matchingSession),
              name: race.race_name + (race.route_name ? ` (${race.route_name})` : ''),
              sport: matchingSession.sport,
              duration_minutes: matchingSession.duration_seconds ? Math.round(matchingSession.duration_seconds / 60) : null,
              tss: matchingSession.tss || null,
              intensity_factor: matchingSession.intensity_factor || null,
              avg_power: matchingSession.avg_power || null,
              normalized_power: matchingSession.normalized_power || null,
              avg_hr: matchingSession.avg_hr || null,
              isLikelyRace: true,
              source: 'sessions',
              placement: race.placement ?? null,
              totalInCategory: race.total_in_category ?? null,
              category: race.category ?? null,
            })
          } else {
            // ZwiftPower-only entry (no matching session)
            zwiftpowerSessions.push({
              id: race.id,
              date: race.race_date,
              start_time: null,
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

        // Step 3: Fall back to heuristic for sessions without ZwiftPower matches
        const heuristicSessions: SessionSummary[] = filtered
          .filter(s => !matchedSessionIds.has(s.id) && isLikelyRace(s))
          .map(s => ({
            id: s.id,
            date: s.date,
            start_time: getStartTime(s),
            name: s.workout_type || null,
            sport: s.sport,
            duration_minutes: s.duration_seconds ? Math.round(s.duration_seconds / 60) : null,
            tss: s.tss || null,
            intensity_factor: s.intensity_factor || null,
            avg_power: s.avg_power || null,
            normalized_power: s.normalized_power || null,
            avg_hr: s.avg_hr || null,
            isLikelyRace: true,
            source: 'sessions' as const,
          }))

        // Step 4: Merge and deduplicate (ZwiftPower first, then heuristic)
        const seenIds = new Set(zwiftpowerSessions.map(s => s.id))
        let sessions: SessionSummary[] = [...zwiftpowerSessions]
        for (const s of heuristicSessions) {
          if (!seenIds.has(s.id)) {
            seenIds.add(s.id)
            sessions.push(s)
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
          sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        }

        const limit = input.limit || 10
        const totalFound = sessions.length
        sessions = sessions.slice(0, limit)

        return {
          sessions,
          totalFound,
          searchCriteria: criteriaDesc.length > 0 ? criteriaDesc.join(', ') : 'all recent sessions',
        }
      }

      // Non-race queries: standard mapping
      let sessions: SessionSummary[] = filtered.map(s => ({
        id: s.id,
        date: s.date,
        start_time: getStartTime(s),
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

      // Cross-check race_results when searching by name (enrich with placement data)
      if (input.nameSearch) {
        const raceResults = await getRaceResults(ctx.athleteId, {
          limit: 200,
          startDate: dateFrom,
          endDate: dateTo,
          nameSearch: input.nameSearch,
        })

        if (raceResults.length > 0) {
          const sessionDates = new Set(sessions.map(s => s.date.split('T')[0]))

          for (const race of raceResults) {
            const raceDate = race.race_date.split('T')[0]
            const existingIdx = sessions.findIndex(s => s.date.split('T')[0] === raceDate)

            if (existingIdx >= 0) {
              sessions[existingIdx].placement = race.placement ?? null
              sessions[existingIdx].totalInCategory = race.total_in_category ?? null
              sessions[existingIdx].category = race.category ?? null
              sessions[existingIdx].isLikelyRace = true
            } else if (!sessionDates.has(raceDate)) {
              sessionDates.add(raceDate)
              sessions.push({
                id: race.id,
                date: race.race_date,
                start_time: null,
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
