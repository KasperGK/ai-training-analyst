/**
 * Unified Race Analysis AI Tool
 *
 * Single `analyzeRace` tool that replaces the former `analyzeRacePerformance`
 * and `analyzeCompetitors` tools. All queries run in parallel via Promise.all
 * using server-side SQL aggregation (RPC functions) for speed.
 */

import { z } from 'zod'
import { defineTool, parseAthleteContext } from './types'
import type { ToolContext } from './types'
import { getRaceResults } from '@/lib/db/race-results'
import { getRaceAnalysisSummaryRPC } from '@/lib/db/race-results'
import {
  getFrequentOpponentsRPC,
  getNearFinishersSummaryRPC,
  getCategoryComparisonRPC,
} from '@/lib/db/race-competitors'
import { createClient } from '@/lib/supabase/server'
import { analyzeRacePacing } from '@/lib/analysis/race-pacing'
import type { RacePacingAnalysis } from '@/lib/analysis/race-pacing'

// ============================================================
// HELPER: Fetch pacing data for most recent race
// ============================================================

async function fetchLatestRacePacing(
  ctx: ToolContext,
  latestRace: { race_date: string; race_name: string; duration_seconds?: number } | null
): Promise<{ raceName: string; pacing: RacePacingAnalysis } | null> {
  if (!latestRace || !ctx.intervalsConnected || !ctx.athleteId) return null

  try {
    // Find matching session by date
    const supabase = await createClient()
    if (!supabase) return null

    // Race dates are TIMESTAMPTZ — match to the same day in sessions
    const raceDay = latestRace.race_date.split('T')[0]
    const { data: sessions } = await supabase
      .from('sessions')
      .select('external_id, raw_data, duration_seconds')
      .eq('athlete_id', ctx.athleteId)
      .gte('date', raceDay)
      .lt('date', raceDay + 'T23:59:59')
      .order('duration_seconds', { ascending: false })
      .limit(1)

    if (!sessions || sessions.length === 0) return null

    const session = sessions[0]
    if (!session.external_id) return null

    // Get FTP from athlete context or session raw_data
    const athleteCtx = parseAthleteContext(ctx.athleteContext)
    const ftp = athleteCtx?.athlete?.ftp
      || (session.raw_data as Record<string, unknown> | null)?.icu_ftp as number | null
      || null

    // Fetch power stream
    const streams = await ctx.intervalsClient.getActivityStreams(session.external_id, ['watts'])
    if (!streams.watts || streams.watts.length === 0) return null

    const duration = latestRace.duration_seconds || session.duration_seconds || streams.watts.length
    const pacing = analyzeRacePacing(streams.watts, ftp, duration)
    if (!pacing) return null

    return { raceName: latestRace.race_name, pacing }
  } catch {
    return null
  }
}

// ============================================================
// ANALYZE RACE (unified tool)
// ============================================================

const analyzeRaceInputSchema = z.object({
  period: z.enum(['30d', '90d', '180d', '365d', 'all']).optional()
    .describe('Time period to analyze (default: all)'),
  category: z.string().optional()
    .describe('Filter to specific race category (A, B, C, D, E)'),
  raceType: z.enum(['flat', 'hilly', 'mixed', 'tt']).optional()
    .describe('Filter to specific race type'),
})

type AnalyzeRaceInput = z.infer<typeof analyzeRaceInputSchema>

