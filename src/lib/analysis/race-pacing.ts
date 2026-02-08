/**
 * Race-Specific Pacing & Tactical Analysis
 *
 * Goes beyond generic pacing analysis with quarter splits,
 * surge detection, sprint finish analysis, and tactical assessment.
 */

export interface RacePacingAnalysis {
  /** Average power per quarter of the race */
  quarters: {
    q1: number
    q2: number
    q3: number
    q4: number
  }
  /** Percentage power drop from Q1 to Q4 (positive = fade) */
  fadePercent: number
  /** Surge efforts (>130% avg power lasting >5s) */
  surges: {
    total: number
    earlyRace: number   // first third
    midRace: number     // middle third
    lateRace: number    // final third
  }
  /** Sprint finish analysis (final 60s) */
  sprintFinish: {
    maxPowerFinal60s: number
    avgPowerFinal60s: number
    raceAvgPower: number
    sprintRatio: number  // maxFinal60s / raceAvg — >1.5 = strong kick
    hasKick: boolean
  }
  /** Linear regression slope of 5-min rolling avg power (W/min, negative = fading) */
  fadeRate: number
  /** Human-readable tactical assessment */
  assessment: string
}

/**
 * Analyze race pacing tactically.
 * Takes raw watts array, FTP, and race duration in seconds.
 */
export function analyzeRacePacing(
  watts: number[],
  ftp: number | null,
  durationSeconds: number
): RacePacingAnalysis | null {
  const validWatts = watts.filter(w => w > 0)
  if (validWatts.length < 60) return null // need at least 60s of data

  const raceAvg = validWatts.reduce((a, b) => a + b, 0) / validWatts.length

  // Quarter splits
  const qLen = Math.floor(validWatts.length / 4)
  const q1Watts = validWatts.slice(0, qLen)
  const q2Watts = validWatts.slice(qLen, qLen * 2)
  const q3Watts = validWatts.slice(qLen * 2, qLen * 3)
  const q4Watts = validWatts.slice(qLen * 3)

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

  const q1 = Math.round(avg(q1Watts))
  const q2 = Math.round(avg(q2Watts))
  const q3 = Math.round(avg(q3Watts))
  const q4 = Math.round(avg(q4Watts))

  const fadePercent = q1 > 0 ? Math.round(((q1 - q4) / q1) * 100) : 0

  // Surge detection (>130% avg power for >5s)
  const surgeThreshold = raceAvg * 1.3
  const thirdLen = Math.floor(validWatts.length / 3)
  let surges = { total: 0, earlyRace: 0, midRace: 0, lateRace: 0 }
  let currentSurgeLength = 0
  let surgeStartIdx = 0

  for (let i = 0; i < validWatts.length; i++) {
    if (validWatts[i] > surgeThreshold) {
      if (currentSurgeLength === 0) surgeStartIdx = i
      currentSurgeLength++
    } else {
      if (currentSurgeLength >= 5) {
        surges.total++
        const surgeMidpoint = surgeStartIdx + Math.floor(currentSurgeLength / 2)
        if (surgeMidpoint < thirdLen) surges.earlyRace++
        else if (surgeMidpoint < thirdLen * 2) surges.midRace++
        else surges.lateRace++
      }
      currentSurgeLength = 0
    }
  }
  // Handle surge at end
  if (currentSurgeLength >= 5) {
    surges.total++
    surges.lateRace++
  }

  // Sprint finish (final 60s)
  const final60 = validWatts.slice(-60)
  const avgPowerFinal60s = Math.round(avg(final60))
  const maxPowerFinal60s = Math.round(Math.max(...final60))
  const sprintRatio = raceAvg > 0 ? Math.round((maxPowerFinal60s / raceAvg) * 100) / 100 : 0
  const hasKick = sprintRatio >= 1.5

  // Fade rate: linear regression of 5-min rolling avg
  const windowSize = Math.min(300, Math.floor(validWatts.length / 4))
  const rollingAvgs: number[] = []
  if (windowSize > 0) {
    let windowSum = 0
    for (let i = 0; i < windowSize && i < validWatts.length; i++) {
      windowSum += validWatts[i]
    }
    rollingAvgs.push(windowSum / windowSize)
    for (let i = windowSize; i < validWatts.length; i++) {
      windowSum = windowSum - validWatts[i - windowSize] + validWatts[i]
      rollingAvgs.push(windowSum / windowSize)
    }
  }

  // Simple linear regression: slope in W per sample
  let fadeRate = 0
  if (rollingAvgs.length > 1) {
    const n = rollingAvgs.length
    const sumX = (n * (n - 1)) / 2
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6
    const sumY = rollingAvgs.reduce((a, b) => a + b, 0)
    let sumXY = 0
    for (let i = 0; i < n; i++) {
      sumXY += i * rollingAvgs[i]
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    // Convert from W/sample to W/minute
    fadeRate = Math.round(slope * 60 * 100) / 100
  }

  // Build tactical assessment
  const parts: string[] = []

  if (fadePercent > 10) {
    parts.push(`Faded ${fadePercent}% from Q1 to Q4`)
  } else if (fadePercent < -5) {
    parts.push(`Negative split — Q4 was ${Math.abs(fadePercent)}% stronger than Q1`)
  } else {
    parts.push('Even pacing across quarters')
  }

  if (surges.total > 0) {
    const timing = surges.earlyRace > surges.lateRace
      ? 'mostly in the first half'
      : surges.lateRace > surges.earlyRace
        ? 'mostly in the final third'
        : 'spread throughout'
    parts.push(`${surges.total} surge${surges.total > 1 ? 's' : ''} (>130% avg), ${timing}`)

    if (surges.earlyRace > 3 && fadePercent > 10) {
      parts.push('burned too many matches early')
    }
  } else {
    parts.push('No major surges — steady effort')
  }

  if (hasKick) {
    parts.push(`Strong sprint finish (${sprintRatio}x race avg in final 60s)`)
  } else if (sprintRatio < 1.1 && durationSeconds < 3600) {
    parts.push('No sprint finish — may have left power on the table')
  }

  const assessment = parts.join('. ') + '.'

  return {
    quarters: { q1, q2, q3, q4 },
    fadePercent,
    surges,
    sprintFinish: {
      maxPowerFinal60s,
      avgPowerFinal60s,
      raceAvgPower: Math.round(raceAvg),
      sprintRatio,
      hasKick,
    },
    fadeRate,
    assessment,
  }
}
