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
  const { data, error } = await supabase
    .from('fitness_history')
    .select('id, ramp_rate')
    .limit(1);

  if (error && (error.message.includes('ramp_rate') || error.code === '42703')) {
    console.log('Column ramp_rate does NOT exist - migration needed');
    console.log('');
    console.log('Please run this SQL in Supabase Dashboard SQL Editor:');
    const projectId = url.split('//')[1].split('.')[0];
    console.log('https://supabase.com/dashboard/project/' + projectId + '/sql/new');
    console.log('');
    require('fs').readFileSync('./supabase/migrations/018_ramp_rate.sql', 'utf8').split('\n').forEach(l => console.log(l));
    process.exit(1);
  } else if (error) {
    console.log('Error:', error.message);
    process.exit(1);
  } else {
    console.log('✓ Column ramp_rate already exists!');
    if (data && data.length > 0) {
      console.log('Sample data:', data);
    }
  }
}

check();
