/**
 * Race Analysis AI Tools
 *
 * Tools for analyzing ZwiftPower race results and competitor data.
 */

import { z } from 'zod'
import { defineTool } from './types'
import {
  getRaceResults,
  getRaceStatistics,
  getRacesByForm,
  getPerformanceByRaceType,
} from '@/lib/db/race-results'
import {
  getFrequentOpponents,
  getNearFinishersAnalysis,
  getCategoryComparison,
} from '@/lib/db/race-competitors'

// ============================================================
// ANALYZE RACE PERFORMANCE
// ============================================================

const analyzeRacePerformanceInputSchema = z.object({
  period: z.enum(['30d', '90d', '180d', '365d', 'all']).optional()
    .describe('Time period to analyze (default: all)'),
  category: z.string().optional()
    .describe('Filter to specific race category (A, B, C, D, E)'),
  raceType: z.enum(['flat', 'hilly', 'mixed', 'tt']).optional()
    .describe('Filter to specific race type'),
})

type AnalyzeRacePerformanceInput = z.infer<typeof analyzeRacePerformanceInputSchema>

export const analyzeRacePerformance = defineTool<AnalyzeRacePerformanceInput, unknown>({
  description: `Analyze the athlete's race performance including placement trends, form correlation (optimal TSB for racing), terrain strengths/weaknesses, and power analysis. Use this when the user asks about their race results, race performance, or wants to understand how training affects racing.`,

  inputSchema: analyzeRacePerformanceInputSchema,

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

    // Get race results
    const races = await getRaceResults(ctx.athleteId, {
      startDate,
      category,
      raceType,
      limit: 200,
    })

    if (races.length === 0) {
      return {
        error: 'No race results found. Connect ZwiftPower and sync your races to enable race analysis.',
        suggestion: 'Go to Settings > Integrations to connect ZwiftPower.',
      }
    }

    // Get statistics
    const stats = await getRaceStatistics(ctx.athleteId)

    // Get form correlation (TSB analysis)
    const formAnalysis = await getRacesByForm(ctx.athleteId)

    // Get terrain analysis
    const terrainAnalysis = await getPerformanceByRaceType(ctx.athleteId)

    // Calculate placement trend (recent vs older races)
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

        const diff = olderAvgPercent - newerAvgPercent // positive = improving
        if (diff > 5) placementTrend = 'improving'
        else if (diff < -5) placementTrend = 'declining'
      }
    }

    // Track category progression
    const categoryProgression = sortedRaces
      .filter(r => r.category)
      .map(r => r.category!)
      .filter((v, i, arr) => i === 0 || v !== arr[i - 1]) // Remove consecutive duplicates

    // Calculate power analysis
    const racesWithPower = races.filter(r => r.avg_power)
    const avgRacePower = racesWithPower.length > 0
      ? Math.round(racesWithPower.reduce((sum, r) => sum + r.avg_power!, 0) / racesWithPower.length)
      : null

    // Find optimal TSB range
    let bestTsbRange: { min: number; max: number; avgPlacement: number } | null = null
    const formWithResults = formAnalysis.filter(f => f.races >= 2 && f.avgPlacement !== null)
    if (formWithResults.length > 0) {
      const best = formWithResults.reduce((a, b) =>
        (a.avgPlacement || 999) < (b.avgPlacement || 999) ? a : b
      )
      // Parse the range label to get actual numbers
      const rangeMatch = best.tsbRange.match(/\((-?\d+)\s*to\s*(-?\d+)\)/)
        || best.tsbRange.match(/[<>](-?\d+)/)
      if (rangeMatch) {
        const [, min, max] = rangeMatch
        bestTsbRange = {
          min: parseInt(min, 10),
          max: max ? parseInt(max, 10) : (min.startsWith('-') ? parseInt(min, 10) + 10 : 100),
          avgPlacement: best.avgPlacement || 0,
        }
      }
    }

    // Find terrain strengths
    const terrainWithResults = terrainAnalysis.filter(t => t.races >= 2)
    let terrainInsight: string | null = null
    if (terrainWithResults.length >= 2) {
      const best = terrainWithResults.reduce((a, b) =>
        (a.avgPlacementPercent || 100) < (b.avgPlacementPercent || 100) ? a : b
      )
      const worst = terrainWithResults.reduce((a, b) =>
        (a.avgPlacementPercent || 0) > (b.avgPlacementPercent || 0) ? a : b
      )

      if (best.raceType !== worst.raceType && best.avgPlacementPercent && worst.avgPlacementPercent) {
        const improvement = Math.round(worst.avgPlacementPercent - best.avgPlacementPercent)
        if (improvement > 10) {
          terrainInsight = `You place ${improvement}% better in ${best.raceType} races than ${worst.raceType} races. Consider focusing on ${worst.raceType} course training.`
        }
      }
    }

    return {
      summary: {
        totalRaces: stats.totalRaces,
        avgPlacement: stats.avgPlacement,
        avgPlacementPercent: stats.avgPlacementPercent,
        bestPlacement: stats.bestPlacement,
        placementTrend,
        categoryProgression: categoryProgression.length > 1 ? categoryProgression : null,
      },

      formCorrelation: bestTsbRange ? {
        bestTsbRange,
        analysis: formAnalysis,
        insight: `Your best results come when TSB is ${bestTsbRange.min} to ${bestTsbRange.max}. Plan key races for this form range.`,
      } : {
        analysis: formAnalysis,
        insight: 'Insufficient data to determine optimal form range. Keep racing and tracking!',
      },

      terrainAnalysis: {
        byType: terrainAnalysis,
        insight: terrainInsight || 'No significant terrain preference detected.',
      },

      powerAnalysis: avgRacePower ? {
        avgRacePower,
        racesWithPower: racesWithPower.length,
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

      recommendations: [
        placementTrend === 'declining' ? 'Consider reviewing your training - race results are declining' : null,
        bestTsbRange && bestTsbRange.min > -5 ? `Target TSB of ${bestTsbRange.min} to ${bestTsbRange.max} for important races` : null,
        terrainInsight,
        stats.totalRaces < 10 ? 'Keep racing to build more data for accurate analysis' : null,
      ].filter(Boolean),
    }
  },
})

