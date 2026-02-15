import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPowerCurveDisplay, STANDARD_DURATIONS } from '@/lib/db/power-bests'
import { getAthlete } from '@/lib/db/athletes'

export interface RiderProfile {
  type: 'sprinter' | 'pursuiter' | 'climber' | 'TT specialist' | 'all-rounder'
  strengths: string[]
  limiters: string[]
  scores: {
    sprinter: number
    pursuiter: number
    climber: number
    ttSpecialist: number
  }
}

export interface PowerCurvePoint {
  duration: number
  durationLabel: string
  watts: number
  wattsPerKg: number | null
  date: string
}

export interface PowerCurveResponse {
  powerCurve: PowerCurvePoint[]
  riderProfile: RiderProfile | null
  weightKg: number | null
  ftp: number | null
}

function calculateRiderProfile(
  powerCurve: PowerCurvePoint[],
  weightKg: number
): RiderProfile {
  // Get power at key durations
  const getPower = (seconds: number) =>
    powerCurve.find(p => p.duration === seconds)?.watts || 0

  const fiveSecPower = getPower(5)
  const oneMinPower = getPower(60)
  const fiveMinPower = getPower(300)
  const twentyMinPower = getPower(1200)

  // Calculate W/kg values
  const fiveSecWkg = fiveSecPower / weightKg
  const oneMinWkg = oneMinPower / weightKg
  const fiveMinWkg = fiveMinPower / weightKg
  const twentyMinWkg = twentyMinPower / weightKg

  // Profile scoring
  const scores = {
    sprinter: 0,
    pursuiter: 0,
    climber: 0,
    ttSpecialist: 0,
  }

  // Sprinter: strong 5s and 1min relative to FTP
  if (fiveSecWkg > 15) scores.sprinter += 2
  if (fiveSecWkg > 18) scores.sprinter += 2
  if (fiveSecPower && twentyMinPower && fiveSecPower / twentyMinPower > 3.5) {
    scores.sprinter += 2
  }

  // Pursuiter: strong 1min relative to others
  if (oneMinWkg > 7) scores.pursuiter += 2
  if (oneMinWkg > 8.5) scores.pursuiter += 2

  // Climber: strong 5min and 20min W/kg
  if (fiveMinWkg > 5) scores.climber += 2
  if (fiveMinWkg > 6) scores.climber += 2
  if (twentyMinWkg > 4.5) scores.climber += 2

  // TT Specialist: strong 20min, good 5min
  if (twentyMinWkg > 4) scores.ttSpecialist += 2
  if (twentyMinWkg > 4.5) scores.ttSpecialist += 2
  if (fiveMinWkg > 5 && twentyMinWkg > 4) scores.ttSpecialist += 1

  // Determine profile type
  const maxScore = Math.max(...Object.values(scores))
  let type: RiderProfile['type'] = 'all-rounder'
  if (maxScore >= 4) {
    if (scores.sprinter === maxScore) type = 'sprinter'
    else if (scores.pursuiter === maxScore) type = 'pursuiter'
    else if (scores.climber === maxScore) type = 'climber'
    else if (scores.ttSpecialist === maxScore) type = 'TT specialist'
  }

  // Identify strengths and limiters based on benchmarks
  const metrics = [
    { label: 'Neuromuscular (5s)', value: fiveSecWkg, benchmark: 15 },
    { label: 'Anaerobic (1min)', value: oneMinWkg, benchmark: 7 },
    { label: 'VO2max (5min)', value: fiveMinWkg, benchmark: 5 },
    { label: 'Threshold (20min)', value: twentyMinWkg, benchmark: 4 },
  ]

  const strengths = metrics
    .filter(m => m.value >= m.benchmark * 1.1)
    .map(m => m.label)

  const limiters = metrics
    .filter(m => m.value > 0 && m.value < m.benchmark * 0.9)
    .map(m => m.label)

  return {
    type,
    strengths,
    limiters,
    scores,
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      )
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const athleteId = user.id

    // Fetch power curve and athlete data in parallel
    const [powerCurve, athlete] = await Promise.all([
      getPowerCurveDisplay(athleteId),
      getAthlete(athleteId),
    ])

    const weightKg = athlete?.weight_kg ?? null
    const ftp = athlete?.ftp ?? null

    // Calculate rider profile if we have power data and weight
    let riderProfile: RiderProfile | null = null
    if (powerCurve.length > 0 && weightKg) {
      riderProfile = calculateRiderProfile(powerCurve, weightKg)
    }

    const response: PowerCurveResponse = {
      powerCurve,
      riderProfile,
      weightKg,
      ftp,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[power-curve] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch power curve data' },
      { status: 500 }
    )
  }
}
