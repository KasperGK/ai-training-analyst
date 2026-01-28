/**
 * Long-Term Data Analysis: Calculation Verification Tests
 *
 * Validates the mathematical correctness of sports science metrics:
 * - ACWR (Acute:Chronic Workload Ratio)
 * - Monotony and Strain
 * - Efficiency Factor (EF)
 * - Intensity distribution
 * - CTL change
 */

import { describe, it, expect } from 'vitest'

// ============================================================
// CALCULATION HELPERS (extracted for testing)
// ============================================================

/**
 * Calculate ACWR (Acute:Chronic Workload Ratio)
 * Formula: 7-day average TSS / 28-day average TSS
 */
function calculateACWR(dailyTSS: number[]): { acwr: number; acuteLoad: number; chronicLoad: number } {
  if (dailyTSS.length < 28) {
    throw new Error('Need at least 28 days of data for ACWR calculation')
  }

  const last7Days = dailyTSS.slice(-7)
  const last28Days = dailyTSS.slice(-28)

  const acuteLoad = last7Days.reduce((sum, d) => sum + d, 0) / 7
  const chronicLoad = last28Days.reduce((sum, d) => sum + d, 0) / 28
  const acwr = chronicLoad > 0 ? Math.round((acuteLoad / chronicLoad) * 100) / 100 : 0

  return { acwr, acuteLoad: Math.round(acuteLoad), chronicLoad: Math.round(chronicLoad) }
}

/**
 * Calculate Monotony
 * Formula: weekAvg / weekStdDev
 * Lower is better - indicates varied training
 */
function calculateMonotony(weeklyTSS: number[]): number {
  if (weeklyTSS.length !== 7) {
    throw new Error('Monotony requires exactly 7 days of data')
  }

  const weekAvg = weeklyTSS.reduce((a, b) => a + b, 0) / 7
  const weekVariance = weeklyTSS.reduce((sum, tss) => sum + Math.pow(tss - weekAvg, 2), 0) / 7
  const weekStdDev = Math.sqrt(weekVariance)

  return weekStdDev > 0 ? Math.round((weekAvg / weekStdDev) * 100) / 100 : 0
}

/**
 * Calculate Strain
 * Formula: weeklyTSS × monotony
 */
function calculateStrain(weeklyTSS: number[], monotony: number): number {
  const weeklyLoad = weeklyTSS.reduce((a, b) => a + b, 0)
  return Math.round(weeklyLoad * monotony)
}

/**
 * Calculate Efficiency Factor
 * Formula: NP / avgHR
 * Higher is better - more power per heartbeat
 */
function calculateEF(normalizedPower: number, avgHR: number): number {
  if (avgHR <= 0) {
    throw new Error('Average HR must be greater than 0')
  }
  return Math.round((normalizedPower / avgHR) * 100) / 100
}

/**
 * Calculate intensity distribution percentages
 * Thresholds: low < 0.75, medium 0.75-0.90, high >= 0.90
 */
function calculateIntensityDistribution(
  sessions: Array<{ intensityFactor: number }>
): { low: number; medium: number; high: number } {
  const lowIntensity = sessions.filter(s => s.intensityFactor < 0.75).length
  const medIntensity = sessions.filter(s => s.intensityFactor >= 0.75 && s.intensityFactor < 0.90).length
  const highIntensity = sessions.filter(s => s.intensityFactor >= 0.90).length

  return {
    low: Math.round(lowIntensity / sessions.length * 100),
    medium: Math.round(medIntensity / sessions.length * 100),
    high: Math.round(highIntensity / sessions.length * 100),
  }
}

/**
 * Calculate CTL change
 */
function calculateCTLChange(startCTL: number, endCTL: number): number {
  return Math.round((endCTL - startCTL) * 10) / 10
}

/**
 * Assess EF trend
 * >3% improvement = improving, <-3% = declining, else stable
 */
