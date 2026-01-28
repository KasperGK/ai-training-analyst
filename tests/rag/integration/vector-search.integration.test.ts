/**
 * RAG Vector Search Integration Tests
 *
 * These tests run against the REAL Supabase database to verify:
 * - pgvector similarity search works correctly
 * - The search_wiki RPC function returns relevant results
 * - Real embeddings match real content semantically
 * - Database schema and indexes are functioning
 *
 * Prerequisites:
 * - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 * - Wiki chunks seeded in the database (npm run seed:wiki)
 *
 * Run with: npm test -- tests/rag/integration/
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Check if Supabase is configured
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY)

// Skip all tests if Supabase isn't configured
const describeIntegration = isSupabaseConfigured ? describe : describe.skip

// Create a direct Supabase client for testing (bypasses Next.js cookies)
function createTestClient() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Supabase not configured')
  }
  return createSupabaseClient(SUPABASE_URL, SUPABASE_KEY)
}

describeIntegration('RAG Integration Tests (Real Database)', () => {
  let supabase: ReturnType<typeof createTestClient>
  let generateEmbedding: typeof import('@/lib/rag/embeddings').generateEmbedding
  let getArticleBySlug: typeof import('@/lib/wiki/articles').getArticleBySlug

  beforeAll(async () => {
    supabase = createTestClient()

    // Import the embedding function
    const embeddings = await import('@/lib/rag/embeddings')
    generateEmbedding = embeddings.generateEmbedding

    // Import article lookup for governance metadata
    const articles = await import('@/lib/wiki/articles')
    getArticleBySlug = articles.getArticleBySlug
  })

  // Helper to search wiki using real database
  async function searchWikiDirect(
    query: string,
    options: { matchThreshold?: number; matchCount?: number } = {}
  ) {
    const { matchThreshold = 0.4, matchCount = 5 } = options

    const queryEmbedding = await generateEmbedding(query)

    const { data, error } = await supabase.rpc('search_wiki', {
      query_embedding: `[${queryEmbedding.join(',')}]`,
      match_threshold: matchThreshold,
      match_count: matchCount,
    })

    if (error) {
      console.error('Search error:', error)
      return []
    }

    // Enrich with governance metadata
    return (data || []).map((chunk: { article_slug: string; similarity?: number; title: string; content: string }) => {
      const article = getArticleBySlug(chunk.article_slug)
      return {
        ...chunk,
        confidenceLevel: article?.confidenceLevel,
        consensusNote: article?.consensusNote,
        sourceCount: article?.sources?.length,
      }
    })
  }

  describe('Database Health', () => {
    it('wiki_chunks table has data', async () => {
      const { count, error } = await supabase
        .from('wiki_chunks')
        .select('*', { count: 'exact', head: true })

      expect(error).toBeNull()
      expect(count).toBeGreaterThan(0)
      console.log(`✓ Found ${count} wiki chunks in database`)
    })
  })

  describe('Semantic Search Quality', () => {
    it('FTP query returns FTP-related articles', async () => {
      const results = await searchWikiDirect('what is FTP functional threshold power', {
        matchThreshold: 0.3,
        matchCount: 5,
      })

      expect(results.length).toBeGreaterThan(0)

      // At least one result should be about FTP
      const ftpRelated = results.some(
        (r: { article_slug: string; title: string; content: string }) =>
          r.article_slug.includes('ftp') ||
          r.title.toLowerCase().includes('ftp') ||
          r.content.toLowerCase().includes('functional threshold')
      )
      expect(ftpRelated).toBe(true)

      // Log results for debugging
      console.log('FTP query results:')
      results.forEach((r: { title: string; article_slug: string; similarity?: number }, i: number) => {
        console.log(`  ${i + 1}. ${r.title} (${r.article_slug}) - ${((r.similarity || 0) * 100).toFixed(1)}%`)
      })
    })

    it('TSS query returns training stress articles', async () => {
      const results = await searchWikiDirect('training stress score TSS calculation', {
        matchThreshold: 0.3,
        matchCount: 5,
      })

      expect(results.length).toBeGreaterThan(0)

      const tssRelated = results.some(
        (r: { article_slug: string; title: string; content: string }) =>
          r.article_slug.includes('tss') ||
          r.title.toLowerCase().includes('stress') ||
          r.content.toLowerCase().includes('training stress')
      )
      expect(tssRelated).toBe(true)

      console.log('TSS query results:')
      results.forEach((r: { title: string; article_slug: string; similarity?: number }, i: number) => {
        console.log(`  ${i + 1}. ${r.title} (${r.article_slug}) - ${((r.similarity || 0) * 100).toFixed(1)}%`)
      })
    })

    it('recovery query returns recovery-related articles', async () => {
      const results = await searchWikiDirect('how to recover between hard workouts rest days', {
        matchThreshold: 0.3,
        matchCount: 5,
      })

      expect(results.length).toBeGreaterThan(0)

      const recoveryRelated = results.some(
        (r: { article_slug: string; title: string; content: string }) =>
          r.article_slug.includes('recovery') ||
          r.title.toLowerCase().includes('recovery') ||
          r.content.toLowerCase().includes('recovery') ||
          r.content.toLowerCase().includes('rest')
      )
      expect(recoveryRelated).toBe(true)

      console.log('Recovery query results:')
      results.forEach((r: { title: string; article_slug: string; similarity?: number }, i: number) => {
        console.log(`  ${i + 1}. ${r.title} (${r.article_slug}) - ${((r.similarity || 0) * 100).toFixed(1)}%`)
      })
    })

    it('power zones query returns zone-related articles', async () => {
      const results = await searchWikiDirect('power zones training zones explained', {
        matchThreshold: 0.3,
        matchCount: 5,
      })

      expect(results.length).toBeGreaterThan(0)

      const zonesRelated = results.some(
        (r: { article_slug: string; title: string; content: string }) =>
          r.article_slug.includes('zone') ||
          r.title.toLowerCase().includes('zone') ||
          r.content.toLowerCase().includes('zone')
      )
      expect(zonesRelated).toBe(true)

      console.log('Power zones query results:')
      results.forEach((r: { title: string; article_slug: string; similarity?: number }, i: number) => {
        console.log(`  ${i + 1}. ${r.title} (${r.article_slug}) - ${((r.similarity || 0) * 100).toFixed(1)}%`)
      })
    })
  })

  describe('Similarity Threshold Behavior', () => {
    it('higher threshold returns fewer but more relevant results', async () => {
      const lowThreshold = await searchWikiDirect('training', { matchThreshold: 0.2, matchCount: 10 })
      const highThreshold = await searchWikiDirect('training', { matchThreshold: 0.5, matchCount: 10 })

      // Low threshold should return more results
      expect(lowThreshold.length).toBeGreaterThanOrEqual(highThreshold.length)

      // High threshold results should have better similarity scores
      if (highThreshold.length > 0) {
        const avgHighSimilarity = highThreshold.reduce((sum: number, r: { similarity?: number }) => sum + (r.similarity || 0), 0) / highThreshold.length
        expect(avgHighSimilarity).toBeGreaterThan(0.5)
      }

      console.log(`Low threshold (0.2): ${lowThreshold.length} results`)
      console.log(`High threshold (0.5): ${highThreshold.length} results`)
    })

    it('gibberish query returns no results with reasonable threshold', async () => {
      const results = await searchWikiDirect('xyzabc123nonsensequery', {
        matchThreshold: 0.5,
        matchCount: 5,
      })

      // Should return few or no results for gibberish
      expect(results.length).toBeLessThanOrEqual(1)

      if (results.length > 0) {
        // Any result should have low similarity
        expect(results[0].similarity).toBeLessThan(0.6)
      }

      console.log(`Gibberish query: ${results.length} results`)
    })
  })

  describe('Governance Metadata Enrichment', () => {
    it('results include confidence level from article definitions', async () => {
      const results = await searchWikiDirect('what is FTP', {
        matchThreshold: 0.3,
        matchCount: 3,
      })

      expect(results.length).toBeGreaterThan(0)

      // Check that governance metadata is enriched
      const hasGovernance = results.some((r: { confidenceLevel?: string }) => r.confidenceLevel !== undefined)
      expect(hasGovernance).toBe(true)

      console.log('Governance metadata:')
      results.forEach((r: { article_slug: string; confidenceLevel?: string; sourceCount?: number }, i: number) => {
        console.log(`  ${i + 1}. ${r.article_slug}: confidence=${r.confidenceLevel}, sources=${r.sourceCount}`)
      })
    })
  })

  describe('Result Ordering', () => {
    it('results are ordered by similarity (highest first)', async () => {
      const results = await searchWikiDirect('cycling training periodization', {
        matchThreshold: 0.2,
        matchCount: 5,
      })

      if (results.length >= 2) {
        for (let i = 0; i < results.length - 1; i++) {
          const currentSim = results[i].similarity || 0
          const nextSim = results[i + 1].similarity || 0
          expect(currentSim).toBeGreaterThanOrEqual(nextSim)
        }
      }

      console.log('Similarity ordering:')
      results.forEach((r: { title: string; similarity?: number }, i: number) => {
        console.log(`  ${i + 1}. ${((r.similarity || 0) * 100).toFixed(1)}% - ${r.title}`)
      })
    })
  })
})

// Also test with real embedding generation
describeIntegration('Embedding Generation Integration', () => {
  let generateEmbedding: typeof import('@/lib/rag/embeddings').generateEmbedding

  beforeAll(async () => {
    const embeddings = await import('@/lib/rag/embeddings')
    generateEmbedding = embeddings.generateEmbedding
  })

  it('generates 384-dimension embeddings', async () => {
    const embedding = await generateEmbedding('test query for embedding')

    expect(embedding).toHaveLength(384)
    expect(embedding.every(v => typeof v === 'number')).toBe(true)
  })

  it('similar queries produce more similar embeddings than different topics', async () => {
    const emb1 = await generateEmbedding('what is FTP in cycling')
    const emb2 = await generateEmbedding('functional threshold power cycling')
    const emb3 = await generateEmbedding('basketball rules and regulations')

    // Calculate cosine similarity
    const cosineSim = (a: number[], b: number[]) => {
      const dot = a.reduce((sum, val, i) => sum + val * b[i], 0)
      const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
      const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
      return dot / (magA * magB)
    }

    const simFtpQueries = cosineSim(emb1, emb2)
    const simDifferentTopics = cosineSim(emb1, emb3)

    // Similar queries should have higher similarity than different topics
    expect(simFtpQueries).toBeGreaterThan(simDifferentTopics)

    console.log(`FTP vs FTP similarity: ${(simFtpQueries * 100).toFixed(1)}%`)
    console.log(`FTP vs basketball similarity: ${(simDifferentTopics * 100).toFixed(1)}%`)
  })
})

// Print skip message if Supabase not configured
if (!isSupabaseConfigured) {
  console.log('\n⚠️  Supabase integration tests SKIPPED')
  console.log('   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run\n')
}
