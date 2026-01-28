/**
 * Session Search Tests
 *
 * Tests for the session embedding and search functionality.
 * Covers searchSessions(), session embedding storage, and summary generation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockSessionEmbeddings } from './__fixtures__/mock-chunks'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  isSupabaseConfigured: true,
}))

vi.mock('@/lib/rag/embeddings', () => ({
  generateEmbedding: vi.fn(() => Promise.resolve(new Array(384).fill(0.1))),
  generateEmbeddings: vi.fn((texts: string[]) =>
    Promise.resolve(texts.map(() => new Array(384).fill(0.1)))
  ),
  cosineSimilarity: vi.fn(() => 0.8),
  EMBEDDING_DIMENSIONS: 384,
}))

import { createClient } from '@/lib/supabase/server'

describe('Session Search', () => {
  let mockSupabase: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    mockSupabase = {
      rpc: vi.fn((name: string, params: Record<string, unknown>) => {
        if (name === 'search_sessions') {
          const athleteId = params.p_athlete_id as string
          const threshold = (params.match_threshold as number) || 0.4
          const count = (params.match_count as number) || 5

          // Return empty for non-existent athlete
          if (athleteId === 'non-existent-athlete') {
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
            gte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() =>
                  Promise.resolve({
                    data: tableName === 'sessions'
                      ? [
                          {
                            id: 'sess-001',
                            athlete_id: 'test-athlete',
                            date: '2024-01-15',
                            duration_seconds: 3600,
                            distance_meters: 35000,
                            sport: 'cycling',
                            workout_type: 'threshold',
                            avg_power: 250,
                            max_power: 320,
                            normalized_power: 265,
                            intensity_factor: 0.88,
                            tss: 75,
                            avg_hr: 155,
                            max_hr: 175,
                            avg_cadence: 90,
                            total_ascent: 400,
                            notes: 'Good threshold session',
                          },
                        ]
                      : [],
                    error: null,
                  })
                ),
              })),
            })),
          })),
        })),
        upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    }

    vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>)
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe('searchSessions', () => {
    it('filters by athlete ID', async () => {
      const { searchSessions } = await import('@/lib/rag/vector-store')

      await searchSessions('threshold workout', 'athlete-123', { matchCount: 3 })

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'search_sessions',
        expect.objectContaining({
          p_athlete_id: 'athlete-123',
        })
      )
    })

    it('returns session summaries with relevance scores', async () => {
      const { searchSessions } = await import('@/lib/rag/vector-store')

      const results = await searchSessions('threshold workout', 'athlete-123')

      expect(results.length).toBeGreaterThan(0)
      results.forEach((result) => {
        expect(result).toHaveProperty('summary')
        expect(result).toHaveProperty('similarity')
        expect(typeof result.similarity).toBe('number')
      })
    })

    it('respects matchCount limit', async () => {
      const { searchSessions } = await import('@/lib/rag/vector-store')

      await searchSessions('workout history', 'athlete-123', { matchCount: 2 })

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'search_sessions',
        expect.objectContaining({
          match_count: 2,
        })
      )
    })

    it('respects matchThreshold', async () => {
      const { searchSessions } = await import('@/lib/rag/vector-store')

      await searchSessions('workout history', 'athlete-123', { matchThreshold: 0.6 })

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'search_sessions',
        expect.objectContaining({
          match_threshold: 0.6,
        })
      )
    })

    it('returns empty array for non-existent athlete', async () => {
      const { searchSessions } = await import('@/lib/rag/vector-store')

      const results = await searchSessions('workout history', 'non-existent-athlete')

      expect(results).toEqual([])
    })

    it('uses default threshold of 0.4', async () => {
      const { searchSessions } = await import('@/lib/rag/vector-store')

      await searchSessions('workout query', 'athlete-123')

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'search_sessions',
        expect.objectContaining({
          match_threshold: 0.4,
        })
      )
    })

    it('uses default matchCount of 5', async () => {
      const { searchSessions } = await import('@/lib/rag/vector-store')

      await searchSessions('workout query', 'athlete-123')

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'search_sessions',
        expect.objectContaining({
          match_count: 5,
        })
      )
    })

    it('returns empty array when Supabase client is null', async () => {
      vi.mocked(createClient).mockResolvedValue(null)

      const { searchSessions } = await import('@/lib/rag/vector-store')

      const results = await searchSessions('workout', 'athlete-123')

      expect(results).toEqual([])
    })

    it('returns empty array on database error', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: 'DB_ERROR' },
      })

      const { searchSessions } = await import('@/lib/rag/vector-store')

      const results = await searchSessions('workout', 'athlete-123')

      expect(results).toEqual([])
    })
  })

  describe('Session Embedding Storage', () => {
    it('stores embeddings with athlete context', async () => {
      const { storeSessionEmbedding } = await import('@/lib/rag/vector-store')

      const embedding = new Array(384).fill(0.1)
      const result = await storeSessionEmbedding(
        'session-001',
        'athlete-123',
        'Threshold workout summary',
        embedding
      )

      expect(result).toBe(true)
      expect(mockSupabase.from).toHaveBeenCalledWith('session_embeddings')
    })

    it('handles duplicate session updates via upsert', async () => {
      const { storeSessionEmbedding } = await import('@/lib/rag/vector-store')

      const embedding = new Array(384).fill(0.1)

      // First store
      await storeSessionEmbedding(
        'session-001',
        'athlete-123',
        'Original summary',
        embedding
      )

      // Second store (update)
      const result = await storeSessionEmbedding(
        'session-001',
        'athlete-123',
        'Updated summary',
        embedding
      )

      expect(result).toBe(true)
    })

    it('returns false when Supabase client is null', async () => {
      vi.mocked(createClient).mockResolvedValue(null)

      const { storeSessionEmbedding } = await import('@/lib/rag/vector-store')

      const result = await storeSessionEmbedding(
        'session-001',
        'athlete-123',
        'Summary',
        new Array(384).fill(0.1)
      )

      expect(result).toBe(false)
    })

    it('returns false on database error', async () => {
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn(() =>
          Promise.resolve({
            data: null,
            error: { message: 'Insert failed', code: 'INSERT_ERROR' },
          })
        ),
      })

      const { storeSessionEmbedding } = await import('@/lib/rag/vector-store')

      const result = await storeSessionEmbedding(
        'session-001',
        'athlete-123',
        'Summary',
        new Array(384).fill(0.1)
      )

      expect(result).toBe(false)
    })

    it('uses provided Supabase client when passed', async () => {
      const externalClient = {
        from: vi.fn(() => ({
          upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      }

      const { storeSessionEmbedding } = await import('@/lib/rag/vector-store')

      await storeSessionEmbedding(
        'session-001',
        'athlete-123',
        'Summary',
        new Array(384).fill(0.1),
        externalClient as unknown as Awaited<ReturnType<typeof createClient>>
      )

      // Should use provided client, not create new one
      expect(externalClient.from).toHaveBeenCalledWith('session_embeddings')
    })
  })

  describe('Session Summary Generation', () => {
    it('generates summary with date and duration', async () => {
      const { generateSessionSummary } = await import('@/lib/rag/session-embeddings')

      const session = {
        id: 'sess-001',
        athlete_id: 'athlete-123',
        date: '2024-01-15',
        duration_seconds: 3600, // 1 hour
        distance_meters: null,
        sport: 'cycling',
        workout_type: null,
        avg_power: null,
        max_power: null,
        normalized_power: null,
        intensity_factor: null,
        tss: null,
        avg_hr: null,
        max_hr: null,
        avg_cadence: null,
        total_ascent: null,
        notes: null,
      }

      const summary = generateSessionSummary(session)

      expect(summary).toContain('1h 0m')
      expect(summary).toContain('cycling')
      expect(summary).toContain('Monday') // Jan 15, 2024 is Monday
    })

    it('includes power metrics when available', async () => {
      const { generateSessionSummary } = await import('@/lib/rag/session-embeddings')

      // Note: Peak power is only included when max_power > avg_power * 1.5
      const session = {
        id: 'sess-001',
        athlete_id: 'athlete-123',
        date: '2024-01-15',
        duration_seconds: 3600,
        distance_meters: null,
        sport: 'cycling',
        workout_type: null,
        avg_power: 250,
        max_power: 450, // Must be > 250 * 1.5 = 375 to show peak
        normalized_power: 265,
        intensity_factor: null,
        tss: null,
        avg_hr: null,
        max_hr: null,
        avg_cadence: null,
        total_ascent: null,
        notes: null,
      }

      const summary = generateSessionSummary(session)

      expect(summary).toContain('NP 265w')
      expect(summary).toContain('avg 250w')
      expect(summary).toContain('peak 450w')
    })

    it('infers workout type from intensity factor', async () => {
      const { generateSessionSummary } = await import('@/lib/rag/session-embeddings')

      const thresholdSession = {
        id: 'sess-001',
        athlete_id: 'athlete-123',
        date: '2024-01-15',
        duration_seconds: 3600,
        distance_meters: null,
        sport: 'cycling',
        workout_type: null,
        avg_power: null,
        max_power: null,
        normalized_power: null,
        intensity_factor: 0.95, // Threshold zone
        tss: null,
        avg_hr: null,
        max_hr: null,
        avg_cadence: null,
        total_ascent: null,
        notes: null,
      }

      const summary = generateSessionSummary(thresholdSession)

      expect(summary).toContain('threshold')
    })

    it('handles intensity factor stored as percentage', async () => {
      const { generateSessionSummary } = await import('@/lib/rag/session-embeddings')

      const session = {
        id: 'sess-001',
        athlete_id: 'athlete-123',
        date: '2024-01-15',
        duration_seconds: 3600,
        distance_meters: null,
        sport: 'cycling',
        workout_type: null,
        avg_power: null,
        max_power: null,
        normalized_power: null,
        intensity_factor: 88, // 88% = sweet spot
        tss: null,
        avg_hr: null,
        max_hr: null,
        avg_cadence: null,
        total_ascent: null,
        notes: null,
      }

      const summary = generateSessionSummary(session)

      expect(summary).toContain('sweet spot')
    })

    it('includes TSS when available', async () => {
      const { generateSessionSummary } = await import('@/lib/rag/session-embeddings')

      const session = {
        id: 'sess-001',
        athlete_id: 'athlete-123',
        date: '2024-01-15',
        duration_seconds: 3600,
        distance_meters: null,
        sport: 'cycling',
        workout_type: null,
        avg_power: null,
        max_power: null,
        normalized_power: null,
        intensity_factor: null,
        tss: 85,
        avg_hr: null,
        max_hr: null,
        avg_cadence: null,
        total_ascent: null,
        notes: null,
      }

      const summary = generateSessionSummary(session)

      expect(summary).toContain('TSS 85')
    })

    it('includes climbing when significant', async () => {
      const { generateSessionSummary } = await import('@/lib/rag/session-embeddings')

      const session = {
        id: 'sess-001',
        athlete_id: 'athlete-123',
        date: '2024-01-15',
        duration_seconds: 7200,
        distance_meters: 80000,
        sport: 'cycling',
        workout_type: null,
        avg_power: null,
        max_power: null,
        normalized_power: null,
        intensity_factor: null,
        tss: null,
        avg_hr: null,
        max_hr: null,
        avg_cadence: null,
        total_ascent: 1500,
        notes: null,
      }

      const summary = generateSessionSummary(session)

      expect(summary).toContain('1500m climbing')
    })

    it('includes user notes', async () => {
      const { generateSessionSummary } = await import('@/lib/rag/session-embeddings')

      const session = {
        id: 'sess-001',
        athlete_id: 'athlete-123',
        date: '2024-01-15',
        duration_seconds: 3600,
        distance_meters: null,
        sport: 'cycling',
        workout_type: null,
        avg_power: null,
        max_power: null,
        normalized_power: null,
        intensity_factor: null,
        tss: null,
        avg_hr: null,
        max_hr: null,
        avg_cadence: null,
        total_ascent: null,
        notes: 'Felt strong today, good recovery',
      }

      const summary = generateSessionSummary(session)

      expect(summary).toContain('Felt strong today, good recovery')
    })

    it('includes distance in km', async () => {
      const { generateSessionSummary } = await import('@/lib/rag/session-embeddings')

      const session = {
        id: 'sess-001',
        athlete_id: 'athlete-123',
        date: '2024-01-15',
        duration_seconds: 3600,
        distance_meters: 45500,
        sport: 'cycling',
        workout_type: null,
        avg_power: null,
        max_power: null,
        normalized_power: null,
        intensity_factor: null,
        tss: null,
        avg_hr: null,
        max_hr: null,
        avg_cadence: null,
        total_ascent: null,
        notes: null,
      }

      const summary = generateSessionSummary(session)

      expect(summary).toContain('45.5km')
    })
  })
})
