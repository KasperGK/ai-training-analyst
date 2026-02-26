import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getIntegration, PROVIDERS } from '@/lib/db/integrations'

export async function GET() {
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json({ connected: false })
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ connected: false })
  }

  const integration = await getIntegration(user.id, PROVIDERS.WITHINGS)
  return NextResponse.json({ connected: !!integration })
}
