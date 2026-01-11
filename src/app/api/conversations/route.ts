/**
 * Conversations API
 *
 * GET /api/conversations - List all conversations for authenticated user
 * POST /api/conversations - Save messages to a conversation
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  listConversations,
  saveMessage,
  generateConversationId,
} from '@/lib/chat/conversation-manager'

/**
 * GET /api/conversations - List conversations
 */
export async function GET() {
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

  const conversations = await listConversations(user.id)

  return NextResponse.json({ conversations })
}

/**
 * POST /api/conversations - Save a message
 *
 * Body:
 * - conversationId: string (optional - will generate if not provided)
 * - role: 'user' | 'assistant'
 * - content: string
 * - toolCalls?: object
 */
export async function POST(request: Request) {
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

  try {
    const body = await request.json()
    const {
      conversationId = generateConversationId(),
      role,
      content,
      toolCalls,
    } = body

    if (!role || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: role, content' },
        { status: 400 }
      )
    }

    if (!['user', 'assistant', 'system'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be user, assistant, or system' },
        { status: 400 }
      )
    }

    const message = await saveMessage(
      conversationId,
      user.id,
      role,
      content,
      toolCalls
    )

    if (!message) {
      return NextResponse.json(
        { error: 'Failed to save message' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message,
      conversationId,
    })
  } catch (error) {
    console.error('Error saving message:', error)
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}
