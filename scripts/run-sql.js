require('dotenv').config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.log('Missing env vars');
  process.exit(1);
}

const sql = `
ALTER TABLE public.fitness_history ADD COLUMN IF NOT EXISTS ramp_rate DECIMAL(5,2);
CREATE INDEX IF NOT EXISTS idx_fitness_history_ramp_rate ON public.fitness_history(athlete_id, date DESC) WHERE ramp_rate IS NOT NULL;
`;

async function runSQL() {
  // Use the Supabase SQL API endpoint
  const response = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!response.ok) {
    // Try the /sql endpoint for direct SQL execution
    console.log('RPC not available, trying direct pg endpoint...');
    
    // Extract project ref from URL
    const projectRef = url.split('//')[1].split('.')[0];
    
    // Try using the postgres protocol via pg library
    const { Pool } = require('pg');
    
    // Construct connection string from Supabase URL
    const connectionString = `postgres://postgres.${projectRef}:${key}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`;
    
    const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
    
    try {
      const client = await pool.connect();
      console.log('Connected to database');
      
      // Run the ALTER TABLE
      await client.query('ALTER TABLE public.fitness_history ADD COLUMN IF NOT EXISTS ramp_rate DECIMAL(5,2)');
      console.log('✓ Added ramp_rate column');
      
      // Run the CREATE INDEX
      await client.query('CREATE INDEX IF NOT EXISTS idx_fitness_history_ramp_rate ON public.fitness_history(athlete_id, date DESC) WHERE ramp_rate IS NOT NULL');
      console.log('✓ Created index');
      
      client.release();
      await pool.end();
      console.log('\n✓ Migration completed successfully!');
    } catch (err) {
      console.error('Database error:', err.message);
      process.exit(1);
    }
  } else {
    const result = await response.json();
    console.log('Result:', result);
  }
}

runSQL();
