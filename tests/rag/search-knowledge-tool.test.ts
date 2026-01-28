/**
 * Search Knowledge Tool Integration Tests
 *
 * Tests the AI-facing searchKnowledge tool, which is what the AI actually calls.
 * This is distinct from testing searchWiki() directly - we verify:
 * - Governance metadata is properly formatted for AI consumption
 * - AI guidance tips are included
 * - Session search integration works
 * - Error handling doesn't crash the tool
 *
 * Note: Due to vitest module caching behavior, tests are organized into
 * isolated describe blocks with their own setup to ensure reliability.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockWikiChunks, mockSessionEmbeddings } from './__fixtures__/mock-chunks'
import type { ToolContext } from '@/app/api/chat/tools/types'

// Mock tool context for tests
const createMockContext = (overrides: Partial<ToolContext> = {}): ToolContext => ({
  athleteId: 'test-athlete',
  athleteContext: undefined,
  intervalsConnected: false,
  intervalsClient: {} as ToolContext['intervalsClient'],
  flags: {
    useLocalData: true,
    enableRag: true,
    enableMemory: false,
    enableInsights: false,
  },
  ...overrides,
})

// Setup common mocks that all tests need
const setupMocks = (rpcMock: ReturnType<typeof vi.fn>) => {
  vi.doMock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() =>
      Promise.resolve({
        rpc: rpcMock,
      })
    ),
    isSupabaseConfigured: true,
  }))

  vi.doMock('@/lib/rag/embeddings', () => ({
    generateEmbedding: vi.fn(() => Promise.resolve(new Array(384).fill(0.1))),
    EMBEDDING_DIMENSIONS: 384,
  }))

  vi.doMock('@/lib/wiki/articles', () => ({
    getArticleBySlug: vi.fn((slug: string) => {
      const articles: Record<string, object> = {
        'what-is-ftp': {
          confidenceLevel: 'established',
          consensusNote: undefined,
          sources: ['source1', 'source2', 'source3'],
          lastVerified: '2024-01-15',
        },
        'polarized-training': {
          confidenceLevel: 'strong_evidence',
          consensusNote: 'Highly effective for elite athletes.',
          sources: ['source1', 'source2'],
          lastVerified: '2024-01-08',
        },
      }
      return articles[slug] || {
        confidenceLevel: 'established',
        sources: ['source1'],
        lastVerified: '2024-01-01',
      }
    }),
  }))
}

// Helper to import and create the tool after mocks are set up
async function createSearchKnowledgeTool(ctx: ToolContext) {
  const { searchKnowledge } = await import('@/app/api/chat/tools/search-knowledge')
  // searchKnowledge is a ToolFactory - call it with context to get the actual tool
  return searchKnowledge(ctx)
}

describe('searchKnowledge Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  describe('Core Functionality', () => {
    it('returns governance metadata, tips, and relevance scores', async () => {
      const mockRpc = vi.fn(() =>
        Promise.resolve({
          data: [
            { ...mockWikiChunks[0], similarity: 0.85 },
            { ...mockWikiChunks[1], similarity: 0.78 },
          ],
          error: null,
        })
      )
      setupMocks(mockRpc)

      const tool = await createSearchKnowledgeTool(createMockContext())

      const result = await tool.execute({ query: 'what is FTP', sources: ['wiki'] })

      // Verify it returns results (not error message)
      expect('results' in result).toBe(true)

      if ('results' in result) {
        // Check wiki results exist
        expect(result.results.wiki).toBeDefined()
        expect(result.results.wiki!.length).toBeGreaterThan(0)

        const firstResult = result.results.wiki![0]

        // Governance metadata
        expect(firstResult).toHaveProperty('confidence')
        expect(['established', 'strong_evidence', 'emerging', 'debated', undefined]).toContain(
          firstResult.confidence
        )
        expect(firstResult).toHaveProperty('sourceCount')
        expect(typeof firstResult.sourceCount).toBe('number')

        // Relevance as percentage (0-100)
        expect(firstResult.relevance).toBeGreaterThanOrEqual(0)
        expect(firstResult.relevance).toBeLessThanOrEqual(100)

        // Total results count
        expect(result.totalResults).toBeGreaterThan(0)

        // AI guidance tip
        expect(result.tip).toBeDefined()
        expect(result.tip).toContain('established')
        expect(result.tip).toContain('debated')
      }
    })
  })

  describe('Session Search', () => {
    it('searches sessions when requested and returns summaries', async () => {
      const mockRpc = vi.fn((name: string) => {
        if (name === 'search_wiki') {
          return Promise.resolve({ data: [mockWikiChunks[0]], error: null })
        }
        if (name === 'search_sessions') {
          return Promise.resolve({
            data: mockSessionEmbeddings.slice(0, 2),
            error: null,
          })
        }
        return Promise.resolve({ data: [], error: null })
      })
      setupMocks(mockRpc)

      const tool = await createSearchKnowledgeTool(
        createMockContext({ athleteId: 'test-athlete-123' })
      )

      const result = await tool.execute({
        query: 'threshold workout',
        sources: ['wiki', 'sessions'],
      })

      // Verify session search was called
      const sessionCalls = mockRpc.mock.calls.filter(
        (call) => call[0] === 'search_sessions'
      )
      expect(sessionCalls.length).toBe(1)

      // Verify sessions in results
      expect('results' in result).toBe(true)
      if ('results' in result && result.results.sessions) {
        expect(result.results.sessions.length).toBeGreaterThan(0)
        expect(result.results.sessions[0]).toHaveProperty('summary')
        expect(result.results.sessions[0]).toHaveProperty('relevance')
      }
    })

    it('skips session search without athleteId', async () => {
      const mockRpc = vi.fn((name: string) => {
        if (name === 'search_wiki') {
          return Promise.resolve({ data: [mockWikiChunks[0]], error: null })
        }
        return Promise.resolve({ data: [], error: null })
      })
      setupMocks(mockRpc)

      const tool = await createSearchKnowledgeTool(
        createMockContext({ athleteId: undefined })
      )

      await tool.execute({
        query: 'threshold workout',
        sources: ['wiki', 'sessions'],
      })

      // Session search should NOT be called (no athleteId)
      const sessionCalls = mockRpc.mock.calls.filter(
        (call) => call[0] === 'search_sessions'
      )
      expect(sessionCalls.length).toBe(0)
    })
  })

  describe('Default Behavior', () => {
    it('defaults to wiki-only when sources not specified', async () => {
      const mockRpc = vi.fn((name: string) => {
        if (name === 'search_wiki') {
          return Promise.resolve({ data: [mockWikiChunks[0]], error: null })
        }
        return Promise.resolve({ data: [], error: null })
      })
      setupMocks(mockRpc)

      const tool = await createSearchKnowledgeTool(createMockContext())

      await tool.execute({ query: 'FTP training' }) // No sources specified

      // Wiki search should be called
      const wikiCalls = mockRpc.mock.calls.filter((call) => call[0] === 'search_wiki')
      expect(wikiCalls.length).toBe(1)

      // Session search should NOT be called
      const sessionCalls = mockRpc.mock.calls.filter(
        (call) => call[0] === 'search_sessions'
      )
      expect(sessionCalls.length).toBe(0)
    })
  })

  describe('Error and Empty Results', () => {
    it('returns helpful message when no matches found', async () => {
      vi.resetModules()

      const mockRpc = vi.fn(() => Promise.resolve({ data: [], error: null }))
      setupMocks(mockRpc)

      const tool = await createSearchKnowledgeTool(createMockContext())

      const result = await tool.execute({
        query: 'xyzabc123nonsense',
        sources: ['wiki'],
      })

      expect('message' in result).toBe(true)
      if ('message' in result) {
        expect(result.message).toContain('No relevant information found')
        expect(result.message).toContain('Try rephrasing')
      }
    })

    it('handles database errors gracefully', async () => {
      vi.resetModules()

      const mockRpc = vi.fn(() =>
        Promise.resolve({
          data: null,
          error: { message: 'Connection failed', code: 'ERROR' },
        })
      )
      setupMocks(mockRpc)

      const tool = await createSearchKnowledgeTool(createMockContext())

      const result = await tool.execute({
        query: 'FTP training',
        sources: ['wiki'],
      })

      // Should return no results message (graceful degradation), not crash
      expect('message' in result).toBe(true)
    })
  })
})
