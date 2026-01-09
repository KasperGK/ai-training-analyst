const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://wihgzpxydkmojggzyogh.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpaGd6cHh5ZGttb2pnZ3p5b2doIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzkzOTc5NCwiZXhwIjoyMDgzNTE1Nzk0fQ.Mi9zPMJLhWB4DooYpEMo1BleROUfmIIJhELxutSuntc';

async function run() {
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  
  // Check if athletes table exists
  const { data, error } = await supabase.from('athletes').select('id').limit(1);
  
  if (error && error.code === '42P01') {
    console.log('Tables do not exist yet. Need to run migrations manually.');
    console.log('\nPlease go to: https://supabase.com/dashboard/project/wihgzpxydkmojggzyogh/sql/new');
    console.log('And paste the contents of each migration file.');
  } else if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('✓ Tables already exist! Auth should work now.');
  }
}

run();
