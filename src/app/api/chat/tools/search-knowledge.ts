import { z } from 'zod'
import { defineTool } from './types'
import { searchWiki, searchSessions } from '@/lib/rag/vector-store'

const inputSchema = z.object({
  query: z.string().describe('The search query - be specific about what information you need'),
  sources: z.array(z.enum(['wiki', 'sessions'])).optional().describe('Which sources to search. Defaults to wiki only. Include "sessions" to search athlete history.'),
})

type Input = z.infer<typeof inputSchema>

interface WikiResult {
  title: string
  content: string
  relevance: number
  // Governance metadata for transparency
  confidence?: 'established' | 'strong_evidence' | 'emerging' | 'debated'
  consensusNote?: string
  sourceCount?: number
}

interface SessionResult {
  summary: string
  relevance: number
}

interface SearchResults {
  wiki?: WikiResult[]
  sessions?: SessionResult[]
}

interface SuccessResponse {
  query: string
  results: SearchResults
  totalResults: number
  tip: string
}

interface NoResultsResponse {
  message: string
}

type Output = SuccessResponse | NoResultsResponse

export const searchKnowledge = defineTool<Input, Output>({
  description: 'Search the training science wiki and athlete session history for relevant information. Use when answering questions about training concepts, periodization, nutrition, recovery, or when looking for patterns in past training.',
  inputSchema,
  execute: async ({ query, sources = ['wiki'] }, ctx) => {
    const results: SearchResults = {}

    // Search wiki if requested
    if (sources.includes('wiki')) {
      try {
        const wikiResults = await searchWiki(query, { matchCount: 3, matchThreshold: 0.4 })
        results.wiki = wikiResults.map(r => ({
          title: r.title,
          content: r.content,
          relevance: Math.round((r.similarity || 0) * 100),
          // Include governance metadata for AI transparency
          confidence: r.confidenceLevel,
          consensusNote: r.consensusNote,
          sourceCount: r.sourceCount,
        }))
      } catch (error) {
        console.error('[searchKnowledge] Wiki search error:', error)
      }
    }

    // Search sessions if requested (requires athleteId)
    if (sources.includes('sessions') && ctx.athleteId) {
      try {
        const sessionResults = await searchSessions(query, ctx.athleteId, { matchCount: 3, matchThreshold: 0.4 })
        results.sessions = sessionResults.map(r => ({
          summary: r.summary,
          relevance: Math.round((r.similarity || 0) * 100),
        }))
      } catch (error) {
        console.error('[searchKnowledge] Session search error:', error)
      }
    }

    const totalResults = (results.wiki?.length || 0) + (results.sessions?.length || 0)

    if (totalResults === 0) {
      return { message: 'No relevant information found. Try rephrasing your query or being more specific.' }
    }

    return {
      query,
      results,
      totalResults,
      tip: 'Use this information to provide accurate, evidence-based advice. Reference confidence levels: "established" facts can be stated directly; "strong_evidence" use "Research shows..."; "emerging" use "Emerging evidence suggests..."; "debated" explain different positions.',
    }
  },
})
