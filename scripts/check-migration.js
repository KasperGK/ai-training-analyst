require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.log('Missing env vars');
  process.exit(1);
}

const supabase = createClient(url, key);

async function check() {
  // Check if new columns exist
  const { data, error } = await supabase
    .from('goals')
    .select('id, metric_type')
    .limit(1);

  if (error && error.message.includes('metric_type')) {
    console.log('NEED_MIGRATION: Column metric_type does not exist');
    return false;
  } else if (error) {
    console.log('Goals query:', error.message);
  } else {
    console.log('OK: metric_type column exists');
  }

  // Check goal_progress table
  const { error: tableError } = await supabase
    .from('goal_progress')
    .select('id')
    .limit(1);

  if (tableError && (tableError.code === '42P01' || tableError.message.includes('does not exist'))) {
    console.log('NEED_TABLE: goal_progress table does not exist');
    return false;
  } else if (tableError) {
    console.log('Table check:', tableError.code, tableError.message);
  } else {
    console.log('OK: goal_progress table exists');
  }
  return true;
}

check().then(ok => {
  if (!ok) {
    console.log('\nRun migration via Supabase Dashboard SQL Editor:');
    console.log('  supabase/migrations/016_enhanced_goals.sql');
  }
});
