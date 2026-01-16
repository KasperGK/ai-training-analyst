import { z } from 'zod'
import { defineTool, parseAthleteContext } from './types'
import { getSessions } from '@/lib/db/sessions'
import { getFitnessHistory } from '@/lib/db/fitness'
import { getDateRange, type IntervalsActivity } from '@/lib/intervals-icu'
import { getNormalizedPower } from '@/lib/transforms'

// ============================================================
// ANALYZE POWER CURVE
// ============================================================

const powerCurveInputSchema = z.object({
  period: z.enum(['30d', '90d', '180d', '365d']).optional().describe('Time period to analyze (default 90d)'),
  compareToPrevious: z.boolean().optional().describe('Compare to previous period of same length'),
})

type PowerCurveInput = z.infer<typeof powerCurveInputSchema>

export const analyzePowerCurve = defineTool<PowerCurveInput, unknown>({
  description: 'Analyze the athlete\'s power curve to identify strengths, limiters, and rider profile. Compares peak power at key durations (5s, 1min, 5min, 20min) and identifies whether the athlete is a sprinter, time trialist, climber, or all-rounder.',
  inputSchema: powerCurveInputSchema,
  execute: async ({ period = '90d', compareToPrevious = true }, ctx) => {
    const periodDays = { '30d': 30, '90d': 90, '180d': 180, '365d': 365 }[period] || 90

    // Key durations to analyze (in seconds)
    const keyDurations = [
      { secs: 5, label: '5s', category: 'neuromuscular' },
      { secs: 60, label: '1min', category: 'anaerobic' },
      { secs: 300, label: '5min', category: 'vo2max' },
      { secs: 1200, label: '20min', category: 'threshold' },
    ]

    // Get FTP and weight from context
    const parsed = parseAthleteContext(ctx.athleteContext)
    const athleteFTP = parsed.athlete?.ftp || 250
    const weightKg = parsed.athlete?.weight_kg || 70

    let currentPeaks: Record<string, number> = {}
    const previousPeaks: Record<string, number> = {}
    let dataSource = 'none'

    // Try local Supabase first
    if (ctx.flags.useLocalData && ctx.athleteId) {
      try {
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - periodDays)

        const sessions = await getSessions(ctx.athleteId, {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          limit: 200,
        })

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
    if (ctx.intervalsConnected && dataSource === 'none') {
      try {
        const { oldest, newest } = getDateRange(periodDays)
        const powerCurves = await ctx.intervalsClient.getPowerCurves(oldest, newest)

        if (powerCurves && powerCurves.length > 0) {
          for (const duration of keyDurations) {
            const match = powerCurves.find((pc: { secs: number }) => pc.secs === duration.secs)
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

          const prevCurves = await ctx.intervalsClient.getPowerCurves(
            prevStart.toISOString().split('T')[0],
            prevEnd.toISOString().split('T')[0]
          )

          if (prevCurves && prevCurves.length > 0) {
            for (const duration of keyDurations) {
              const match = prevCurves.find((pc: { secs: number }) => pc.secs === duration.secs)
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

    // Analyze rider profile
    const profileScores = { sprinter: 0, pursuiter: 0, climber: 0, ttSpecialist: 0 }

    const fiveSecWkg = (currentPeaks['5s'] || 0) / weightKg
    const oneMinWkg = (currentPeaks['1min'] || 0) / weightKg
    const fiveMinWkg = (currentPeaks['5min'] || 0) / weightKg
    const twentyMinWkg = (currentPeaks['20min'] || 0) / weightKg

    if (fiveSecWkg > 15) profileScores.sprinter += 2
    if (fiveSecWkg > 18) profileScores.sprinter += 2
    if (currentPeaks['5s'] && currentPeaks['20min'] && currentPeaks['5s'] / currentPeaks['20min'] > 3.5) profileScores.sprinter += 2

    if (oneMinWkg > 7) profileScores.pursuiter += 2
    if (oneMinWkg > 8.5) profileScores.pursuiter += 2

    if (fiveMinWkg > 5) profileScores.climber += 2
    if (fiveMinWkg > 6) profileScores.climber += 2
    if (twentyMinWkg > 4.5) profileScores.climber += 2

    if (twentyMinWkg > 4) profileScores.ttSpecialist += 2
    if (twentyMinWkg > 4.5) profileScores.ttSpecialist += 2
    if (fiveMinWkg > 5 && twentyMinWkg > 4) profileScores.ttSpecialist += 1

    const maxScore = Math.max(...Object.values(profileScores))
    let riderProfile = 'all-rounder'
    if (maxScore >= 4) {
      if (profileScores.sprinter === maxScore) riderProfile = 'sprinter'
      else if (profileScores.pursuiter === maxScore) riderProfile = 'pursuiter'
      else if (profileScores.climber === maxScore) riderProfile = 'climber'
      else if (profileScores.ttSpecialist === maxScore) riderProfile = 'TT specialist'
    }

    const metrics = [
      { label: '5s (Neuromuscular)', value: fiveSecWkg, benchmark: 15 },
      { label: '1min (Anaerobic)', value: oneMinWkg, benchmark: 7 },
      { label: '5min (VO2max)', value: fiveMinWkg, benchmark: 5 },
      { label: '20min (Threshold)', value: twentyMinWkg, benchmark: 4 },
    ]

    const strengths = metrics.filter(m => m.value >= m.benchmark * 1.1).map(m => m.label)
    const limiters = metrics.filter(m => m.value < m.benchmark * 0.9).map(m => m.label)

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
})

// ============================================================
// ANALYZE EFFICIENCY
// ============================================================

const efficiencyInputSchema = z.object({
  days: z.number().optional().describe('Number of days to analyze (default 90, max 180)'),
})

type EfficiencyInput = z.infer<typeof efficiencyInputSchema>

export const analyzeEfficiency = defineTool<EfficiencyInput, unknown>({
  description: 'Analyze aerobic efficiency trends using Efficiency Factor (NP/HR) and decoupling. Use to assess aerobic development, identify fitness improvements, and understand how well the athlete maintains power relative to heart rate over time.',
  inputSchema: efficiencyInputSchema,
  execute: async ({ days = 90 }, ctx) => {
    const lookbackDays = Math.min(days, 180)

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
    if (ctx.flags.useLocalData && ctx.athleteId) {
      try {
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - lookbackDays)

        const localSessions = await getSessions(ctx.athleteId, {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          limit: 200,
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
    if (sessions.length === 0 && ctx.intervalsConnected) {
      try {
        const { oldest, newest } = getDateRange(lookbackDays)
        const activities = await ctx.intervalsClient.getActivities(oldest, newest)

        sessions = activities
          .filter((a: IntervalsActivity) => {
            const np = getNormalizedPower(a)
            return np && a.average_heartrate && a.average_heartrate > 0
          })
          .map((a: IntervalsActivity) => {
            const np = getNormalizedPower(a) || 0
            return {
              date: a.start_date_local?.split('T')[0] || '',
              np,
              avgHr: a.average_heartrate!,
              duration: a.moving_time,
              ef: Math.round((np / a.average_heartrate!) * 100) / 100,
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

    sessions.sort((a, b) => a.date.localeCompare(b.date))

    const allEF = sessions.map(s => s.ef)
    const avgEF = Math.round((allEF.reduce((a, b) => a + b, 0) / allEF.length) * 100) / 100
    const minEF = Math.min(...allEF)
    const maxEF = Math.max(...allEF)

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
})

// ============================================================
// ANALYZE TRAINING LOAD
// ============================================================

const trainingLoadInputSchema = z.object({
  includeWeeklyBreakdown: z.boolean().optional().describe('Include week-by-week TSS breakdown'),
})

type TrainingLoadInput = z.infer<typeof trainingLoadInputSchema>

export const analyzeTrainingLoad = defineTool<TrainingLoadInput, unknown>({
  description: 'Analyze training load metrics including ACWR (acute:chronic workload ratio), monotony, and strain. Use to assess injury risk, training balance, and load management.',
  inputSchema: trainingLoadInputSchema,
  execute: async ({ includeWeeklyBreakdown = true }, ctx) => {
    const lookbackDays = 42 // 6 weeks for good context

    let dailyTSS: Array<{ date: string; tss: number }> = []
    let currentCTL = 0
    let currentATL = 0
    let dataSource = 'none'

    // Try local Supabase first
    if (ctx.flags.useLocalData && ctx.athleteId) {
      try {
        const [fitnessHistory, sessions] = await Promise.all([
          getFitnessHistory(ctx.athleteId, lookbackDays),
          getSessions(ctx.athleteId, {
            startDate: new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            limit: 200,
          }),
        ])

        if (fitnessHistory.length > 0) {
          const latest = fitnessHistory[fitnessHistory.length - 1]
          currentCTL = latest.ctl
          currentATL = latest.atl

          dailyTSS = fitnessHistory.map(f => ({
            date: f.date,
            tss: f.tss_day || 0,
          }))
          dataSource = 'local'
        } else if (sessions.length > 0) {
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
    if (dailyTSS.length < 7 && ctx.intervalsConnected) {
      try {
        const { oldest, newest } = getDateRange(lookbackDays)
        const [wellness, activities] = await Promise.all([
          ctx.intervalsClient.getWellness(oldest, newest),
          ctx.intervalsClient.getActivities(oldest, newest),
        ])

        if (wellness.length > 0) {
          const latest = wellness[wellness.length - 1]
          currentCTL = latest.ctl
          currentATL = latest.atl
        }

        const tssbyDate: Record<string, number> = {}
        activities.forEach((a: { start_date_local?: string; icu_training_load?: number }) => {
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

    // Calculate ACWR
    const last7Days = filledTSS.slice(-7)
    const last28Days = filledTSS.slice(-28)

    const acuteLoad = last7Days.reduce((sum, d) => sum + d.tss, 0) / 7
    const chronicLoad = last28Days.reduce((sum, d) => sum + d.tss, 0) / 28
    const acwr = chronicLoad > 0 ? Math.round((acuteLoad / chronicLoad) * 100) / 100 : 0

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

    // Calculate monotony
    const recentWeek = filledTSS.slice(-7).map(d => d.tss)
    const weekAvg = recentWeek.reduce((a, b) => a + b, 0) / 7
    const weekVariance = recentWeek.reduce((sum, tss) => sum + Math.pow(tss - weekAvg, 2), 0) / 7
    const weekStdDev = Math.sqrt(weekVariance)
    const monotony = weekStdDev > 0 ? Math.round((weekAvg / weekStdDev) * 100) / 100 : 0

    let monotonyAssessment: string
    if (monotony < 1.5) monotonyAssessment = 'Good variety - training load varies appropriately day to day'
    else if (monotony < 2.0) monotonyAssessment = 'Moderate monotony - consider adding more variation'
    else monotonyAssessment = 'High monotony - training too repetitive, risk of staleness'

    // Calculate strain
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
})
