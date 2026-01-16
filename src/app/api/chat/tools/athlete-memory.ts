import { z } from 'zod'
import { defineTool } from './types'
import { getMemories, upsertMemory, type MemoryType, type MemorySource } from '@/lib/personalization/athlete-memory'

// Get Athlete Memory
const getMemoryInputSchema = z.object({
  types: z.array(z.enum([
    'preference', 'pattern', 'injury', 'lifestyle', 'feedback', 'achievement', 'goal', 'context'
  ])).optional().describe('Filter by memory types. If not provided, returns all types.'),
  limit: z.number().optional().describe('Maximum number of memories to return. Default is 20.'),
})

type GetMemoryInput = z.infer<typeof getMemoryInputSchema>

interface Memory {
  type: string
  content: string
  confidence: number
  source: string
  createdAt: string
}

interface GetMemorySuccessResponse {
  memories: Memory[]
  count: number
  tip: string
}

interface GetMemoryEmptyResponse {
  message: string
  memories: never[]
}

interface ErrorResponse {
  error: string
}

type GetMemoryOutput = GetMemorySuccessResponse | GetMemoryEmptyResponse | ErrorResponse

export const getAthleteMemory = defineTool<GetMemoryInput, GetMemoryOutput>({
  description: 'Retrieve stored information about the athlete including preferences, patterns, injuries, goals, and past feedback. Use this to personalize advice and remember what works for this athlete.',
  inputSchema: getMemoryInputSchema,
  execute: async ({ types, limit }, ctx) => {
    if (!ctx.athleteId) {
      return { error: 'No athlete ID available' }
    }

    try {
      const memories = await getMemories(ctx.athleteId, {
        types: types as MemoryType[] | undefined,
        limit: limit || 20,
      })

      if (memories.length === 0) {
        return {
          message: 'No stored memories for this athlete yet. As you learn about them, use saveAthleteMemory to record important information.',
          memories: [],
        }
      }

      return {
        memories: memories.map(m => ({
          type: m.memory_type,
          content: m.content,
          confidence: m.confidence,
          source: m.source,
          createdAt: m.created_at,
        })),
        count: memories.length,
        tip: 'Use these memories to personalize your advice. Update or add memories as you learn more.',
      }
    } catch (error) {
      console.error('[getAthleteMemory] Error:', error)
      return { error: 'Failed to retrieve memories' }
    }
  },
})

// Save Athlete Memory
const saveMemoryInputSchema = z.object({
  memoryType: z.enum([
    'preference', 'pattern', 'injury', 'lifestyle', 'feedback', 'achievement', 'goal', 'context'
  ]).describe('Type of memory: preference (likes/dislikes), pattern (what works for them), injury (health issues), lifestyle (schedule/constraints), feedback (reactions to suggestions), achievement (milestones), goal (targets), context (equipment/setup)'),
  content: z.string().describe('The information to remember. Be specific and actionable.'),
  confidence: z.number().min(0).max(1).optional().describe('Confidence level 0-1. Use lower values for inferred information, higher for explicitly stated.'),
  source: z.enum(['user_stated', 'ai_inferred', 'data_derived']).optional().describe('How this was learned: user_stated (athlete told you), ai_inferred (you concluded), data_derived (from training data)'),
})

type SaveMemoryInput = z.infer<typeof saveMemoryInputSchema>

interface SaveMemorySuccessResponse {
  success: true
  memory: {
    id: string
    type: string
    content: string
    confidence: number
  }
  message: string
}

type SaveMemoryOutput = SaveMemorySuccessResponse | ErrorResponse

export const saveAthleteMemory = defineTool<SaveMemoryInput, SaveMemoryOutput>({
  description: 'Save important information about the athlete for future reference. Use when the athlete shares preferences, goals, injuries, patterns, or any information that should inform future advice.',
  inputSchema: saveMemoryInputSchema,
  execute: async ({ memoryType, content, confidence, source }, ctx) => {
    if (!ctx.athleteId) {
      return { error: 'No athlete ID available' }
    }

    try {
      const memory = await upsertMemory(ctx.athleteId, {
        memory_type: memoryType as MemoryType,
        content,
        confidence: confidence ?? (source === 'ai_inferred' ? 0.8 : 1.0),
        source: (source ?? 'user_stated') as MemorySource,
      })

      if (!memory) {
        return { error: 'Failed to save memory' }
      }

      return {
        success: true,
        memory: {
          id: memory.id,
          type: memory.memory_type,
          content: memory.content,
          confidence: memory.confidence,
        },
        message: `Saved ${memoryType} memory: "${content.slice(0, 50)}${content.length > 50 ? '...' : ''}"`,
      }
    } catch (error) {
      console.error('[saveAthleteMemory] Error:', error)
      return { error: 'Failed to save memory' }
    }
  },
})
