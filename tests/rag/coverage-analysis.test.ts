/**
 * RAG Coverage Analysis Tests
 *
 * Identifies content gaps by testing queries that may not have
 * adequate coverage. These tests log results rather than fail,
 * providing input for future content development (e.g., Phase 2: Zwift).
 */

import { describe, it, expect } from 'vitest'
import { coverageGapQueries, allArticleSlugs } from './__fixtures__/golden-queries'
import { articles, searchArticles, getArticlesByCategory } from '@/lib/wiki/articles'
import { generateEmbedding, cosineSimilarity } from '@/lib/rag/embeddings'

// Simulated search results for coverage analysis
// In a real integration test, this would use the actual search_wiki RPC
interface CoverageResult {
  query: string
  resultCount: number
  topResult?: {
    slug: string
    title: string
    similarity: number
  }
  coverage: 'strong' | 'weak' | 'gap'
}

describe('Coverage Analysis', () => {
  describe('Content Completeness', () => {
    it('has expected number of articles', () => {
      expect(articles.length).toBeGreaterThanOrEqual(15)
      expect(allArticleSlugs.length).toBe(16) // Should match actual article count
    })

    it('covers core training categories', () => {
      const fundamentals = getArticlesByCategory('fundamentals')
      const metrics = getArticlesByCategory('metrics')
      const concepts = getArticlesByCategory('concepts')

      expect(fundamentals.length).toBeGreaterThanOrEqual(4)
      expect(metrics.length).toBeGreaterThanOrEqual(4)
      expect(concepts.length).toBeGreaterThanOrEqual(5)
    })

    it('has FTP-related content', () => {
      const ftpArticles = searchArticles('FTP')
      expect(ftpArticles.length).toBeGreaterThan(0)
    })

    it('has recovery content', () => {
      const recoveryArticles = searchArticles('recovery')
      expect(recoveryArticles.length).toBeGreaterThan(0)
    })

    it('has periodization content', () => {
      const periodizationArticles = searchArticles('periodization')
      expect(periodizationArticles.length).toBeGreaterThan(0)
    })
  })

  describe('Known Content Gaps', () => {
    // These tests identify known gaps for future content development
    // They log results rather than fail

    it('identifies Zwift/e-racing gap (Phase 2 content)', () => {
      const zwiftQueries = coverageGapQueries.filter((q) =>
        q.toLowerCase().includes('zwift') || q.toLowerCase().includes('e-racing')
      )

      console.log('\n🔍 ZWIFT/E-RACING COVERAGE GAP:')

      zwiftQueries.forEach((query) => {
        const results = searchArticles(query)
        console.log(`  "${query}": ${results.length} matches`)

        // These should have low/no coverage currently
        // This documents the gap for Phase 2
      })

      // Log recommendation
      console.log('\n📝 Recommended Phase 2 additions:')
      console.log('  - zwift-racing-tactics')
      console.log('  - virtual-vs-outdoor-pacing')
      console.log('  - e-racing-strategy')
      console.log('  - zwift-power-dynamics')
    })

    it('identifies nutrition coverage gap', () => {
      const nutritionQueries = coverageGapQueries.filter(
        (q) =>
          q.toLowerCase().includes('nutrition') ||
          q.toLowerCase().includes('carbohydrate') ||
          q.toLowerCase().includes('hydration')
      )

      console.log('\n🔍 NUTRITION COVERAGE GAP:')

      nutritionQueries.forEach((query) => {
        const results = searchArticles(query)
        console.log(`  "${query}": ${results.length} matches`)
      })
    })

    it('identifies mental/psychology gap', () => {
      const mentalQueries = coverageGapQueries.filter(
        (q) => q.toLowerCase().includes('mental') || q.toLowerCase().includes('anxiety')
      )

      console.log('\n🔍 MENTAL/PSYCHOLOGY COVERAGE GAP:')

      mentalQueries.forEach((query) => {
        const results = searchArticles(query)
        console.log(`  "${query}": ${results.length} matches`)
      })
    })

    it('identifies environment adaptation gap', () => {
      const envQueries = coverageGapQueries.filter(
        (q) =>
          q.toLowerCase().includes('heat') ||
          q.toLowerCase().includes('altitude') ||
          q.toLowerCase().includes('cold')
      )

      console.log('\n🔍 ENVIRONMENT ADAPTATION COVERAGE GAP:')

      envQueries.forEach((query) => {
        const results = searchArticles(query)
        console.log(`  "${query}": ${results.length} matches`)
      })
    })
  })

  describe('Coverage Gap Report', () => {
    it('generates comprehensive coverage report', async () => {
      const results: CoverageResult[] = []

      console.log('\n' + '='.repeat(60))
      console.log('📊 COVERAGE GAP ANALYSIS REPORT')
      console.log('='.repeat(60))

      for (const query of coverageGapQueries) {
        // Simple text-based search for coverage analysis
        const textResults = searchArticles(query)

        const result: CoverageResult = {
          query,
          resultCount: textResults.length,
          coverage: textResults.length === 0 ? 'gap' : textResults.length < 2 ? 'weak' : 'strong',
        }

        if (textResults.length > 0) {
          result.topResult = {
            slug: textResults[0].slug,
            title: textResults[0].title,
            similarity: 0, // Would be populated by vector search
          }
        }

        results.push(result)
      }

      // Group by coverage level
      const gaps = results.filter((r) => r.coverage === 'gap')
      const weak = results.filter((r) => r.coverage === 'weak')
      const strong = results.filter((r) => r.coverage === 'strong')

      console.log('\n❌ GAPS (No Results):')
      gaps.forEach((r) => {
        console.log(`  - "${r.query}"`)
      })

      console.log('\n⚠️  WEAK COVERAGE (<2 Results):')
      weak.forEach((r) => {
        console.log(`  - "${r.query}" → ${r.topResult?.title || 'N/A'}`)
      })

      console.log('\n✅ STRONG COVERAGE (2+ Results):')
      strong.forEach((r) => {
        console.log(`  - "${r.query}" → ${r.topResult?.title || 'N/A'}`)
      })

      console.log('\n📈 SUMMARY:')
      console.log(`  Total Queries Tested: ${results.length}`)
      console.log(`  Gaps: ${gaps.length} (${((gaps.length / results.length) * 100).toFixed(1)}%)`)
      console.log(`  Weak: ${weak.length} (${((weak.length / results.length) * 100).toFixed(1)}%)`)
      console.log(`  Strong: ${strong.length} (${((strong.length / results.length) * 100).toFixed(1)}%)`)
      console.log('='.repeat(60))

      // This test documents gaps rather than failing
      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe('Content Recommendations', () => {
    it('generates prioritized content recommendations', () => {
      // Analyze gaps and suggest priorities

      const recommendations = [
        {
          priority: 'HIGH',
          topic: 'Zwift/E-Racing',
          reason: 'No current coverage, popular user topic',
          suggestedArticles: [
            'zwift-racing-tactics',
            'virtual-vs-outdoor-pacing',
            'e-racing-strategy',
          ],
        },
        {
          priority: 'MEDIUM',
          topic: 'Nutrition',
          reason: 'Partial coverage, foundational topic',
          suggestedArticles: ['nutrition-fundamentals', 'race-day-fueling', 'hydration-strategy'],
        },
        {
          priority: 'MEDIUM',
          topic: 'Heat/Environment',
          reason: 'No coverage, affects performance',
          suggestedArticles: ['heat-adaptation', 'altitude-training', 'cold-weather-tips'],
        },
        {
          priority: 'LOW',
          topic: 'Mental Performance',
          reason: 'No coverage, adjacent to core content',
          suggestedArticles: ['race-day-mindset', 'training-motivation'],
        },
        {
          priority: 'LOW',
          topic: 'Strength Training',
          reason: 'No coverage, supporting topic',
          suggestedArticles: ['strength-for-cyclists', 'core-stability'],
        },
      ]

      console.log('\n' + '='.repeat(60))
      console.log('📋 CONTENT RECOMMENDATIONS')
      console.log('='.repeat(60))

      recommendations.forEach((rec) => {
        const emoji = rec.priority === 'HIGH' ? '🔴' : rec.priority === 'MEDIUM' ? '🟡' : '🟢'
        console.log(`\n${emoji} ${rec.priority}: ${rec.topic}`)
        console.log(`   Reason: ${rec.reason}`)
        console.log(`   Suggested Articles:`)
        rec.suggestedArticles.forEach((a) => console.log(`     - ${a}`))
      })

      console.log('\n' + '='.repeat(60))

      expect(recommendations.length).toBeGreaterThan(0)
    })
  })

  describe('Semantic Coverage Analysis', () => {
    // These tests use embeddings to find semantic gaps

    it('identifies topics with no semantic neighbors', async () => {
      // Generate embeddings for all article titles
      const articleEmbeddings = await Promise.all(
        articles.map(async (a) => ({
          slug: a.slug,
          title: a.title,
          embedding: await generateEmbedding(a.title + ' ' + a.excerpt),
        }))
      )

      // Test a few gap queries semantically
      const gapTests = [
        'zwift racing tactics and strategy',
        'nutrition and fueling for cyclists',
        'heat adaptation protocol',
      ]

      console.log('\n🔬 SEMANTIC GAP ANALYSIS:')

      for (const query of gapTests) {
        const queryEmbedding = await generateEmbedding(query)

        // Find closest article
        let maxSimilarity = 0
        let closestArticle = ''

        articleEmbeddings.forEach((ae) => {
          const sim = cosineSimilarity(queryEmbedding, ae.embedding)
          if (sim > maxSimilarity) {
            maxSimilarity = sim
            closestArticle = ae.title
          }
        })

        const status = maxSimilarity >= 0.5 ? '✅' : maxSimilarity >= 0.4 ? '⚠️' : '❌'
        console.log(`  ${status} "${query}"`)
        console.log(`     Closest: "${closestArticle}" (${(maxSimilarity * 100).toFixed(1)}%)`)
      }
    })
  })
})

describe('Phase 2 Readiness Check', () => {
  it('documents current state before Zwift content addition', () => {
    console.log('\n📋 PRE-PHASE 2 STATE:')
    console.log(`  Current Article Count: ${articles.length}`)

    const categories = ['fundamentals', 'metrics', 'concepts', 'app-guide'] as const
    categories.forEach((cat) => {
      const count = getArticlesByCategory(cat).length
      console.log(`  ${cat}: ${count} articles`)
    })

    // Check for any existing Zwift mentions
    const zwiftMentions = articles.filter(
      (a) => a.content.toLowerCase().includes('zwift') || a.content.toLowerCase().includes('virtual')
    )
    console.log(`\n  Articles mentioning Zwift/Virtual: ${zwiftMentions.length}`)
    zwiftMentions.forEach((a) => console.log(`    - ${a.title}`))

    console.log('\n📅 Phase 2 will add:')
    console.log('  - Zwift Race Tactics')
    console.log('  - Virtual vs Outdoor Pacing')
    console.log('  - E-Racing Strategy')
    console.log('  - Zwift Power Dynamics')
  })
})