export const analyzeRace = defineTool<AnalyzeRaceInput, unknown>({
  description: `Comprehensive race analysis combining performance trends, competitor analysis, and tactical pacing insights. Returns placement trends, form correlation (optimal TSB), terrain strengths, head-to-head records vs frequent opponents, power gaps, category comparison, and pacing analysis of the most recent race (quarter splits, surges, sprint finish, fade detection). Use this when users ask about race results, competitors, rivals, how to improve race performance, or anything race-related.`,

  inputSchema: analyzeRaceInputSchema,

  execute: async ({ period = 'all', category, raceType }, ctx) => {
    if (!ctx.athleteId) {
      return { error: 'Athlete not authenticated' }
    }

    // Calculate date range
    let startDate: string | undefined
    if (period !== 'all') {
      const days = { '30d': 30, '90d': 90, '180d': 180, '365d': 365 }[period] || 365
      const d = new Date()
      d.setDate(d.getDate() - days)
      startDate = d.toISOString().split('T')[0]
    }

    // All queries in parallel
    const [races, summary, opponents, nearFinishers, catComparison] = await Promise.all([
      getRaceResults(ctx.athleteId, { startDate, category, raceType, limit: 30 }),
      getRaceAnalysisSummaryRPC(ctx.athleteId, { startDate, category, raceType }),
      getFrequentOpponentsRPC(ctx.athleteId, 2, 10),
      getNearFinishersSummaryRPC(ctx.athleteId),
      getCategoryComparisonRPC(ctx.athleteId),
    ])

    if (races.length === 0) {
      return {
        error: 'No race results found. Connect ZwiftPower and sync your races to enable race analysis.',
        suggestion: 'Go to Settings > Integrations to connect ZwiftPower.',
      }
    }

    // Fetch pacing for the latest race (may return null if no stream data)
    const latestRace = races[0] ? {
      race_date: races[0].race_date,
      race_name: races[0].race_name,
      duration_seconds: races[0].duration_seconds,
    } : null
    const latestRacePacing = await fetchLatestRacePacing(ctx, latestRace)

    // Calculate placement trend
    const sortedRaces = [...races].sort((a, b) =>
      new Date(a.race_date).getTime() - new Date(b.race_date).getTime()
    )

    let placementTrend: 'improving' | 'stable' | 'declining' = 'stable'
    if (sortedRaces.length >= 6) {
      const midpoint = Math.floor(sortedRaces.length / 2)
      const olderRaces = sortedRaces.slice(0, midpoint).filter(r => r.placement && r.total_in_category)
      const newerRaces = sortedRaces.slice(midpoint).filter(r => r.placement && r.total_in_category)

      if (olderRaces.length > 0 && newerRaces.length > 0) {
        const olderAvgPercent = olderRaces.reduce((sum, r) =>
          sum + (r.placement! / r.total_in_category!) * 100, 0) / olderRaces.length
        const newerAvgPercent = newerRaces.reduce((sum, r) =>
          sum + (r.placement! / r.total_in_category!) * 100, 0) / newerRaces.length

        const diff = olderAvgPercent - newerAvgPercent
        if (diff > 5) placementTrend = 'improving'
        else if (diff < -5) placementTrend = 'declining'
      }
    }

    // Find optimal TSB range from form analysis
    type FormEntry = { tsb_range: string; races: number; avg_placement: number | null; avg_placement_percent: number | null }
    const formData: FormEntry[] = summary?.formAnalysis || []
    const formWithResults = formData.filter(f => f.races >= 2 && f.avg_placement !== null)
    let bestTsbRange: { range: string; avgPlacement: number } | null = null
    if (formWithResults.length > 0) {
      const best = formWithResults.reduce((a, b) =>
        (a.avg_placement || 999) < (b.avg_placement || 999) ? a : b
      )
      bestTsbRange = { range: best.tsb_range, avgPlacement: best.avg_placement! }
    }

    // Terrain insight
    type TerrainEntry = { race_type: string; races: number; avg_placement: number | null; avg_placement_percent: number | null; avg_wkg: number | null }
    const terrainData: TerrainEntry[] = summary?.terrainAnalysis || []
    const terrainWithResults = terrainData.filter(t => t.races >= 2)
    let terrainInsight: string | null = null
    if (terrainWithResults.length >= 2) {
      const best = terrainWithResults.reduce((a, b) =>
        (a.avg_placement_percent || 100) < (b.avg_placement_percent || 100) ? a : b
      )
      const worst = terrainWithResults.reduce((a, b) =>
        (a.avg_placement_percent || 0) > (b.avg_placement_percent || 0) ? a : b
      )

      if (best.race_type !== worst.race_type && best.avg_placement_percent && worst.avg_placement_percent) {
        const improvement = Math.round(worst.avg_placement_percent - best.avg_placement_percent)
        if (improvement > 10) {
          terrainInsight = `You place ${improvement}% better in ${best.race_type} races than ${worst.race_type} races.`
        }
      }
    }

    // Competitor analysis
    const opponentsWithRecord = opponents.filter(o => o.wins_against + o.losses_against > 0)
    const totalHeadToHead = opponentsWithRecord.reduce(
      (sum, o) => sum + o.wins_against + o.losses_against, 0
    )
    const totalWins = opponentsWithRecord.reduce((sum, o) => sum + o.wins_against, 0)
    const overallWinRate = totalHeadToHead > 0
      ? Math.round((totalWins / totalHeadToHead) * 100)
      : null

    const toughestRivals = opponents
      .filter(o => o.losses_against > o.wins_against)
      .sort((a, b) => b.losses_against - a.losses_against)
      .slice(0, 3)

    const dominated = opponents
      .filter(o => o.wins_against > o.losses_against && o.races_together >= 3)
      .sort((a, b) => b.wins_against - a.wins_against)
      .slice(0, 3)

    // Near finishers insight
    let powerGapInsight: string | null = null
    if (nearFinishers.avgPowerGapToNextPlace !== null) {
      const gap = nearFinishers.avgPowerGapToNextPlace
      if (gap <= 5) {
        powerGapInsight = `Within ${gap}W of next position on average. Small gains = big results.`
      } else if (gap <= 10) {
        powerGapInsight = `Adding ${gap}W average power could move you up 1-2 positions.`
      } else {
        powerGapInsight = `${gap}W gap to next position. Focus on building threshold power.`
      }
    }

    // Build recommendations
    const recommendations: string[] = []
    if (placementTrend === 'declining') {
      recommendations.push('Race results are declining — review recent training load and recovery.')
    }
    if (bestTsbRange) {
      recommendations.push(`Target form range "${bestTsbRange.range}" for key races (avg placement: ${bestTsbRange.avgPlacement}).`)
    }
    if (terrainInsight) {
      recommendations.push(terrainInsight)
    }
    if (nearFinishers.avgPowerGapToNextPlace && nearFinishers.avgPowerGapToNextPlace <= 10) {
      recommendations.push(`Small power gains (${nearFinishers.avgPowerGapToNextPlace}W) could improve placements significantly.`)
    }
    if (latestRacePacing?.pacing.fadePercent && latestRacePacing.pacing.fadePercent > 10) {
      recommendations.push(`Faded ${latestRacePacing.pacing.fadePercent}% in last race — practice even pacing or save surges for the finish.`)
    }
    if (summary?.stats.totalRaces && summary.stats.totalRaces < 10) {
      recommendations.push('Keep racing to build more data for accurate analysis.')
    }

    return {
      summary: {
        totalRaces: summary?.stats.totalRaces || races.length,
        avgPlacement: summary?.stats.avgPlacement,
        avgPlacementPercent: summary?.stats.avgPlacementPercent,
        bestPlacement: summary?.stats.bestPlacement,
        placementTrend,
        categoryCounts: summary?.stats.categoryCounts || {},
        raceTypeCounts: summary?.stats.raceTypeCounts || {},
      },

      formCorrelation: bestTsbRange ? {
        bestTsbRange: bestTsbRange.range,
        bestAvgPlacement: bestTsbRange.avgPlacement,
        allRanges: formData,
        insight: `Best results come in the "${bestTsbRange.range}" form range. Plan key races accordingly.`,
      } : {
        allRanges: formData,
        insight: 'Insufficient data to determine optimal form range. Keep racing and tracking!',
      },

      terrainAnalysis: {
        byType: terrainData,
        insight: terrainInsight || 'No significant terrain preference detected.',
      },

      competitors: {
        top10: opponents.map(o => ({
          name: o.rider_name,
          racesTogether: o.races_together,
          winsAgainst: o.wins_against,
          lossesAgainst: o.losses_against,
          winRate: o.wins_against + o.losses_against > 0
            ? Math.round((o.wins_against / (o.wins_against + o.losses_against)) * 100)
            : null,
          avgPowerGap: o.avg_power_gap,
          avgPositionGap: o.avg_position_gap,
        })),
        headToHead: {
          overallWinRate,
          toughestRivals: toughestRivals.map(r => ({
            name: r.rider_name,
            record: `${r.wins_against}-${r.losses_against}`,
            avgPowerGap: r.avg_power_gap,
          })),
          dominated: dominated.map(d => ({
            name: d.rider_name,
            record: `${d.wins_against}-${d.losses_against}`,
          })),
        },
      },

      categoryComparison: catComparison.map(c => ({
        category: c.category,
        races: c.races,
        yourAvgPower: c.user_avg_power,
        categoryAvgPower: c.category_avg_power,
        powerDifference: c.power_difference,
        yourAvgWkg: c.user_avg_wkg,
        categoryAvgWkg: c.category_avg_wkg,
        wkgDifference: c.wkg_difference,
      })),

      nearFinishers: {
        avgPowerGapToNextPlace: nearFinishers.avgPowerGapToNextPlace,
        avgTimeGapToNextPlace: nearFinishers.avgTimeGapToNextPlace,
        racesAnalyzed: nearFinishers.racesAnalyzed,
        insight: powerGapInsight || 'Insufficient data for gap analysis.',
      },

      latestRacePacing: latestRacePacing ? {
        raceName: latestRacePacing.raceName,
        quarters: latestRacePacing.pacing.quarters,
        surges: latestRacePacing.pacing.surges,
        sprintFinish: latestRacePacing.pacing.sprintFinish,
        fadeRate: latestRacePacing.pacing.fadeRate,
        fadePercent: latestRacePacing.pacing.fadePercent,
        assessment: latestRacePacing.pacing.assessment,
      } : null,

      recentRaces: races.slice(0, 5).map(r => ({
        name: r.race_name,
        date: r.race_date,
        placement: r.placement,
        total: r.total_in_category,
        category: r.category,
        avgPower: r.avg_power,
        avgWkg: r.avg_wkg,
        tsb: r.tsb_at_race,
      })),

      recommendations,
    }
  },
})
