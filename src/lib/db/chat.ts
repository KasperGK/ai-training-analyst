import { createClient } from '@/lib/supabase/server'

export interface ChatMessage {
  id: string
  athlete_id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  tool_calls: Record<string, unknown>[] | null
  created_at: string
}

export type ChatMessageRow = {
  id: string
  athlete_id: string
  conversation_id: string
  role: string
  content: string
  tool_calls: Record<string, unknown>[] | null
  created_at: string
}

export type ChatMessageInsert = Omit<ChatMessageRow, 'id' | 'created_at'>

function rowToMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    athlete_id: row.athlete_id,
    conversation_id: row.conversation_id,
    role: row.role as ChatMessage['role'],
    content: row.content,
    tool_calls: row.tool_calls,
    created_at: row.created_at,
  }
}

export async function getChatHistory(
  athleteId: string,
  conversationId: string,
  limit: number = 50
): Promise<ChatMessage[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error || !data) return []
  return data.map((row) => rowToMessage(row as ChatMessageRow))
}

export async function saveChatMessage(
  message: ChatMessageInsert
): Promise<ChatMessage | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('chat_messages')
    .insert(message)
    .select()
    .single()

  if (error || !data) return null
  return rowToMessage(data as ChatMessageRow)
}

export async function saveChatMessages(
  messages: ChatMessageInsert[]
): Promise<ChatMessage[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('chat_messages')
    .insert(messages)
    .select()

  if (error || !data) return []
  return data.map((row) => rowToMessage(row as ChatMessageRow))
}

export async function getRecentConversations(
  athleteId: string,
  limit: number = 10
): Promise<Array<{ conversation_id: string; last_message: string; created_at: string }>> {
  const supabase = await createClient()
  if (!supabase) return []

  // Get the most recent message from each conversation
  const { data, error } = await supabase
    .from('chat_messages')
    .select('conversation_id, content, created_at')
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false })

  if (error || !data) return []

  // Group by conversation and get the latest
  const conversationMap = new Map<
    string,
    { conversation_id: string; last_message: string; created_at: string }
  >()

  for (const msg of data) {
    if (!conversationMap.has(msg.conversation_id)) {
      conversationMap.set(msg.conversation_id, {
        conversation_id: msg.conversation_id,
        last_message: msg.content.substring(0, 100),
        created_at: msg.created_at,
      })
    }
  }

  return Array.from(conversationMap.values()).slice(0, limit)
}

export async function deleteConversation(
  athleteId: string,
  conversationId: string
): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('athlete_id', athleteId)
    .eq('conversation_id', conversationId)

  return !error
}

export async function clearChatHistory(athleteId: string): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('athlete_id', athleteId)

  return !error
}

// Generate a new conversation ID
export function generateConversationId(): string {
  return crypto.randomUUID()
}
