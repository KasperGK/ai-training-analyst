/**
 * Self-contained script to generate session reports.
 * Bypasses Next.js server context by using direct Supabase + AI SDK calls.
 * Usage: set -a && source .env.local && set +a && npx tsx scripts/generate-reports.ts
 */
import { createClient } from '@supabase/supabase-js'
import { anthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { z } from 'zod'
import { REPORT_SYSTEM_PROMPT, buildReportPrompt, type SessionType } from '../src/lib/reports/prompts'
import { determineSessionType } from '../src/app/api/chat/tools/get-detailed-session'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const reportSchema = z.object({
  score: z.number(),
  headline: z.string(),
  quick_take: z.string(),
  deep_analysis: z.object({
    execution: z.object({
      score: z.number(),
      summary: z.string(),
      pacing_quality: z.string(),
      power_management: z.string(),
      hr_response: z.string().nullable(),
    }),
    training_value: z.object({
      score: z.number(),
      summary: z.string(),
      physiological_stimulus: z.string(),
      progression_context: z.string(),
    }),
    recovery: z.object({
      score: z.number(),
      summary: z.string(),
      fatigue_indicators: z.string(),
      recovery_recommendation: z.string(),
    }),
    key_observations: z.array(z.string()),
    areas_for_improvement: z.array(z.string()),
  }),
  tags: z.array(z.string()),
  goal_relevance: z.object({
    relevant_goals: z.array(z.object({
      goal_id: z.string(),
      goal_title: z.string(),
      relevance: z.string(),
      impact: z.enum(['positive', 'neutral', 'negative']),
    })),
  }).nullable(),
})

async function main() {
  // Get athlete from sessions
  const { data: recentSession } = await supabase
    .from('sessions')
    .select('athlete_id')
    .order('date', { ascending: false })
    .limit(1)
    .single()

  if (!recentSession) {
    console.error('No sessions found')
    process.exit(1)
  }

  const athleteId = recentSession.athlete_id
  console.log(`Athlete: ${athleteId}`)

  // Get recent cycling sessions with TSS
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 7)

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('athlete_id', athleteId)
    .gte('date', startDate.toISOString().split('T')[0])
    .eq('sport', 'cycling')
    .gt('tss', 0)
    .order('date', { ascending: false })

  if (!sessions?.length) {
    console.log('No eligible sessions')
    process.exit(0)
  }

  // Check existing reports
  const sessionIds = sessions.map(s => s.id)
  const { data: existing } = await supabase
    .from('session_reports')
    .select('session_id')
    .in('session_id', sessionIds)

  const existingIds = new Set(existing?.map(r => r.session_id) || [])
  const toGenerate = sessions.filter(s => !existingIds.has(s.id))

  if (toGenerate.length === 0) {
    console.log('All sessions already have reports!')
    process.exit(0)
  }

  console.log(`\nGenerating reports for ${toGenerate.length} sessions...\n`)

  // Get fitness data and goals
  const { data: goals } = await supabase
    .from('goals')
    .select('id, title, target_type, target_value, current_value')
    .eq('athlete_id', athleteId)
    .eq('status', 'active')

  for (const session of toGenerate) {
    try {
      // Get fitness for session date
      const { data: fitness } = await supabase
        .from('fitness_history')
        .select('ctl, atl, tsb')
        .eq('athlete_id', athleteId)
        .lte('date', session.date)
        .order('date', { ascending: false })
        .limit(1)
        .single()

      const promptData = {
        session: {
          date: session.date,
          duration_seconds: session.duration_seconds,
          sport: session.sport,
          workout_type: session.workout_type,
          avg_power: session.avg_power,
          max_power: session.max_power,
          normalized_power: session.normalized_power,
          intensity_factor: session.intensity_factor,
          tss: session.tss,
          avg_hr: session.avg_hr,
          max_hr: session.max_hr,
          avg_cadence: session.avg_cadence,
          power_zones: session.power_zones,
          hr_zones: session.hr_zones,
          notes: session.notes,
          name: session.raw_data?.name || session.workout_type,
        },
        fitness_context: fitness ? { ctl: fitness.ctl, atl: fitness.atl, tsb: fitness.tsb } : null,
        active_goals: goals?.length ? goals : null,
      }

      const sessionType = determineSessionType(
        session.intensity_factor ?? null,
        session.tss ?? null,
        session.duration_seconds ?? null,
        session.raw_data?.name || session.workout_type || null,
      ) as SessionType

      console.log(`  Scoring: ${session.date} | ${session.raw_data?.name || session.workout_type || 'ride'} | type: ${sessionType} | TSS: ${session.tss}...`)

      const result = await generateObject({
        model: anthropic('claude-opus-4-5-20251101'),
        schema: reportSchema,
        system: REPORT_SYSTEM_PROMPT,
        prompt: buildReportPrompt(promptData, sessionType),
      })

      const report = result.object

      // Insert report
      const { error: insertErr } = await supabase
        .from('session_reports')
        .insert({
          athlete_id: athleteId,
          session_id: session.id,
          score: report.score,
          headline: report.headline,
          quick_take: report.quick_take,
          deep_analysis: report.deep_analysis,
          tags: report.tags,
          goal_relevance: report.goal_relevance,
          session_context: {
            session_type: session.workout_type,
            ctl: fitness?.ctl ?? null,
            atl: fitness?.atl ?? null,
            tsb: fitness?.tsb ?? null,
          },
          is_read: false,
        })

      if (insertErr) {
        console.log(`    ERROR inserting: ${insertErr.message}`)
      } else {
        console.log(`    → Score: ${report.score} | "${report.headline}"`)
      }
    } catch (err) {
      console.log(`    ERROR: ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log('\nDone!')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
