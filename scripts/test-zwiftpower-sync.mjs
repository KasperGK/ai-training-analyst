/**
 * Test script for ZwiftPower sync
 * Run with: node scripts/test-zwiftpower-sync.mjs
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
  console.log('Testing ZwiftPower Sync...\n')

  // Get an athlete with ZwiftPower connected
  const { data: integration, error: intError } = await supabase
    .from('integrations')
    .select('athlete_id, zwift_id, zwift_username')
    .eq('provider', 'zwiftpower')
    .not('zwift_id', 'is', null)
    .limit(1)
    .single()

  if (intError || !integration) {
    console.error('No athlete with ZwiftPower connected found')
    console.error(intError)
    process.exit(1)
  }

  console.log(`Found athlete: ${integration.athlete_id}`)
  console.log(`Zwift ID: ${integration.zwift_id}`)
  console.log(`Username: ${integration.zwift_username}\n`)

  // Check existing race results
  const { count: beforeCount } = await supabase
    .from('race_results')
    .select('*', { count: 'exact', head: true })
    .eq('athlete_id', integration.athlete_id)

  console.log(`Race results before sync: ${beforeCount || 0}`)

  // Check existing competitors
  const { count: compBefore } = await supabase
    .from('race_competitors')
    .select('*', { count: 'exact', head: true })
    .eq('race_result_id', await getAnyRaceResultId(integration.athlete_id))

  console.log(`Total competitors before: checking...`)

  // Get recent sessions that might be races
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, date, workout_type, avg_power, duration_seconds')
    .eq('athlete_id', integration.athlete_id)
    .ilike('workout_type', '%race%')
    .order('date', { ascending: false })
    .limit(10)

  console.log(`\nRecent race sessions found: ${sessions?.length || 0}`)
  sessions?.forEach(s => {
    console.log(`  - ${s.date}: ${s.workout_type} (${s.avg_power}W, ${Math.round(s.duration_seconds/60)}min)`)
  })

  // Get race results
  const { data: raceResults } = await supabase
    .from('race_results')
    .select('id, race_name, race_date, placement, total_in_category, category, avg_power')
    .eq('athlete_id', integration.athlete_id)
    .order('race_date', { ascending: false })
    .limit(5)

  console.log(`\nSynced race results:`)
  if (raceResults?.length) {
    raceResults.forEach(r => {
      console.log(`  - ${r.race_date}: ${r.race_name}`)
      console.log(`    P${r.placement}/${r.total_in_category} in Cat ${r.category}, ${r.avg_power}W`)
    })
  } else {
    console.log('  (none)')
  }

  // Get competitors for most recent race
  if (raceResults?.length) {
    const { data: competitors } = await supabase
      .from('race_competitors')
      .select('rider_name, placement, avg_power, avg_wkg, position_delta')
      .eq('race_result_id', raceResults[0].id)
      .order('placement')
      .limit(10)

    console.log(`\nCompetitors for "${raceResults[0].race_name}":`)
    competitors?.forEach(c => {
      const delta = c.position_delta > 0 ? `+${c.position_delta}` : c.position_delta
      console.log(`  P${c.placement}: ${c.rider_name} - ${c.avg_power}W (${c.avg_wkg?.toFixed(2)}W/kg) [${delta}]`)
    })
  }

  console.log('\n✅ Test complete!')
}

async function getAnyRaceResultId(athleteId) {
  const { data } = await supabase
    .from('race_results')
    .select('id')
    .eq('athlete_id', athleteId)
    .limit(1)
    .single()
  return data?.id
}

main().catch(console.error)
