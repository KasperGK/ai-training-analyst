/**
 * Global Test Setup
 *
 * Provides mock utilities for testing without a real database connection.
 * Import and call setupMockSupabase() in tests that need database mocking.
 */

import { vi, beforeEach, afterEach } from 'vitest'
import {
  filterMockWikiChunks,
  filterMockSessionEmbeddings,
  mockWikiChunks,
  mockSessionEmbeddings,
} from './rag/__fixtures__/mock-chunks'

/**
 * Mock Supabase client factory
 *
 * Returns a mock client that simulates Supabase responses using local mock data.
 * Supports both RPC calls (search_wiki, search_sessions) and basic table operations.
 */
export function createMockSupabaseClient() {
  return {
    rpc: vi.fn((procedureName: string, params: Record<string, unknown>) => {
      if (procedureName === 'search_wiki') {
        const threshold = (params.match_threshold as number) || 0.4
        const count = (params.match_count as number) || 5
        // For mock, we return all chunks above threshold (query matching done elsewhere)
        const results = mockWikiChunks
          .filter((c) => (c.similarity || 0) >= threshold)
          .slice(0, count)
        return Promise.resolve({ data: results, error: null })
      }

      if (procedureName === 'search_sessions') {
        const athleteId = params.p_athlete_id as string
        const threshold = (params.match_threshold as number) || 0.4
        const count = (params.match_count as number) || 5

        if (!athleteId) {
          return Promise.resolve({ data: [], error: null })
        }

        const results = mockSessionEmbeddings
          .filter((s) => (s.similarity || 0) >= threshold)
          .slice(0, count)
        return Promise.resolve({ data: results, error: null })
      }

      return Promise.resolve({ data: [], error: null })
    }),

    from: vi.fn((tableName: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      delete: vi.fn(() => ({
        neq: vi.fn(() => Promise.resolve({ data: null, error: null })),
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
  }
}

/**
 * Setup mock for the Supabase server client
 *
 * Call this to mock @/lib/supabase/server module.
 * The mock client will use local test data instead of a real database.
 */
export function setupMockSupabase() {
  const mockClient = createMockSupabaseClient()

  vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
    isSupabaseConfigured: true,
  }))

  return mockClient
}

/**
 * Setup mock for Supabase with custom RPC responses
 *
 * Use this when you need to control exact responses for specific test scenarios.
 */
export function setupMockSupabaseWithResponses(responses: {
  search_wiki?: { data: unknown; error: unknown }
  search_sessions?: { data: unknown; error: unknown }
}) {
  const mockClient = {
    rpc: vi.fn((procedureName: string) => {
      if (procedureName === 'search_wiki' && responses.search_wiki) {
        return Promise.resolve(responses.search_wiki)
      }
      if (procedureName === 'search_sessions' && responses.search_sessions) {
        return Promise.resolve(responses.search_sessions)
      }
      return Promise.resolve({ data: [], error: null })
    }),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  }

  vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
    isSupabaseConfigured: true,
  }))

  return mockClient
}

/**
 * Setup mock for Supabase that returns errors
 *
 * Use this to test error handling paths.
 */
export function setupMockSupabaseWithError(errorMessage: string) {
  const mockClient = {
    rpc: vi.fn(() =>
      Promise.resolve({
        data: null,
        error: { message: errorMessage, code: 'TEST_ERROR' },
      })
    ),
    from: vi.fn(() => ({
      select: vi.fn(() =>
        Promise.resolve({
          data: null,
          error: { message: errorMessage, code: 'TEST_ERROR' },
        })
      ),
    })),
  }

  vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
    isSupabaseConfigured: true,
  }))

  return mockClient
}

/**
 * Setup mock for Supabase that returns null (not configured)
 */
export function setupMockSupabaseUnconfigured() {
  vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => Promise.resolve(null)),
    isSupabaseConfigured: false,
  }))
}

/**
 * Mock the embeddings module to return deterministic embeddings
 *
 * This avoids the overhead of loading the ML model in tests.
 */
export function setupMockEmbeddings() {
  // Simple hash function to generate deterministic "embeddings"
  const hashString = (str: string): number[] => {
    const dimensions = 384
    const embedding = new Array(dimensions).fill(0)

    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i)
      embedding[i % dimensions] += charCode / 1000
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0)) || 1
    return embedding.map((v) => v / norm)
  }

  vi.mock('@/lib/rag/embeddings', () => ({
    generateEmbedding: vi.fn((text: string) => Promise.resolve(hashString(text))),
    generateEmbeddings: vi.fn((texts: string[]) =>
      Promise.resolve(texts.map(hashString))
    ),
    cosineSimilarity: vi.fn((a: number[], b: number[]) => {
      if (a.length !== b.length) throw new Error('Embeddings must have same dimensions')
      let dot = 0, normA = 0, normB = 0
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
      }
      return dot / (Math.sqrt(normA) * Math.sqrt(normB))
    }),
    EMBEDDING_DIMENSIONS: 384,
    getProviderInfo: vi.fn(() => ({
      provider: 'local',
      dimensions: 384,
      model: 'mock-model',
    })),
  }))
}

/**
 * Mock embeddings that throws an error
 */
export function setupMockEmbeddingsWithError(errorMessage: string) {
  vi.mock('@/lib/rag/embeddings', () => ({
    generateEmbedding: vi.fn(() => Promise.reject(new Error(errorMessage))),
    generateEmbeddings: vi.fn(() => Promise.reject(new Error(errorMessage))),
    cosineSimilarity: vi.fn(() => 0),
    EMBEDDING_DIMENSIONS: 384,
    getProviderInfo: vi.fn(() => ({
      provider: 'local',
      dimensions: 384,
      model: 'mock-model',
    })),
  }))
}

/**
 * Clear all mocks between tests
 */
export function clearAllMocks() {
  vi.clearAllMocks()
  vi.resetModules()
}

/**
 * Helper to create a mock tool context
 */
export function createMockToolContext(overrides: Partial<{
  athleteId: string
  userId: string
  sessionId: string
}> = {}) {
  return {
    athleteId: overrides.athleteId || 'test-athlete-123',
    userId: overrides.userId || 'test-user-456',
    sessionId: overrides.sessionId || 'test-session-789',
    ...overrides,
  }
}

// Re-export mock data for convenience
export {
  mockWikiChunks,
  mockSessionEmbeddings,
  filterMockWikiChunks,
  filterMockSessionEmbeddings,
}
