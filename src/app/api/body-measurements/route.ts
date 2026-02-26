import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getLatestBodyMeasurement, getWeightTrend } from '@/lib/db/body-measurements'
import { logger } from '@/lib/logger'

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 503 }
    )
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '30', 10)

  try {
    const [latest, trend] = await Promise.all([
      getLatestBodyMeasurement(user.id),
      getWeightTrend(user.id, days),
    ])

    const change_kg = trend.length >= 2
      ? trend[trend.length - 1].weight_kg - trend[0].weight_kg
      : null

    return NextResponse.json({ latest, trend, change_kg })
  } catch (error) {
    logger.error('Body measurements API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch body measurements' },
      { status: 500 }
    )
  }
}
