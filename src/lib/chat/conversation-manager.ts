/**
 * Conversation Manager
 *
 * Handles persistence of chat conversations to Supabase.
 * - Save/load messages by conversation ID
 * - List conversations for a user
 * - Create/delete conversations
 */

import { createClient } from '@/lib/supabase/server'

export interface ChatMessage {
  id: string
  conversation_id: string
  athlete_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  tool_calls?: unknown
  created_at: string
}

export interface Conversation {
  id: string
  athlete_id: string
  title: string
  last_message_at: string
  message_count: number
  preview?: string
}

/**
 * List all conversations for an athlete
 */
export async function listConversations(athleteId: string): Promise<Conversation[]> {
  const supabase = await createClient()
  if (!supabase) return []

  // Get distinct conversation IDs with metadata
  const { data, error } = await supabase
    .from('chat_messages')
    .select('conversation_id, content, role, created_at')
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false })

  if (error || !data) {
    console.error('Error listing conversations:', error)
    return []
  }

  // Group by conversation_id and build metadata
  const conversationMap = new Map<string, {
    messages: typeof data
    lastMessageAt: string
    firstUserMessage: string | null
  }>()

  for (const msg of data) {
    const existing = conversationMap.get(msg.conversation_id)
    if (!existing) {
      conversationMap.set(msg.conversation_id, {
        messages: [msg],
        lastMessageAt: msg.created_at,
        firstUserMessage: msg.role === 'user' ? msg.content : null,
      })
    } else {
      existing.messages.push(msg)
      if (!existing.firstUserMessage && msg.role === 'user') {
        existing.firstUserMessage = msg.content
      }
    }
  }

  // Convert to Conversation objects
  const conversations: Conversation[] = []
  for (const [id, data] of conversationMap) {
    // Generate title from first user message
    const title = data.firstUserMessage
      ? data.firstUserMessage.slice(0, 50) + (data.firstUserMessage.length > 50 ? '...' : '')
      : 'New conversation'

    // Get preview from most recent message
    const lastMsg = data.messages[0]
    const preview = lastMsg?.content?.slice(0, 100)

    conversations.push({
      id,
      athlete_id: athleteId,
      title,
      last_message_at: data.lastMessageAt,
      message_count: data.messages.length,
      preview,
    })
  }

  // Sort by last message date (newest first)
  return conversations.sort((a, b) =>
    new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  )
}

/**
 * Get all messages for a conversation
 */
export async function getConversationMessages(
  conversationId: string,
  athleteId: string
): Promise<ChatMessage[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error getting conversation:', error)
    return []
  }

  return data as ChatMessage[]
}

/**
 * Save a message to a conversation
 */
export async function saveMessage(
  conversationId: string,
  athleteId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  toolCalls?: unknown
): Promise<ChatMessage | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      athlete_id: athleteId,
      role,
      content,
      tool_calls: toolCalls || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error saving message:', error)
    return null
  }

  return data as ChatMessage
}

/**
 * Save multiple messages at once (batch)
 */
export async function saveMessages(
  messages: Array<{
    conversationId: string
    athleteId: string
    role: 'user' | 'assistant' | 'system'
    content: string
    toolCalls?: unknown
  }>
): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('chat_messages')
    .insert(
      messages.map((m) => ({
        conversation_id: m.conversationId,
        athlete_id: m.athleteId,
        role: m.role,
        content: m.content,
        tool_calls: m.toolCalls || null,
      }))
    )

  if (error) {
    console.error('Error saving messages:', error)
    return false
  }

  return true
}

/**
 * Delete a conversation and all its messages
 */
export async function deleteConversation(
  conversationId: string,
  athleteId: string
): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('athlete_id', athleteId)

  if (error) {
    console.error('Error deleting conversation:', error)
    return false
  }

  return true
}

/**
 * Generate a new conversation ID
 */
export function generateConversationId(): string {
  return crypto.randomUUID()
}
