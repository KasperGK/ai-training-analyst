import { z } from 'zod'
import { defineTool } from './types'
import { getInsights } from '@/lib/insights/insight-generator'

const inputSchema = z.object({
  includeRead: z.boolean().optional().describe('Include already-read insights (default: false)'),
  limit: z.number().optional().describe('Maximum insights to return (default: 10)'),
})

type Input = z.infer<typeof inputSchema>

interface Insight {
  id: string
  type: string
  priority: string
  title: string
  content: string
  createdAt: string
}

interface SuccessResponse {
  totalCount: number
  byPriority: {
    urgent: number
    high: number
    medium: number
    low: number
  }
  insights: Insight[]
  tip: string
}

interface EmptyResponse {
  message: string
  insights: never[]
}

interface ErrorResponse {
  error: string
}

type Output = SuccessResponse | EmptyResponse | ErrorResponse

export const getActiveInsights = defineTool<Input, Output>({
  description: 'Get active insights and alerts detected from training data. Call this at the START of conversations to check for important patterns that need attention. Lead with urgent/high priority insights.',
  inputSchema,
  execute: async ({ includeRead = false, limit = 10 }, ctx) => {
    if (!ctx.athleteId) {
      return { error: 'No athlete ID available' }
    }

    try {
      const insights = await getInsights(ctx.athleteId, {
        limit,
        includeRead,
      })

      if (insights.length === 0) {
        return {
          message: 'No active insights. Training appears to be progressing normally.',
          insights: [],
        }
      }

      // Group by priority
      const urgent = insights.filter(i => i.priority === 'urgent')
      const high = insights.filter(i => i.priority === 'high')
      const medium = insights.filter(i => i.priority === 'medium')
      const low = insights.filter(i => i.priority === 'low')

      return {
        totalCount: insights.length,
        byPriority: {
          urgent: urgent.length,
          high: high.length,
          medium: medium.length,
          low: low.length,
        },
        insights: insights.map(i => ({
          id: i.id,
          type: i.insight_type,
          priority: i.priority,
          title: i.title,
          content: i.content,
          createdAt: i.created_at,
        })),
        tip: urgent.length > 0 || high.length > 0
          ? 'IMPORTANT: Lead your response with the urgent/high priority insights. These need immediate attention.'
          : 'Mention relevant insights naturally in your response.',
      }
    } catch (error) {
      console.error('[getActiveInsights] Error:', error)
      return { error: 'Failed to retrieve insights' }
    }
  },
})
