import { NextResponse } from 'next/server'
import { parseFitFile, calculateTSS, calculateIF } from '@/lib/fit-parser'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const ftpStr = formData.get('ftp') as string
    const ftp = parseInt(ftpStr) || 250 // Default FTP if not provided

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Parse the FIT file
    const buffer = await file.arrayBuffer()
    const fitData = await parseFitFile(buffer)

    // Calculate training metrics
    const normalizedPower = fitData.normalized_power || fitData.avg_power || 0
    const tss = calculateTSS(normalizedPower, fitData.duration_seconds, ftp)
    const intensityFactor = calculateIF(normalizedPower, ftp)

    // Determine workout type based on IF
    let workoutType = 'endurance'
    if (intensityFactor >= 1.05) workoutType = 'vo2max'
    else if (intensityFactor >= 0.95) workoutType = 'threshold'
    else if (intensityFactor >= 0.85) workoutType = 'sweetspot'
    else if (intensityFactor >= 0.75) workoutType = 'tempo'
    else if (intensityFactor < 0.65) workoutType = 'recovery'

    // Build session object
    const session = {
      id: 'upload-' + Date.now(),
      athlete_id: 'local',
      date: fitData.date,
      duration_seconds: fitData.duration_seconds,
      distance_meters: fitData.distance_meters,
      sport: 'cycling',
      workout_type: workoutType,
      avg_power: fitData.avg_power,
      normalized_power: normalizedPower,
      max_power: fitData.max_power,
      tss,
      intensity_factor: intensityFactor,
      avg_hr: fitData.avg_hr,
      max_hr: fitData.max_hr,
      avg_cadence: fitData.avg_cadence,
      total_ascent: fitData.total_ascent,
      source: 'fit_upload',
    }

    return NextResponse.json({
      success: true,
      session,
      message: 'Parsed ' + file.name + ': ' + Math.round(fitData.duration_seconds / 60) + ' min, ' + tss + ' TSS',
    })
  } catch (error) {
    console.error('FIT file parse error:', error)
    return NextResponse.json(
      { error: 'Failed to parse FIT file' },
      { status: 500 }
    )
  }
}
