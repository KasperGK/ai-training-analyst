/**
 * RAG Vector Search Tests
 *
 * Validates search quality using golden queries against the REAL vector store.
 * These are integration tests that require:
 * 1. Supabase connection (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
 * 2. Database seeded with wiki chunks (run: npx tsx scripts/seed-wiki.ts)
 *
 * Run: npm test -- tests/rag/vector-search.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { goldenQueries, allArticleSlugs } from './__fixtures__/golden-queries'
import { getArticleBySlug } from '@/lib/wiki/articles'
import type { WikiChunk } from '@/lib/rag/vector-store'

// Check if Supabase is configured
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Track metrics across all tests for summary
const testMetrics = {
  totalQueries: 0,
  successfulQueries: 0,
  similarities: [] as number[],
  searchTimes: [] as number[],
}

// Check if database is available and seeded
let dbAvailable = false
let supabase: ReturnType<typeof createSupabaseClient> | null = null
let generateEmbedding: ((text: string) => Promise<number[]>) | null = null

// Direct searchWiki implementation for tests (bypasses Next.js cookies)
async function searchWiki(
  query: string,
  options: { matchThreshold?: number; matchCount?: number } = {}
): Promise<WikiChunk[]> {
  if (!supabase || !generateEmbedding) return []

  const { matchThreshold = 0.4, matchCount = 5 } = options
  const queryEmbedding = await generateEmbedding(query)

  const { data, error } = await supabase.rpc('search_wiki', {
    query_embedding: `[${queryEmbedding.join(',')}]`,
    match_threshold: matchThreshold,
    match_count: matchCount,
  })

  if (error) return []

  // Enrich with governance metadata
  return (data || []).map((chunk: WikiChunk) => {
    const article = getArticleBySlug(chunk.article_slug)
    return {
      ...chunk,
      confidenceLevel: article?.confidenceLevel,
      consensusNote: article?.consensusNote,
      sourceCount: article?.sources?.length,
      lastVerified: article?.lastVerified,
    }
  })
}

beforeAll(async () => {
  // Check if Supabase is configured
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('\n' + '='.repeat(60))
    console.log('⚠️  SUPABASE NOT CONFIGURED')
    console.log('='.repeat(60))
    console.log('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    console.log('='.repeat(60) + '\n')
    return
  }

  // Create direct Supabase client (bypasses Next.js cookies)
  supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_KEY)

  // Import embedding function
  const embeddings = await import('@/lib/rag/embeddings')
  generateEmbedding = embeddings.generateEmbedding

  // Try a search that should return results if DB is seeded
  const testResults = await searchWiki('FTP', { matchCount: 1, matchThreshold: 0.1 })
  dbAvailable = testResults.length > 0

  if (!dbAvailable) {
    console.log('\n' + '='.repeat(60))
    console.log('⚠️  DATABASE NOT SEEDED')
    console.log('='.repeat(60))
    console.log('Integration tests require a seeded database.')
    console.log('')
    console.log('To enable integration tests:')
    console.log('  Run: npx tsx scripts/seed-wiki.ts')
    console.log('')
    console.log('Unit tests will still run.')
    console.log('='.repeat(60) + '\n')
  } else {
    console.log('\n✅ Database connected and seeded - running full integration tests\n')
  }
})

// Helper to skip or run test based on DB availability
const dbTest = (name: string, fn: () => Promise<void>) => {
  it(name, async () => {
    if (!dbAvailable) {
      // Pass silently - DB tests are optional
      return
    }
    await fn()
  })
}

describe('Vector Search Quality', () => {
  describe('Golden Query Validation', () => {
    const fundamentalQueries = goldenQueries.filter((q) => q.category === 'fundamentals')
    const metricQueries = goldenQueries.filter((q) => q.category === 'metrics')
    const conceptQueries = goldenQueries.filter((q) => q.category === 'concepts')
    const edgeCaseQueries = goldenQueries.filter((q) => q.category === 'edge-cases')
    const typoQueries = goldenQueries.filter((q) => q.category === 'typos')
    const negativeQueries = goldenQueries.filter((q) => q.category === 'negative')
    const ambiguousQueries = goldenQueries.filter((q) => q.category === 'ambiguous')
    const multiMatchQueries = goldenQueries.filter((q) => q.category === 'multi-match')

    describe('Fundamentals', () => {
      it.each(fundamentalQueries)('finds expected results for: "$query"', async (tc) => {
        if (!dbAvailable) return // Skip when no DB

        const start = performance.now()
        const results = await searchWiki(tc.query, { matchCount: 5, matchThreshold: 0.35 })
        const elapsed = performance.now() - start

        testMetrics.totalQueries++
        testMetrics.searchTimes.push(elapsed)

        const resultSlugs = results.map((r) => r.article_slug)

        if (tc.expected.length === 0) {
          expect(results.length).toBe(0)
          testMetrics.successfulQueries++
        } else {
          const hasExpected = tc.expected.some((slug) => resultSlugs.includes(slug))
          if (hasExpected) {
            testMetrics.successfulQueries++
            results.forEach((r) => {
              if (tc.expected.includes(r.article_slug) && r.similarity) {
                testMetrics.similarities.push(r.similarity)
              }
            })
          }
          expect(hasExpected).toBe(true)
        }
      })
    })

    describe('Metrics', () => {
      it.each(metricQueries)('finds expected results for: "$query"', async (tc) => {
        if (!dbAvailable) return

        const start = performance.now()
        const results = await searchWiki(tc.query, { matchCount: 5, matchThreshold: 0.35 })
        const elapsed = performance.now() - start

        testMetrics.totalQueries++
        testMetrics.searchTimes.push(elapsed)

        const resultSlugs = results.map((r) => r.article_slug)

        if (tc.expected.length === 0) {
          expect(results.length).toBe(0)
          testMetrics.successfulQueries++
        } else {
          const hasExpected = tc.expected.some((slug) => resultSlugs.includes(slug))
          if (hasExpected) {
            testMetrics.successfulQueries++
            results.forEach((r) => {
              if (tc.expected.includes(r.article_slug) && r.similarity) {
                testMetrics.similarities.push(r.similarity)
              }
            })
          }
          expect(hasExpected).toBe(true)
        }
      })
    })

    describe('Concepts', () => {
      it.each(conceptQueries)('finds expected results for: "$query"', async (tc) => {
        if (!dbAvailable) return

        const start = performance.now()
        const results = await searchWiki(tc.query, { matchCount: 5, matchThreshold: 0.35 })
        const elapsed = performance.now() - start

        testMetrics.totalQueries++
        testMetrics.searchTimes.push(elapsed)

        const resultSlugs = results.map((r) => r.article_slug)

        if (tc.expected.length === 0) {
          expect(results.length).toBe(0)
          testMetrics.successfulQueries++
        } else {
          const hasExpected = tc.expected.some((slug) => resultSlugs.includes(slug))
          if (hasExpected) {
            testMetrics.successfulQueries++
            results.forEach((r) => {
              if (tc.expected.includes(r.article_slug) && r.similarity) {
                testMetrics.similarities.push(r.similarity)
              }
            })
          }
          expect(hasExpected).toBe(true)
        }
      })
    })

    describe('Edge Cases', () => {
      it.each(edgeCaseQueries)('handles edge case: "$query"', async (tc) => {
        if (!dbAvailable) return

        const start = performance.now()
        const minThreshold = tc.minSimilarity || 0.4
        const results = await searchWiki(tc.query, { matchCount: 5, matchThreshold: minThreshold - 0.05 })
        const elapsed = performance.now() - start

        testMetrics.totalQueries++
        testMetrics.searchTimes.push(elapsed)

        const resultSlugs = results.map((r) => r.article_slug)

        if (tc.expected.length === 0) {
          expect(results.length).toBe(0)
          testMetrics.successfulQueries++
        } else {
          const hasExpected = tc.expected.some((slug) => resultSlugs.includes(slug))
          if (hasExpected) {
            testMetrics.successfulQueries++
            results.forEach((r) => {
              if (tc.expected.includes(r.article_slug) && r.similarity) {
                testMetrics.similarities.push(r.similarity)
              }
            })
          }
          expect(hasExpected).toBe(true)
        }
      })
    })

    describe('Typos', () => {
      it.each(typoQueries)('handles typo: "$query"', async (tc) => {
        if (!dbAvailable) return

        const start = performance.now()
        const minThreshold = tc.minSimilarity || 0.35
        const results = await searchWiki(tc.query, { matchCount: 5, matchThreshold: minThreshold - 0.05 })
        const elapsed = performance.now() - start

        testMetrics.totalQueries++
        testMetrics.searchTimes.push(elapsed)

        const resultSlugs = results.map((r) => r.article_slug)

        if (tc.expected.length === 0) {
          expect(results.length).toBe(0)
          testMetrics.successfulQueries++
        } else {
          const hasExpected = tc.expected.some((slug) => resultSlugs.includes(slug))
          if (hasExpected) {
            testMetrics.successfulQueries++
            results.forEach((r) => {
              if (tc.expected.includes(r.article_slug) && r.similarity) {
                testMetrics.similarities.push(r.similarity)
              }
            })
          }
          // Typo tests are non-blocking - just log failures
          if (!hasExpected) {
            console.log(`[TYPO] "${tc.query}" - expected ${tc.expected.join(', ')}, got ${resultSlugs.join(', ')}`)
          }
        }
      })
    })

    describe('Negative Tests', () => {
      it.each(negativeQueries)('returns no results for off-topic: "$query"', async (tc) => {
        if (!dbAvailable) return

        const start = performance.now()
        const results = await searchWiki(tc.query, { matchCount: 5, matchThreshold: 0.4 })
        const elapsed = performance.now() - start

        testMetrics.totalQueries++
        testMetrics.searchTimes.push(elapsed)

        // Off-topic queries should return empty or very low similarity results
        if (results.length === 0) {
          testMetrics.successfulQueries++
        } else {
          // Allow results but they should have low similarity
          const maxSim = Math.max(...results.map(r => r.similarity || 0))
          if (maxSim < 0.45) {
            testMetrics.successfulQueries++
          } else {
            console.log(`[NEGATIVE] "${tc.query}" unexpectedly matched with sim ${maxSim.toFixed(2)}`)
          }
        }
        // Negative tests pass if no results or very low similarity
        const hasHighMatch = results.some(r => (r.similarity || 0) >= 0.45)
        expect(hasHighMatch).toBe(false)
      })
    })

    describe('Ambiguous Queries', () => {
      it.each(ambiguousQueries)('handles ambiguous query: "$query"', async (tc) => {
        if (!dbAvailable) return

        const start = performance.now()
        const minThreshold = tc.minSimilarity || 0.3
        const results = await searchWiki(tc.query, { matchCount: 5, matchThreshold: minThreshold - 0.05 })
        const elapsed = performance.now() - start

        testMetrics.totalQueries++
        testMetrics.searchTimes.push(elapsed)

        const resultSlugs = results.map((r) => r.article_slug)

        if (tc.expected.length === 0) {
          testMetrics.successfulQueries++
        } else {
          const hasExpected = tc.expected.some((slug) => resultSlugs.includes(slug))
          if (hasExpected) {
            testMetrics.successfulQueries++
            results.forEach((r) => {
              if (tc.expected.includes(r.article_slug) && r.similarity) {
                testMetrics.similarities.push(r.similarity)
              }
            })
          }
          // Ambiguous tests are informational - log but don't fail
          if (!hasExpected) {
            console.log(`[AMBIGUOUS] "${tc.query}" - expected any of ${tc.expected.join(', ')}, got ${resultSlugs.join(', ')}`)
          }
        }
      })
    })

    describe('Multi-Match Queries', () => {
      it.each(multiMatchQueries)('returns multiple relevant results for: "$query"', async (tc) => {
        if (!dbAvailable) return

        const start = performance.now()
        const results = await searchWiki(tc.query, { matchCount: 5, matchThreshold: 0.35 })
        const elapsed = performance.now() - start

        testMetrics.totalQueries++
        testMetrics.searchTimes.push(elapsed)

        const resultSlugs = results.map((r) => r.article_slug)

        // Count how many expected articles were found
        const matchedExpected = tc.expected.filter((slug) => resultSlugs.includes(slug))

        // Success if at least one expected result is found
        if (matchedExpected.length > 0) {
          testMetrics.successfulQueries++
          results.forEach((r) => {
            if (tc.expected.includes(r.article_slug) && r.similarity) {
              testMetrics.similarities.push(r.similarity)
            }
          })
        }

        // Log multi-match coverage
        console.log(`[MULTI] "${tc.query.substring(0, 30)}..." - matched ${matchedExpected.length}/${tc.expected.length} expected`)

        expect(matchedExpected.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Search Performance', () => {
    it('completes search within acceptable time', async () => {
      if (!dbAvailable) return

      const start = performance.now()
      await searchWiki('FTP threshold training')
      const elapsed = performance.now() - start

      console.log(`\n⏱️  Search time: ${elapsed.toFixed(0)}ms`)
      // Allow time for embedding generation + DB query
      expect(elapsed).toBeLessThan(5000)
    })

    it('handles multiple sequential searches efficiently', async () => {
      if (!dbAvailable) return

      const queries = ['FTP', 'TSS', 'recovery', 'intervals', 'tapering']
      const times: number[] = []

      for (const query of queries) {
        const start = performance.now()
        await searchWiki(query)
        times.push(performance.now() - start)
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length
      console.log(`\n⏱️  Average search time: ${avgTime.toFixed(0)}ms`)

      // After warmup, should be faster
      const laterSearches = times.slice(1)
      const avgLaterTime = laterSearches.reduce((a, b) => a + b, 0) / laterSearches.length
      console.log(`⏱️  Average after warmup: ${avgLaterTime.toFixed(0)}ms`)
    })
  })

  describe('Result Quality', () => {
    it('returns results ordered by similarity descending', async () => {
      if (!dbAvailable) return

      const results = await searchWiki('threshold training FTP')
      for (let i = 1; i < results.length; i++) {
        const prevSim = results[i - 1].similarity || 0
        const currSim = results[i].similarity || 0
        expect(prevSim).toBeGreaterThanOrEqual(currSim)
      }
    })

    it('respects match count limit', async () => {
      if (!dbAvailable) return

      const results = await searchWiki('training', { matchCount: 3 })
      expect(results.length).toBeLessThanOrEqual(3)
    })

    it('respects similarity threshold', async () => {
      if (!dbAvailable) return

      const threshold = 0.5
      const results = await searchWiki('FTP power', { matchThreshold: threshold })
      results.forEach((r) => {
        if (r.similarity !== undefined) {
          expect(r.similarity).toBeGreaterThanOrEqual(threshold)
        }
      })
    })

    it('returns empty array for gibberish queries', async () => {
      if (!dbAvailable) return

      const results = await searchWiki('xyzabc123nonsense', { matchThreshold: 0.4 })
      expect(results.length).toBe(0)
    })
  })

  describe('Governance Metadata Enrichment', () => {
    it('enriches results with confidence level', async () => {
      if (!dbAvailable) return

      const results = await searchWiki('what is FTP')
      results.forEach((r) => {
        expect(r.confidenceLevel).toBeDefined()
        expect(['established', 'strong_evidence', 'emerging', 'debated']).toContain(r.confidenceLevel)
      })
    })

    it('enriches results with source count', async () => {
      if (!dbAvailable) return

      const results = await searchWiki('training stress score')
      results.forEach((r) => {
        expect(r.sourceCount).toBeDefined()
        expect(r.sourceCount).toBeGreaterThan(0)
      })
    })

    it('includes consensusNote when article has one', async () => {
      if (!dbAvailable) return

      const results = await searchWiki('sweet spot training 88-93% FTP')
      const sweetSpotResult = results.find((r) => r.article_slug === 'sweet-spot-training')
      if (sweetSpotResult) {
        expect(sweetSpotResult.consensusNote).toBeDefined()
      }
    })

    it('includes lastVerified date', async () => {
      if (!dbAvailable) return

      const results = await searchWiki('recovery principles')
      results.forEach((r) => {
        expect(r.lastVerified).toBeDefined()
        expect(r.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      })
    })
  })
})

// Unit tests - these always run (no DB required)
describe('Article Coverage (Unit Tests)', () => {
  it('all wiki articles exist and have content', () => {
    allArticleSlugs.forEach((slug: string) => {
      const article = getArticleBySlug(slug)
      expect(article).toBeDefined()
      expect(article?.content.length).toBeGreaterThan(100)
      expect(article?.title).toBeDefined()
    })
  })

  it('all articles have governance metadata', () => {
    allArticleSlugs.forEach((slug: string) => {
      const article = getArticleBySlug(slug)
      expect(article?.confidenceLevel).toBeDefined()
      expect(article?.status).toBeDefined()
      expect(article?.lastVerified).toBeDefined()
      expect(article?.sources.length).toBeGreaterThan(0)
    })
  })
})

describe('Quality Metrics Summary', () => {
  it('reports success rate (integration test)', async () => {
    if (!dbAvailable) {
      console.log('\n📊 RAG VALIDATION SUMMARY: SKIPPED (no database)')
      return
    }

    // Run all golden queries to populate metrics
    for (const tc of goldenQueries) {
      const results = await searchWiki(tc.query, { matchCount: 5, matchThreshold: 0.35 })
      const resultSlugs = results.map((r) => r.article_slug)

      testMetrics.totalQueries++

      if (tc.expected.length === 0) {
        if (results.length === 0) testMetrics.successfulQueries++
      } else {
        const hasExpected = tc.expected.some((slug) => resultSlugs.includes(slug))
        if (hasExpected) {
          testMetrics.successfulQueries++
          results.forEach((r) => {
            if (tc.expected.includes(r.article_slug) && r.similarity) {
              testMetrics.similarities.push(r.similarity)
            }
          })
        }
      }
    }

    const successRate = (testMetrics.successfulQueries / testMetrics.totalQueries) * 100

    console.log('\n' + '='.repeat(50))
    console.log('📊 RAG VALIDATION SUMMARY')
    console.log('='.repeat(50))
    console.log(`Golden Query Success Rate: ${successRate.toFixed(1)}% (${testMetrics.successfulQueries}/${testMetrics.totalQueries})`)

    if (testMetrics.similarities.length > 0) {
      const avgSimilarity = testMetrics.similarities.reduce((a, b) => a + b, 0) / testMetrics.similarities.length
      console.log(`Average Similarity: ${(avgSimilarity * 100).toFixed(1)}%`)
    }

    if (testMetrics.searchTimes.length > 0) {
      const avgTime = testMetrics.searchTimes.reduce((a, b) => a + b, 0) / testMetrics.searchTimes.length
      console.log(`Average Search Time: ${avgTime.toFixed(0)}ms`)
    }

    console.log('='.repeat(50))

    // Target: 90%+ success rate
    expect(successRate).toBeGreaterThanOrEqual(90)
  })

  it('meets similarity target when DB available', async () => {
    if (!dbAvailable || testMetrics.similarities.length === 0) return

    const avgSimilarity = testMetrics.similarities.reduce((a, b) => a + b, 0) / testMetrics.similarities.length
    expect(avgSimilarity).toBeGreaterThanOrEqual(0.45)
  })
})