// ============================================================
// ANALYZE COMPETITORS
// ============================================================

const analyzeCompetitorsInputSchema = z.object({
  minRacesTogether: z.number().optional()
    .describe('Minimum races together to be considered a frequent opponent (default: 2)'),
})

type AnalyzeCompetitorsInput = z.infer<typeof analyzeCompetitorsInputSchema>

export const analyzeCompetitors = defineTool<AnalyzeCompetitorsInput, unknown>({
  description: `Analyze the athlete's competitors including frequent opponents, head-to-head records, power comparisons, and what it would take to gain positions. Use this when the user asks about their competitors, rivals, or wants to know how they compare to others in their races.`,

  inputSchema: analyzeCompetitorsInputSchema,

  execute: async ({ minRacesTogether = 2 }, ctx) => {
    if (!ctx.athleteId) {
      return { error: 'Athlete not authenticated' }
    }

    // Get frequent opponents
    const opponents = await getFrequentOpponents(ctx.athleteId, minRacesTogether)

    if (opponents.length === 0) {
      return {
        error: 'No competitor data found. Sync more races from ZwiftPower to analyze your competitors.',
        suggestion: 'You need at least 2 races with the same riders to identify frequent opponents.',
      }
    }

    // Get near finishers analysis
    const nearFinishers = await getNearFinishersAnalysis(ctx.athleteId)

    // Get category comparison
    const categoryComparison = await getCategoryComparison(ctx.athleteId)

    // Calculate win rate against frequent opponents
    const opponentsWithRecord = opponents.filter(o => o.wins_against + o.losses_against > 0)
    const totalHeadToHead = opponentsWithRecord.reduce(
      (sum, o) => sum + o.wins_against + o.losses_against, 0
    )
    const totalWins = opponentsWithRecord.reduce((sum, o) => sum + o.wins_against, 0)
    const overallWinRate = totalHeadToHead > 0
      ? Math.round((totalWins / totalHeadToHead) * 100)
      : null

    // Find toughest rivals (high losses against)
    const toughestRivals = opponents
      .filter(o => o.losses_against > o.wins_against)
      .sort((a, b) => b.losses_against - a.losses_against)
      .slice(0, 3)

    // Find athletes you dominate
    const dominated = opponents
      .filter(o => o.wins_against > o.losses_against && o.races_together >= 3)
      .sort((a, b) => b.wins_against - a.wins_against)
      .slice(0, 3)

    // Power gap insights
    let powerGapInsight: string | null = null
    if (nearFinishers.avgPowerGapToNextPlace !== null) {
      const gap = nearFinishers.avgPowerGapToNextPlace
      if (gap <= 5) {
        powerGapInsight = `You're within ${gap}W of the next position on average. Small gains could significantly improve placements.`
      } else if (gap <= 10) {
        powerGapInsight = `Adding ${gap}W average power could move you up 1-2 positions in most races.`
      } else {
        powerGapInsight = `There's a ${gap}W gap to the next position. Focus on building threshold power.`
      }
    }

    // Category comparison insights
    let categoryInsight: string | null = null
    if (categoryComparison.length > 0) {
      const mainCategory = categoryComparison[0]
      if (mainCategory.powerDifference !== null) {
        const diff = mainCategory.powerDifference
        if (diff > 10) {
          categoryInsight = `Your raw power is ${diff}W above category average in ${mainCategory.category}. You may be ready to upgrade.`
        } else if (diff < -10) {
          categoryInsight = `Your raw power is ${Math.abs(diff)}W below category average in ${mainCategory.category}. Focus on building power.`
        }
      }
    }

    return {
      frequentOpponents: opponents.slice(0, 10).map(o => ({
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
        totalOpponents: opponentsWithRecord.length,
        overallWinRate,
        toughestRivals: toughestRivals.map(r => ({
          name: r.rider_name,
          record: `${r.wins_against}-${r.losses_against}`,
          avgPowerGap: r.avg_power_gap,
        })),
        dominatedOpponents: dominated.map(d => ({
          name: d.rider_name,
          record: `${d.wins_against}-${d.losses_against}`,
        })),
      },

      categoryComparison: categoryComparison.map(c => ({
        category: c.category,
        races: c.races,
        yourAvgPower: c.userAvgPower,
        categoryAvgPower: c.categoryAvgPower,
        powerDifference: c.powerDifference,
        yourAvgWkg: c.userAvgWkg,
        categoryAvgWkg: c.categoryAvgWkg,
        wkgDifference: c.wkgDifference,
      })),

      nearFinishers: {
        avgPowerGapToNextPlace: nearFinishers.avgPowerGapToNextPlace,
        avgTimeGapToNextPlace: nearFinishers.avgTimeGapToNextPlace,
        racesAnalyzed: nearFinishers.racesAnalyzed,
        insight: powerGapInsight || 'Insufficient data for gap analysis.',
      },

      insights: [
        overallWinRate !== null
          ? overallWinRate >= 50
            ? `You win ${overallWinRate}% of head-to-head matchups against frequent opponents.`
            : `You win ${overallWinRate}% of head-to-head matchups. Focus on closing the gap to key rivals.`
          : null,
        categoryInsight,
        powerGapInsight,
        toughestRivals.length > 0
          ? `Your toughest rival is ${toughestRivals[0].rider_name} (${toughestRivals[0].wins_against}-${toughestRivals[0].losses_against} record).`
          : null,
      ].filter(Boolean),

      recommendations: [
        nearFinishers.avgPowerGapToNextPlace && nearFinishers.avgPowerGapToNextPlace <= 10
          ? `Small power gains (${nearFinishers.avgPowerGapToNextPlace}W) could improve your placements significantly.`
          : null,
        toughestRivals.length > 0 && toughestRivals[0].avg_power_gap && toughestRivals[0].avg_power_gap < 0
          ? `Study ${toughestRivals[0].rider_name}'s racing - they average ${Math.abs(toughestRivals[0].avg_power_gap)}W more than you.`
          : null,
        categoryInsight?.includes('upgrade')
          ? 'Consider racing in a higher category to challenge yourself.'
          : null,
      ].filter(Boolean),
    }
  },
})
