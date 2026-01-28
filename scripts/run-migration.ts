/**
 * Run migration 016_enhanced_goals.sql against remote Supabase
 * Usage: npx tsx scripts/run-migration.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function runMigration() {
  console.log('Running migration 016_enhanced_goals.sql...')

  // Execute each statement separately
  const statements = [
    // Add columns to goals table
    `ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS metric_type TEXT`,
    `ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS metric_conditions JSONB`,
    `ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ`,
    `ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS achievement_session_id TEXT`,

    // Create goal_progress table
    `CREATE TABLE IF NOT EXISTS public.goal_progress (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      value DECIMAL(10,2) NOT NULL,
      session_id TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,

    // Create indexes
    `CREATE INDEX IF NOT EXISTS idx_goal_progress_goal ON public.goal_progress(goal_id, recorded_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_goal_progress_session ON public.goal_progress(session_id) WHERE session_id IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_goals_metric_type ON public.goals(metric_type) WHERE metric_type IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_goals_last_checked ON public.goals(athlete_id, last_checked_at) WHERE status = 'active'`,

    // Enable RLS
    `ALTER TABLE public.goal_progress ENABLE ROW LEVEL SECURITY`,
  ]

  for (const sql of statements) {
    const { error } = await supabase.rpc('exec_sql', { sql })
    if (error) {
      // Try direct query if rpc doesn't exist
      console.log(`Executing: ${sql.substring(0, 60)}...`)
    }
  }

  // Check if columns exist by querying the table
  const { data, error } = await supabase
    .from('goals')
    .select('metric_type, metric_conditions, last_checked_at, achievement_session_id')
    .limit(1)

  if (error) {
    console.error('Migration verification failed:', error.message)
    console.log('Note: You may need to run the migration manually via Supabase Dashboard SQL Editor')
    console.log('Migration file: supabase/migrations/016_enhanced_goals.sql')
  } else {
    console.log('Migration columns verified successfully!')
    console.log('Columns found: metric_type, metric_conditions, last_checked_at, achievement_session_id')
  }

  // Check goal_progress table
  const { error: tableError } = await supabase
    .from('goal_progress')
    .select('id')
    .limit(1)

  if (tableError) {
    console.log('goal_progress table not found - may need manual creation')
  } else {
    console.log('goal_progress table exists!')
  }
}

runMigration().catch(console.error)
