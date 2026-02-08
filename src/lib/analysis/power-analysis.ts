/**
 * Shared Power Analysis Utilities
 *
 * Extracted from get-detailed-session.ts for reuse across tools.
 */

export interface PeakPowers {
  peak_5s: number | null
  peak_30s: number | null
  peak_1min: number | null
  peak_5min: number | null
  peak_20min: number | null
}

export interface PacingAnalysis {
  firstHalfAvgPower: number | null
  secondHalfAvgPower: number | null
  negativeSplit: boolean
  splitDifferencePercent: number | null
  variabilityIndex: number | null
  matchBurns: number
}

/**
 * Calculate peak power for a given duration from power stream
 */
export function calculatePeakPower(watts: number[], durationSeconds: number): number | null {
  if (!watts || watts.length < durationSeconds) return null

  let maxAvg = 0
  let windowSum = 0

  // Initialize window
  for (let i = 0; i < durationSeconds && i < watts.length; i++) {
    windowSum += watts[i] || 0
  }
  maxAvg = windowSum / durationSeconds

  // Slide window
  for (let i = durationSeconds; i < watts.length; i++) {
    windowSum = windowSum - (watts[i - durationSeconds] || 0) + (watts[i] || 0)
    const avg = windowSum / durationSeconds
    if (avg > maxAvg) maxAvg = avg
  }

  return Math.round(maxAvg)
}

/**
 * Analyze pacing from power stream
 */
export function analyzePacing(watts: number[], ftp: number | null): PacingAnalysis {
  const validWatts = watts.filter(w => w > 0)
  if (validWatts.length < 10) {
    return {
      firstHalfAvgPower: null,
      secondHalfAvgPower: null,
      negativeSplit: false,
      splitDifferencePercent: null,
      variabilityIndex: null,
      matchBurns: 0,
    }
  }

  const mid = Math.floor(validWatts.length / 2)
  const firstHalf = validWatts.slice(0, mid)
  const secondHalf = validWatts.slice(mid)

  const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
  const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
  const overallAvg = validWatts.reduce((a, b) => a + b, 0) / validWatts.length

  // Calculate normalized power for VI
  const thirtySecondRolling: number[] = []
  for (let i = 29; i < validWatts.length; i++) {
    const windowAvg = validWatts.slice(i - 29, i + 1).reduce((a, b) => a + b, 0) / 30
    thirtySecondRolling.push(Math.pow(windowAvg, 4))
  }
  const np = thirtySecondRolling.length > 0
    ? Math.pow(thirtySecondRolling.reduce((a, b) => a + b, 0) / thirtySecondRolling.length, 0.25)
    : overallAvg

  const variabilityIndex = overallAvg > 0 ? np / overallAvg : null

  // Count match burns (>120% FTP for >10s)
  let matchBurns = 0
  if (ftp) {
    const threshold = ftp * 1.2
    let currentBurnLength = 0
    for (const w of validWatts) {
      if (w > threshold) {
        currentBurnLength++
      } else {
        if (currentBurnLength >= 10) matchBurns++
        currentBurnLength = 0
      }
    }
    if (currentBurnLength >= 10) matchBurns++
  }

  const splitDiff = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : null

  return {
    firstHalfAvgPower: Math.round(firstHalfAvg),
    secondHalfAvgPower: Math.round(secondHalfAvg),
    negativeSplit: secondHalfAvg > firstHalfAvg,
    splitDifferencePercent: splitDiff ? Math.round(splitDiff * 10) / 10 : null,
    variabilityIndex: variabilityIndex ? Math.round(variabilityIndex * 100) / 100 : null,
    matchBurns,
  }
}
