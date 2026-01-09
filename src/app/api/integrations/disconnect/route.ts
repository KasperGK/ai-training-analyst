import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { deleteIntegration, PROVIDERS } from '@/lib/db/integrations'

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()

  // Get provider from request body
  let provider: string
  try {
    const body = await request.json()
    provider = body.provider
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }

  if (!provider || !Object.values(PROVIDERS).includes(provider as typeof PROVIDERS[keyof typeof PROVIDERS])) {
    return NextResponse.json(
      { error: 'Invalid provider' },
      { status: 400 }
    )
  }

  // If user is authenticated, delete from database
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await deleteIntegration(user.id, provider)
    }
  }

  // Also clear cookies (for non-authenticated sessions)
  const cookieStore = await cookies()

  if (provider === PROVIDERS.INTERVALS_ICU) {
    cookieStore.delete('intervals_access_token')
    cookieStore.delete('intervals_athlete_id')
    cookieStore.delete('intervals_refresh_token')
  }

  return NextResponse.json({ success: true })
}
