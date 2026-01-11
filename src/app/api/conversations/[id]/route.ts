/**
 * Conversation Detail API
 *
 * GET /api/conversations/[id] - Get messages for a conversation
 * DELETE /api/conversations/[id] - Delete a conversation
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getConversationMessages,
  deleteConversation,
} from '@/lib/chat/conversation-manager'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/conversations/[id] - Get conversation messages
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params

  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 500 }
    )
  }

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    )
  }

  const messages = await getConversationMessages(id, user.id)

  return NextResponse.json({
    conversationId: id,
    messages,
  })
}

/**
 * DELETE /api/conversations/[id] - Delete conversation
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params

  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 500 }
    )
  }

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    )
  }

  const success = await deleteConversation(id, user.id)

  if (!success) {
    return NextResponse.json(
      { error: 'Failed to delete conversation' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
