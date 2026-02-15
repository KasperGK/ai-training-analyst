import { z } from 'zod'
import { defineTool } from './types'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

const inputSchema = z.object({
  query: z.string().describe('Search query for past conversations'),
  limit: z.number().optional().default(10).describe('Maximum number of results to return'),
})

type Input = z.infer<typeof inputSchema>

interface ConversationMatch {
  conversationId: string
  conversationDate: string
  messageRole: 'user' | 'assistant'
  messageContent: string
  matchContext: string
}

interface Output {
  matches: ConversationMatch[]
  totalMatches: number
  searchedConversations: number
}

export const searchConversationHistory = defineTool<Input, Output>({
  description: `Search past messages across all conversations for this athlete.
Use this when:
- The athlete references something from a past discussion
- You need to recall what was discussed previously
- The athlete asks "what did we talk about" or "remember when we discussed"
Returns relevant messages with conversation date and context.`,
  inputSchema,
  execute: async (input, ctx) => {
    if (!ctx.athleteId) {
      return {
        matches: [],
        totalMatches: 0,
        searchedConversations: 0,
      }
    }

    const supabase = await createClient()
    if (!supabase) {
      return {
        matches: [],
        totalMatches: 0,
        searchedConversations: 0,
      }
    }

    const { query, limit } = input

    // Search for messages containing the query terms
    // Using ilike for case-insensitive search across content
    const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2)

    if (searchTerms.length === 0) {
      return {
        matches: [],
        totalMatches: 0,
        searchedConversations: 0,
      }
    }

    // Build search condition - all terms must match
    // Using textSearch would be ideal but ilike works for simple queries
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('conversation_id, role, content, created_at')
      .eq('athlete_id', ctx.athleteId)
      .order('created_at', { ascending: false })
      .limit(500) // Search through recent messages

    if (error || !messages) {
      logger.error('Error searching conversation history:', error)
      return {
        matches: [],
        totalMatches: 0,
        searchedConversations: 0,
      }
    }

    // Filter messages that match all search terms
    const matchingMessages = messages.filter(msg => {
      const contentLower = msg.content.toLowerCase()
      return searchTerms.every(term => contentLower.includes(term))
    })

    // Group by conversation and count unique conversations
    const conversationIds = new Set(messages.map(m => m.conversation_id))
    const matchingConversationIds = new Set(matchingMessages.map(m => m.conversation_id))

    // Format results with context
    const matches: ConversationMatch[] = matchingMessages
      .slice(0, limit)
      .map(msg => {
        // Extract context around the match (surrounding text)
        const contentLower = msg.content.toLowerCase()
        let matchContext = msg.content

        // Find the first matching term and extract surrounding context
        for (const term of searchTerms) {
          const idx = contentLower.indexOf(term)
          if (idx !== -1) {
            const start = Math.max(0, idx - 50)
            const end = Math.min(msg.content.length, idx + term.length + 100)
            matchContext = (start > 0 ? '...' : '') +
              msg.content.slice(start, end) +
              (end < msg.content.length ? '...' : '')
            break
          }
        }

        return {
          conversationId: msg.conversation_id,
          conversationDate: msg.created_at.split('T')[0],
          messageRole: msg.role as 'user' | 'assistant',
          messageContent: msg.content.length > 300
            ? msg.content.slice(0, 300) + '...'
            : msg.content,
          matchContext,
        }
      })

    return {
      matches,
      totalMatches: matchingMessages.length,
      searchedConversations: conversationIds.size,
    }
  },
})