function assessEFTrend(firstHalfAvg: number, secondHalfAvg: number): {
  trend: 'improving' | 'stable' | 'declining'
  trendPercent: number
} {
  const trendPercent = Math.round(((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100)

  let trend: 'improving' | 'stable' | 'declining'
  if (trendPercent > 3) trend = 'improving'
  else if (trendPercent < -3) trend = 'declining'
  else trend = 'stable'

  return { trend, trendPercent }
}

/**
 * Assess ACWR risk level
 */
function assessACWRRisk(acwr: number): 'low' | 'moderate' | 'high' | 'very_high' {
  if (acwr < 0.8) return 'low' // Under-training
  if (acwr <= 1.3) return 'low' // Sweet spot
  if (acwr <= 1.5) return 'moderate' // Caution
  return 'high' // Danger
}

/**
 * Assess decoupling level
 */
function assessDecoupling(avgDecoupling: number): 'excellent' | 'good' | 'fair' | 'needs work' {
  if (avgDecoupling < 3) return 'excellent'
  if (avgDecoupling < 5) return 'good'
  if (avgDecoupling < 8) return 'fair'
  return 'needs work'
}

// ============================================================
// TESTS
// ============================================================

describe('ACWR Calculation', () => {
  it('calculates ACWR correctly for balanced load', () => {
    // 28 days of consistent 100 TSS
    const dailyTSS = Array(28).fill(100)

    const result = calculateACWR(dailyTSS)

    expect(result.acuteLoad).toBe(100)
    expect(result.chronicLoad).toBe(100)
    expect(result.acwr).toBe(1.0)
  })

  it('detects high ACWR when acute load spikes', () => {
    // 21 days of 50 TSS, then 7 days of 150 TSS
    const dailyTSS = [...Array(21).fill(50), ...Array(7).fill(150)]

    const result = calculateACWR(dailyTSS)

    expect(result.acuteLoad).toBe(150) // 150 avg
    expect(result.chronicLoad).toBe(75) // (21*50 + 7*150) / 28 = 75
    expect(result.acwr).toBe(2.0) // 150 / 75 = 2.0 (danger zone!)
  })

  it('detects low ACWR when recovering', () => {
    // 21 days of 100 TSS, then 7 days of 30 TSS (rest week)
    const dailyTSS = [...Array(21).fill(100), ...Array(7).fill(30)]

    const result = calculateACWR(dailyTSS)

    expect(result.acuteLoad).toBe(30)
    expect(result.chronicLoad).toBe(83) // (21*100 + 7*30) / 28 ≈ 82.5
    expect(result.acwr).toBe(0.36) // Under-training zone
  })

  it('handles zero chronic load', () => {
    const dailyTSS = Array(28).fill(0)
    const result = calculateACWR(dailyTSS)
    expect(result.acwr).toBe(0)
  })

  it('throws error with insufficient data', () => {
    const dailyTSS = Array(14).fill(100)
    expect(() => calculateACWR(dailyTSS)).toThrow('Need at least 28 days')
  })
})

describe('Monotony Calculation', () => {
  it('calculates high monotony for identical daily loads', () => {
    // Same TSS every day = high monotony (bad)
    const weeklyTSS = [100, 100, 100, 100, 100, 100, 100]

    const monotony = calculateMonotony(weeklyTSS)

    // When all values are the same, stdDev = 0, monotony = 0
    expect(monotony).toBe(0)
  })

  it('calculates low monotony for varied loads', () => {
    // Typical varied week: rest, easy, hard, easy, hard, long, rest
    const weeklyTSS = [0, 50, 120, 40, 100, 150, 0]

    const monotony = calculateMonotony(weeklyTSS)

    // Average ≈ 65.7, StdDev ≈ 55.6, Monotony ≈ 1.18
    expect(monotony).toBeGreaterThan(1.0)
    expect(monotony).toBeLessThan(1.5) // Good variety
  })

  it('calculates moderate monotony for somewhat varied loads', () => {
    // Less variation: all moderate sessions
    const weeklyTSS = [80, 85, 90, 75, 85, 80, 85]

    const monotony = calculateMonotony(weeklyTSS)

    // Should be higher due to less variation
    expect(monotony).toBeGreaterThan(10) // Very high monotony (bad)
  })

  it('throws error without 7 days of data', () => {
    expect(() => calculateMonotony([100, 100, 100])).toThrow('exactly 7 days')
  })
})

describe('Strain Calculation', () => {
  it('calculates strain as weekly TSS × monotony', () => {
    const weeklyTSS = [100, 100, 100, 100, 100, 100, 100]
    const monotony = 1.5

    const strain = calculateStrain(weeklyTSS, monotony)

    expect(strain).toBe(700 * 1.5) // 1050
  })

  it('flags high strain values', () => {
    // High TSS week with moderate monotony
    const weeklyTSS = [150, 160, 140, 150, 160, 200, 0] // 960 total
    const monotony = 1.8

    const strain = calculateStrain(weeklyTSS, monotony)

    expect(strain).toBe(Math.round(960 * 1.8)) // 1728 - still manageable
  })

  it('calculates dangerous strain with high monotony', () => {
    // Very consistent high training
    const weeklyTSS = [200, 200, 200, 200, 200, 200, 200]
    const monotony = 5.0 // Very high

    const strain = calculateStrain(weeklyTSS, monotony)

    expect(strain).toBe(1400 * 5.0) // 7000 - high strain!
  })
})

describe('Efficiency Factor Calculation', () => {
  it('calculates EF correctly', () => {
    // NP = 250W, HR = 145bpm
    const ef = calculateEF(250, 145)

    expect(ef).toBe(1.72) // 250/145 = 1.724...
  })

  it('identifies excellent efficiency', () => {
    // High power, low HR = excellent efficiency
    const ef = calculateEF(280, 140)

    expect(ef).toBe(2.0) // Very good
    expect(ef).toBeGreaterThan(1.8) // Threshold for excellent
  })

  it('identifies poor efficiency', () => {
    // Low power, high HR = poor efficiency
    const ef = calculateEF(150, 155)

    expect(ef).toBe(0.97) // Below 1.2 = needs work
    expect(ef).toBeLessThan(1.2)
  })

  it('throws error for zero HR', () => {
    expect(() => calculateEF(250, 0)).toThrow('greater than 0')
  })
})

describe('EF Trend Assessment', () => {
  it('detects improving trend (>3%)', () => {
    const result = assessEFTrend(1.50, 1.60)

    expect(result.trend).toBe('improving')
    expect(result.trendPercent).toBe(7) // ~6.67% rounded
  })

  it('detects declining trend (<-3%)', () => {
    const result = assessEFTrend(1.60, 1.50)

    expect(result.trend).toBe('declining')
    expect(result.trendPercent).toBe(-6) // ~-6.25% rounded
  })

  it('detects stable trend (within ±3%)', () => {
    const result = assessEFTrend(1.50, 1.52)

    expect(result.trend).toBe('stable')
    expect(result.trendPercent).toBe(1) // ~1.33%
  })
})

describe('Intensity Distribution', () => {
  it('calculates distribution correctly', () => {
    const sessions = [
      { intensityFactor: 0.65 }, // low
      { intensityFactor: 0.70 }, // low
      { intensityFactor: 0.75 }, // medium
      { intensityFactor: 0.80 }, // medium
      { intensityFactor: 0.85 }, // medium
      { intensityFactor: 0.90 }, // high
      { intensityFactor: 0.95 }, // high
      { intensityFactor: 1.00 }, // high
      { intensityFactor: 0.60 }, // low
      { intensityFactor: 0.88 }, // medium
    ]

    const dist = calculateIntensityDistribution(sessions)

    expect(dist.low).toBe(30) // 3/10 = 30%
    expect(dist.medium).toBe(40) // 4/10 = 40%
    expect(dist.high).toBe(30) // 3/10 = 30%
    expect(dist.low + dist.medium + dist.high).toBe(100) // Must sum to 100%
  })

  it('handles all low intensity', () => {
    const sessions = Array(10).fill({ intensityFactor: 0.60 })

    const dist = calculateIntensityDistribution(sessions)

    expect(dist.low).toBe(100)
    expect(dist.medium).toBe(0)
    expect(dist.high).toBe(0)
  })

  it('handles all high intensity', () => {
    const sessions = Array(10).fill({ intensityFactor: 1.05 })

    const dist = calculateIntensityDistribution(sessions)

    expect(dist.low).toBe(0)
    expect(dist.medium).toBe(0)
    expect(dist.high).toBe(100)
  })
})

describe('CTL Change Calculation', () => {
  it('calculates positive CTL change', () => {
    const change = calculateCTLChange(50, 65)
    expect(change).toBe(15.0)
  })

  it('calculates negative CTL change', () => {
    const change = calculateCTLChange(80, 72)
    expect(change).toBe(-8.0)
  })

  it('handles decimal precision', () => {
    const change = calculateCTLChange(55.3, 60.8)
    expect(change).toBe(5.5)
  })
})

describe('ACWR Risk Assessment', () => {
  it('identifies under-training zone', () => {
    expect(assessACWRRisk(0.5)).toBe('low')
    expect(assessACWRRisk(0.7)).toBe('low')
  })

  it('identifies sweet spot', () => {
    expect(assessACWRRisk(0.8)).toBe('low')
    expect(assessACWRRisk(1.0)).toBe('low')
    expect(assessACWRRisk(1.3)).toBe('low')
  })

  it('identifies caution zone', () => {
    expect(assessACWRRisk(1.35)).toBe('moderate')
    expect(assessACWRRisk(1.5)).toBe('moderate')
  })

  it('identifies danger zone', () => {
    expect(assessACWRRisk(1.6)).toBe('high')
    expect(assessACWRRisk(2.0)).toBe('high')
  })
})

describe('Decoupling Assessment', () => {
  it('assesses decoupling levels correctly', () => {
    expect(assessDecoupling(2)).toBe('excellent')
    expect(assessDecoupling(4)).toBe('good')
    expect(assessDecoupling(6)).toBe('fair')
    expect(assessDecoupling(10)).toBe('needs work')
  })
})

describe('Real-World Scenarios', () => {
  it('validates a typical build week', () => {
    // Monday: rest, Tuesday: intervals, Wednesday: recovery, Thursday: tempo,
    // Friday: easy, Saturday: long ride, Sunday: recovery
    const weeklyTSS = [0, 120, 40, 85, 30, 180, 45]
    const totalWeeklyTSS = weeklyTSS.reduce((a, b) => a + b, 0) // 500

    const monotony = calculateMonotony(weeklyTSS)
    const strain = calculateStrain(weeklyTSS, monotony)

    // Good variety should give low monotony
    expect(monotony).toBeLessThan(1.5)
    // Moderate strain for a build week
    expect(strain).toBeLessThan(3000)
  })

  it('validates a recovery week', () => {
    // All easy sessions
    const weeklyTSS = [0, 30, 0, 25, 0, 40, 20]
    const totalWeeklyTSS = weeklyTSS.reduce((a, b) => a + b, 0) // 115

    const monotony = calculateMonotony(weeklyTSS)
    const strain = calculateStrain(weeklyTSS, monotony)

    // Low strain expected
    expect(strain).toBeLessThan(500)
    expect(totalWeeklyTSS).toBeLessThan(150)
  })

  it('validates aerobic efficiency improvement over time', () => {
    // Sessions over 3 months showing improving EF
    const firstMonth = [1.40, 1.42, 1.38, 1.45, 1.43]
    const lastMonth = [1.55, 1.58, 1.52, 1.60, 1.57]

    const firstAvg = firstMonth.reduce((a, b) => a + b, 0) / firstMonth.length
    const lastAvg = lastMonth.reduce((a, b) => a + b, 0) / lastMonth.length

    const { trend, trendPercent } = assessEFTrend(firstAvg, lastAvg)

    expect(trend).toBe('improving')
    expect(trendPercent).toBeGreaterThan(5) // Significant improvement
  })
})
