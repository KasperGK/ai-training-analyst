// Quick sync script to update session timestamps from intervals.icu

const INTERVALS_API_KEY = '5nqnge9nn3zqgwcqwfxxz20kh';
const INTERVALS_ATHLETE_ID = 'i478274';
const SUPABASE_URL = 'https://wihgzpxydkmojggzyogh.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpaGd6cHh5ZGttb2pnZ3p5b2doIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzkzOTc5NCwiZXhwIjoyMDgzNTE1Nzk0fQ.Mi9zPMJLhWB4DooYpEMo1BleROUfmIIJhELxutSuntc';

async function sync() {
  // Fetch recent activities from intervals.icu (last 6 weeks)
  const oldest = new Date(Date.now() - 42 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const newest = new Date().toISOString().split('T')[0];

  const url = `https://intervals.icu/api/v1/athlete/${INTERVALS_ATHLETE_ID}/activities?oldest=${oldest}&newest=${newest}`;

  console.log('Fetching activities from intervals.icu...');
  const res = await fetch(url, {
    headers: {
      'Authorization': 'Basic ' + Buffer.from('API_KEY:' + INTERVALS_API_KEY).toString('base64')
    }
  });

  if (!res.ok) {
    console.error('Intervals API error:', res.status, await res.text());
    return;
  }

  const activities = await res.json();
  console.log(`Fetched ${activities.length} activities`);

  // Get athlete_id from supabase (first athlete)
  const athleteRes = await fetch(`${SUPABASE_URL}/rest/v1/athletes?select=id&limit=1`, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`
    }
  });

  const athletes = await athleteRes.json();
  if (!athletes.length) {
    console.error('No athlete found');
    return;
  }

  const athleteId = athletes[0].id;
  console.log('Athlete ID:', athleteId);

  // Build a map of date -> timestamp from intervals.icu activities
  const dateToTimestamp = {};
  for (const a of activities) {
    if (!a.start_date_local) continue;
    const datePart = a.start_date_local.split('T')[0];
    // Store the full timestamp, prefer the one with actual time if multiple on same day
    if (!dateToTimestamp[datePart] || a.start_date_local.includes('T')) {
      dateToTimestamp[datePart] = a.start_date_local;
    }
  }

  console.log('Date mappings:', Object.keys(dateToTimestamp).length);

  // Update sessions with full timestamps
  let updated = 0;
  for (const [datePart, timestamp] of Object.entries(dateToTimestamp)) {
    // Update sessions matching this date with the full timestamp
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/sessions?date=gte.${datePart}T00:00:00&date=lt.${datePart}T23:59:59`, {
      method: 'PATCH',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ date: timestamp })
    });

    const result = await updateRes.json();
    if (updateRes.ok && Array.isArray(result) && result.length > 0) {
      updated += result.length;
      console.log(`Updated ${datePart} -> ${timestamp} (${result.length} sessions)`);
    } else if (!updateRes.ok) {
      console.error(`Failed ${datePart}:`, result);
    }
  }

  console.log(`Updated ${updated} sessions with timestamps`);
  console.log('Refresh your browser to see the times!');
}

sync().catch(console.error);
