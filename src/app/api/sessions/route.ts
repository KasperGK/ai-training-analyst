import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessions } from '@/lib/db/sessions'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 503 }
    )
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start') || undefined
  const endDate = searchParams.get('end') || undefined
  const limit = parseInt(searchParams.get('limit') || '200', 10)

  const sessions = await getSessions(user.id, {
    startDate,
    endDate,
    limit,
  })

  return NextResponse.json(sessions)
}
