/**
 * Insights Generation API
 *
 * POST: Trigger insight generation for the authenticated athlete
 * GET: Check generation status
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateInsights } from '@/lib/insights/insight-generator'

const ENABLE_INSIGHTS = process.env.FEATURE_INSIGHTS === 'true'

export async function POST() {
  if (!ENABLE_INSIGHTS) {
    return NextResponse.json({ error: 'Insights feature not enabled' }, { status: 400 })
  }

  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 })
  }

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const result = await generateInsights(user.id)

    return NextResponse.json({
      success: result.success,
      insightsCreated: result.insightsCreated,
      patternsDetected: result.patternsDetected,
      error: result.error,
    })
  } catch (error) {
    console.error('[Insights Generate API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate insights',
    }, { status: 500 })
  }
}

export async function GET() {
  if (!ENABLE_INSIGHTS) {
    return NextResponse.json({ enabled: false })
  }

  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 })
  }

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    // Get last generation info
    const { data: lastGen } = await supabase
      .from('insight_generation_log')
      .select('generated_at, insights_created, patterns_detected, duration_ms')
      .eq('athlete_id', user.id)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    // Check if generation is needed
    const { data: shouldGenerate } = await supabase.rpc('should_generate_insights', {
      p_athlete_id: user.id,
    })

    return NextResponse.json({
      enabled: true,
      shouldGenerate,
      lastGeneration: lastGen ? {
        generatedAt: lastGen.generated_at,
        insightsCreated: lastGen.insights_created,
        patternsDetected: lastGen.patterns_detected,
        durationMs: lastGen.duration_ms,
      } : null,
    })
  } catch (error) {
    console.error('[Insights Generate API] GET error:', error)
    return NextResponse.json({ enabled: true, error: 'Failed to get status' }, { status: 500 })
  }
}
