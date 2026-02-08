import { NextResponse } from 'next/server'
import { getRaceResults } from '@/lib/db/race-results'
import { getRaceAnalysisSummaryRPC } from '@/lib/db/race-results'
import {
  getFrequentOpponentsRPC,
  getNearFinishersSummaryRPC,
  getCategoryComparisonRPC,
} from '@/lib/db/race-competitors'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/race-analysis
 *
 * Returns race history + competitor data for canvas widgets.
 * Self-fetching endpoint so widgets don't need AI to pipe data through.
 * Uses Supabase auth user.id (same as chat route) since race data
 * is stored with Supabase user.id as athlete_id.
 */
export async function GET(): Promise<NextResponse> {
  // Get athlete ID from Supabase auth (same pattern as chat route)
  const supabase = await createClient()
  let athleteId: string | undefined

  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.id) {
      athleteId = user.id
    }
  }

  if (!athleteId) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    )
  }

  try {
    const [races, summary, opponents, nearFinishers, catComparison] = await Promise.all([
      getRaceResults(athleteId, { limit: 30 }),
      getRaceAnalysisSummaryRPC(athleteId),
      getFrequentOpponentsRPC(athleteId, 2, 10),
      getNearFinishersSummaryRPC(athleteId),
      getCategoryComparisonRPC(athleteId),
    ])

    // Build RaceHistoryData for the race-history widget
    const raceHistory = {
      races: races.map(r => ({
        id: r.id,
        name: r.race_name,
        date: r.race_date,
        placement: r.placement ?? 0,
        totalInCategory: r.total_in_category ?? 0,
        category: r.category ?? '?',
        avgPower: r.avg_power,
        avgWkg: r.avg_wkg,
        tsbAtRace: r.tsb_at_race,
        ctlAtRace: r.ctl_at_race,
        raceType: r.race_type as 'flat' | 'hilly' | 'mixed' | 'tt' | undefined,
      })),
      summary: summary ? {
        totalRaces: summary.stats.totalRaces,
        avgPlacement: summary.stats.avgPlacement,
        avgPlacementPercent: summary.stats.avgPlacementPercent,
        placementTrend: computePlacementTrend(races),
        categoryProgression: computeCategoryProgression(races),
      } : undefined,
    }

    // Build CompetitorData for the competitor-analysis widget
    const opponentsWithRecord = opponents.filter(o => o.wins_against + o.losses_against > 0)
    const totalH2H = opponentsWithRecord.reduce(
      (sum, o) => sum + o.wins_against + o.losses_against, 0
    )
    const totalWins = opponentsWithRecord.reduce((sum, o) => sum + o.wins_against, 0)

    let powerGapInsight = 'Insufficient data for gap analysis.'
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

    const competitors = {
      frequentOpponents: opponents.map(o => ({
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
        totalOpponents: opponents.length,
        overallWinRate: totalH2H > 0 ? Math.round((totalWins / totalH2H) * 100) : null,
        toughestRivals: opponents
          .filter(o => o.losses_against > o.wins_against)
          .sort((a, b) => b.losses_against - a.losses_against)
          .slice(0, 3)
          .map(r => ({
            name: r.rider_name,
            record: `${r.wins_against}-${r.losses_against}`,
            avgPowerGap: r.avg_power_gap,
          })),
        dominatedOpponents: opponents
          .filter(o => o.wins_against > o.losses_against && o.races_together >= 3)
          .sort((a, b) => b.wins_against - a.wins_against)
          .slice(0, 3)
          .map(d => ({
            name: d.rider_name,
            record: `${d.wins_against}-${d.losses_against}`,
          })),
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
        insight: powerGapInsight,
      },
    }

    return NextResponse.json({ raceHistory, competitors })
  } catch (error) {
    console.error('Race analysis API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch race analysis data' },
      { status: 500 }
    )
  }
}

function computePlacementTrend(
  races: { race_date: string; placement?: number; total_in_category?: number }[]
): 'improving' | 'stable' | 'declining' {
  const sorted = [...races]
    .sort((a, b) => new Date(a.race_date).getTime() - new Date(b.race_date).getTime())

  if (sorted.length < 6) return 'stable'

  const midpoint = Math.floor(sorted.length / 2)
  const older = sorted.slice(0, midpoint).filter(r => r.placement && r.total_in_category)
  const newer = sorted.slice(midpoint).filter(r => r.placement && r.total_in_category)

  if (older.length === 0 || newer.length === 0) return 'stable'

  const olderAvg = older.reduce((s, r) => s + (r.placement! / r.total_in_category!) * 100, 0) / older.length
  const newerAvg = newer.reduce((s, r) => s + (r.placement! / r.total_in_category!) * 100, 0) / newer.length

  const diff = olderAvg - newerAvg
  if (diff > 5) return 'improving'
  if (diff < -5) return 'declining'
  return 'stable'
}

function computeCategoryProgression(
  races: { race_date: string; category?: string }[]
): string[] | null {
  const sorted = [...races]
    .sort((a, b) => new Date(a.race_date).getTime() - new Date(b.race_date).getTime())
    .filter(r => r.category)

  if (sorted.length < 2) return null

  const progression: string[] = []
  let lastCat = ''
  for (const race of sorted) {
    if (race.category && race.category !== lastCat) {
      progression.push(race.category)
      lastCat = race.category
    }
  }

  return progression.length > 1 ? progression : null
}
