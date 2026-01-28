/**
 * RAG Error Handling Tests
 *
 * Tests failure modes and graceful degradation in the RAG system.
 * These tests verify the system handles edge cases correctly.
 *
 * Note: Some error scenarios are difficult to test with mocks because the
 * actual implementations catch errors internally. These tests focus on
 * behaviors that can be reliably verified.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('RAG Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe('Supabase Not Configured', () => {
    it('searchWiki returns empty when Supabase is null', async () => {
      // Mock Supabase to return null (not configured)
      vi.doMock('@/lib/supabase/server', () => ({
        createClient: vi.fn(() => Promise.resolve(null)),
        isSupabaseConfigured: false,
      }))

      // Mock embeddings to avoid loading the model
      vi.doMock('@/lib/rag/embeddings', () => ({
        generateEmbedding: vi.fn(() => Promise.resolve(new Array(384).fill(0.1))),
        EMBEDDING_DIMENSIONS: 384,
      }))

      vi.doMock('@/lib/wiki/articles', () => ({
        getArticleBySlug: vi.fn(() => null),
      }))

      const { searchWiki } = await import('@/lib/rag/vector-store')

      const results = await searchWiki('test query')

      expect(results).toEqual([])
    })

    it('searchSessions returns empty when Supabase is null', async () => {
      vi.doMock('@/lib/supabase/server', () => ({
        createClient: vi.fn(() => Promise.resolve(null)),
        isSupabaseConfigured: false,
      }))

      vi.doMock('@/lib/rag/embeddings', () => ({
        generateEmbedding: vi.fn(() => Promise.resolve(new Array(384).fill(0.1))),
        EMBEDDING_DIMENSIONS: 384,
      }))

      const { searchSessions } = await import('@/lib/rag/vector-store')

      const results = await searchSessions('test query', 'athlete-123')

      expect(results).toEqual([])
    })

    it('storeWikiChunks returns false when Supabase is null', async () => {
      vi.doMock('@/lib/supabase/server', () => ({
        createClient: vi.fn(() => Promise.resolve(null)),
        isSupabaseConfigured: false,
      }))

      const { storeWikiChunks } = await import('@/lib/rag/vector-store')

      const result = await storeWikiChunks([
        {
          articleSlug: 'test',
          chunkIndex: 0,
          title: 'Test',
          content: 'Content',
          embedding: [],
        },
      ])

      expect(result).toBe(false)
    })

    it('storeSessionEmbedding returns false when Supabase is null', async () => {
      vi.doMock('@/lib/supabase/server', () => ({
        createClient: vi.fn(() => Promise.resolve(null)),
        isSupabaseConfigured: false,
      }))

      const { storeSessionEmbedding } = await import('@/lib/rag/vector-store')

      const result = await storeSessionEmbedding(
        'session-001',
        'athlete-123',
        'Summary',
        []
      )

      expect(result).toBe(false)
    })

    it('clearWikiChunks returns false when Supabase is null', async () => {
      vi.doMock('@/lib/supabase/server', () => ({
        createClient: vi.fn(() => Promise.resolve(null)),
        isSupabaseConfigured: false,
      }))

      const { clearWikiChunks } = await import('@/lib/rag/vector-store')

      const result = await clearWikiChunks()

      expect(result).toBe(false)
    })

    it('getWikiChunkCount returns 0 when Supabase is null', async () => {
      vi.doMock('@/lib/supabase/server', () => ({
        createClient: vi.fn(() => Promise.resolve(null)),
        isSupabaseConfigured: false,
      }))

      const { getWikiChunkCount } = await import('@/lib/rag/vector-store')

      const count = await getWikiChunkCount()

      expect(count).toBe(0)
    })
  })

  describe('Database Error Handling', () => {
    it('searchWiki returns empty array on RPC error', async () => {
      vi.doMock('@/lib/supabase/server', () => ({
        createClient: vi.fn(() =>
          Promise.resolve({
            rpc: vi.fn(() =>
              Promise.resolve({
                data: null,
                error: { message: 'Database error', code: 'DB_ERROR' },
              })
            ),
          })
        ),
        isSupabaseConfigured: true,
      }))

      vi.doMock('@/lib/rag/embeddings', () => ({
        generateEmbedding: vi.fn(() => Promise.resolve(new Array(384).fill(0.1))),
        EMBEDDING_DIMENSIONS: 384,
      }))

      vi.doMock('@/lib/wiki/articles', () => ({
        getArticleBySlug: vi.fn(() => null),
      }))

      const { searchWiki } = await import('@/lib/rag/vector-store')

      const results = await searchWiki('test query')

      // Implementation logs error and returns empty array
      expect(results).toEqual([])
    })

    it('searchSessions returns empty array on RPC error', async () => {
      vi.doMock('@/lib/supabase/server', () => ({
        createClient: vi.fn(() =>
          Promise.resolve({
            rpc: vi.fn(() =>
              Promise.resolve({
                data: null,
                error: { message: 'RPC error', code: 'PGRST202' },
              })
            ),
          })
        ),
        isSupabaseConfigured: true,
      }))

      vi.doMock('@/lib/rag/embeddings', () => ({
        generateEmbedding: vi.fn(() => Promise.resolve(new Array(384).fill(0.1))),
        EMBEDDING_DIMENSIONS: 384,
      }))

      const { searchSessions } = await import('@/lib/rag/vector-store')

      const results = await searchSessions('test query', 'athlete-123')

      expect(results).toEqual([])
    })

    it('storeWikiChunks returns false on upsert error', async () => {
      vi.doMock('@/lib/supabase/server', () => ({
        createClient: vi.fn(() =>
          Promise.resolve({
            from: vi.fn(() => ({
              upsert: vi.fn(() =>
                Promise.resolve({
                  data: null,
                  error: { message: 'Constraint violation' },
                })
              ),
            })),
          })
        ),
        isSupabaseConfigured: true,
      }))

      const { storeWikiChunks } = await import('@/lib/rag/vector-store')

      const result = await storeWikiChunks([
        {
          articleSlug: 'test',
          chunkIndex: 0,
          title: 'Test',
          content: 'Content',
          embedding: [0.1, 0.2, 0.3],
        },
      ])

      expect(result).toBe(false)
    })

    it('storeSessionEmbedding returns false on upsert error', async () => {
      vi.doMock('@/lib/supabase/server', () => ({
        createClient: vi.fn(() =>
          Promise.resolve({
            from: vi.fn(() => ({
              upsert: vi.fn(() =>
                Promise.resolve({
                  data: null,
                  error: { message: 'Insert failed' },
                })
              ),
            })),
          })
        ),
        isSupabaseConfigured: true,
      }))

      const { storeSessionEmbedding } = await import('@/lib/rag/vector-store')

      const result = await storeSessionEmbedding(
        'session-001',
        'athlete-123',
        'Summary',
        [0.1, 0.2, 0.3]
      )

      expect(result).toBe(false)
    })

    it('clearWikiChunks returns false on delete error', async () => {
      vi.doMock('@/lib/supabase/server', () => ({
        createClient: vi.fn(() =>
          Promise.resolve({
            from: vi.fn(() => ({
              delete: vi.fn(() => ({
                neq: vi.fn(() =>
                  Promise.resolve({
                    data: null,
                    error: { message: 'Permission denied' },
                  })
                ),
              })),
            })),
          })
        ),
        isSupabaseConfigured: true,
      }))

      const { clearWikiChunks } = await import('@/lib/rag/vector-store')

      const result = await clearWikiChunks()

      expect(result).toBe(false)
    })

    it('getWikiChunkCount returns 0 on query error', async () => {
      vi.doMock('@/lib/supabase/server', () => ({
        createClient: vi.fn(() =>
          Promise.resolve({
            from: vi.fn(() => ({
              select: vi.fn(() =>
                Promise.resolve({
                  count: null,
                  error: { message: 'Query failed' },
                })
              ),
            })),
          })
        ),
        isSupabaseConfigured: true,
      }))

      const { getWikiChunkCount } = await import('@/lib/rag/vector-store')

      const count = await getWikiChunkCount()

      expect(count).toBe(0)
    })
  })

  describe('Malformed Data Handling', () => {
    it('searchWiki handles empty data response', async () => {
      vi.doMock('@/lib/supabase/server', () => ({
        createClient: vi.fn(() =>
          Promise.resolve({
            rpc: vi.fn(() =>
              Promise.resolve({
                data: [],
                error: null,
              })
            ),
          })
        ),
        isSupabaseConfigured: true,
      }))

      vi.doMock('@/lib/rag/embeddings', () => ({
        generateEmbedding: vi.fn(() => Promise.resolve(new Array(384).fill(0.1))),
        EMBEDDING_DIMENSIONS: 384,
      }))

      vi.doMock('@/lib/wiki/articles', () => ({
        getArticleBySlug: vi.fn(() => null),
      }))

      const { searchWiki } = await import('@/lib/rag/vector-store')

      const results = await searchWiki('test query')

      expect(results).toEqual([])
    })

    it('searchWiki returns chunks with null similarity', async () => {
      vi.doMock('@/lib/supabase/server', () => ({
        createClient: vi.fn(() =>
          Promise.resolve({
            rpc: vi.fn(() =>
              Promise.resolve({
                data: [
                  {
                    id: 'chunk-1',
                    article_slug: 'test-article',
                    title: 'Test',
                    content: 'Content',
                    similarity: null,
                  },
                ],
                error: null,
              })
            ),
          })
        ),
        isSupabaseConfigured: true,
      }))

      vi.doMock('@/lib/rag/embeddings', () => ({
        generateEmbedding: vi.fn(() => Promise.resolve(new Array(384).fill(0.1))),
        EMBEDDING_DIMENSIONS: 384,
      }))

      vi.doMock('@/lib/wiki/articles', () => ({
        getArticleBySlug: vi.fn(() => ({
          confidenceLevel: 'established',
          sources: ['source1'],
          lastVerified: '2024-01-01',
        })),
      }))

      const { searchWiki } = await import('@/lib/rag/vector-store')

      const results = await searchWiki('test query')

      expect(results.length).toBe(1)
      expect(results[0].similarity).toBeNull()
    })

    it('searchWiki returns chunks without governance when article not found', async () => {
      vi.doMock('@/lib/supabase/server', () => ({
        createClient: vi.fn(() =>
          Promise.resolve({
            rpc: vi.fn(() =>
              Promise.resolve({
                data: [
                  {
                    id: 'chunk-1',
                    article_slug: 'unknown-article',
                    title: 'Unknown',
                    content: 'Content',
                    similarity: 0.8,
                  },
                ],
                error: null,
              })
            ),
          })
        ),
        isSupabaseConfigured: true,
      }))

      vi.doMock('@/lib/rag/embeddings', () => ({
        generateEmbedding: vi.fn(() => Promise.resolve(new Array(384).fill(0.1))),
        EMBEDDING_DIMENSIONS: 384,
      }))

      vi.doMock('@/lib/wiki/articles', () => ({
        getArticleBySlug: vi.fn(() => null),
      }))

      const { searchWiki } = await import('@/lib/rag/vector-store')

      const results = await searchWiki('test query')

      expect(results.length).toBe(1)
      expect(results[0].confidenceLevel).toBeUndefined()
      expect(results[0].sourceCount).toBeUndefined()
    })
  })

  describe('Edge Cases', () => {
    it('handles empty query string', async () => {
      vi.doMock('@/lib/supabase/server', () => ({
        createClient: vi.fn(() =>
          Promise.resolve({
            rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })
        ),
        isSupabaseConfigured: true,
      }))

      vi.doMock('@/lib/rag/embeddings', () => ({
        generateEmbedding: vi.fn(() => Promise.resolve(new Array(384).fill(0.1))),
        EMBEDDING_DIMENSIONS: 384,
      }))

      vi.doMock('@/lib/wiki/articles', () => ({
        getArticleBySlug: vi.fn(() => null),
      }))

      const { searchWiki } = await import('@/lib/rag/vector-store')

      const results = await searchWiki('')

      // Should handle gracefully
      expect(Array.isArray(results)).toBe(true)
    })

    it('handles very long query string', async () => {
      vi.doMock('@/lib/supabase/server', () => ({
        createClient: vi.fn(() =>
          Promise.resolve({
            rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })
        ),
        isSupabaseConfigured: true,
      }))

      vi.doMock('@/lib/rag/embeddings', () => ({
        generateEmbedding: vi.fn(() => Promise.resolve(new Array(384).fill(0.1))),
        EMBEDDING_DIMENSIONS: 384,
      }))

      vi.doMock('@/lib/wiki/articles', () => ({
        getArticleBySlug: vi.fn(() => null),
      }))

      const { searchWiki } = await import('@/lib/rag/vector-store')

      const longQuery = 'training '.repeat(1000)
      const results = await searchWiki(longQuery)

      expect(Array.isArray(results)).toBe(true)
    })

    it('handles special characters in query', async () => {
      vi.doMock('@/lib/supabase/server', () => ({
        createClient: vi.fn(() =>
          Promise.resolve({
            rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })
        ),
        isSupabaseConfigured: true,
      }))

      vi.doMock('@/lib/rag/embeddings', () => ({
        generateEmbedding: vi.fn(() => Promise.resolve(new Array(384).fill(0.1))),
        EMBEDDING_DIMENSIONS: 384,
      }))

      vi.doMock('@/lib/wiki/articles', () => ({
        getArticleBySlug: vi.fn(() => null),
      }))

      const { searchWiki } = await import('@/lib/rag/vector-store')

      const specialQuery = "FTP @ 300W; HR: 150bpm (zone 4) — test's query"
      const results = await searchWiki(specialQuery)

      expect(Array.isArray(results)).toBe(true)
    })

    it('storeSessionEmbedding accepts external Supabase client', async () => {
      // This tests that when an external client is provided, it's used
      const mockUpsert = vi.fn(() => Promise.resolve({ data: null, error: null }))
      const mockFrom = vi.fn(() => ({ upsert: mockUpsert }))
      const externalClient = { from: mockFrom } as unknown as Parameters<
        typeof import('@/lib/rag/vector-store').storeSessionEmbedding
      >[4]

      // Don't mock createClient - we're testing the external client path
      vi.doMock('@/lib/supabase/server', () => ({
        createClient: vi.fn(() => Promise.resolve(null)),
        isSupabaseConfigured: false,
      }))

      const { storeSessionEmbedding } = await import('@/lib/rag/vector-store')

      const result = await storeSessionEmbedding(
        'session-001',
        'athlete-123',
        'Summary',
        [0.1, 0.2, 0.3],
        externalClient
      )

      expect(result).toBe(true)
      expect(mockFrom).toHaveBeenCalledWith('session_embeddings')
    })
  })
})
