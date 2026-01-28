/**
 * RAG Governance Tests
 *
 * Validates that governance metadata is properly propagated
 * from wiki articles through to search results for AI transparency.
 */

import { describe, it, expect } from 'vitest'
import {
  articles,
  getArticleBySlug,
  type WikiArticle,
  type ConfidenceLevel,
} from '@/lib/wiki/articles'
import { allArticleSlugs } from './__fixtures__/golden-queries'

describe('Governance Metadata', () => {
  describe('Article Confidence Levels', () => {
    const validConfidenceLevels: ConfidenceLevel[] = [
      'established',
      'strong_evidence',
      'emerging',
      'debated',
    ]

    it('all articles have valid confidence levels', () => {
      articles.forEach((article) => {
        expect(validConfidenceLevels).toContain(article.confidenceLevel)
      })
    })

    it('has articles at multiple confidence levels', () => {
      const levels = new Set(articles.map((a) => a.confidenceLevel))

      // Should have at least 2 different confidence levels
      expect(levels.size).toBeGreaterThanOrEqual(2)
    })

    it('established articles have strong source backing', () => {
      const establishedArticles = articles.filter((a) => a.confidenceLevel === 'established')

      establishedArticles.forEach((article) => {
        expect(article.sources.length).toBeGreaterThanOrEqual(2)
      })
    })

    it('debated articles include knownDebates', () => {
      const debatedArticles = articles.filter((a) => a.confidenceLevel === 'debated')

      debatedArticles.forEach((article) => {
        expect(article.knownDebates).toBeDefined()
        expect(article.knownDebates!.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Article Status', () => {
    it('all articles have valid status', () => {
      const validStatuses = ['active', 'under_review', 'deprecated']

      articles.forEach((article) => {
        expect(validStatuses).toContain(article.status)
      })
    })

    it('most articles are active', () => {
      const activeCount = articles.filter((a) => a.status === 'active').length
      const activePercentage = (activeCount / articles.length) * 100

      expect(activePercentage).toBeGreaterThanOrEqual(90)
    })
  })

  describe('Source Quality', () => {
    const validSourceTypes = ['peer_reviewed', 'textbook', 'industry', 'meta_analysis']

    it('all articles have at least one source', () => {
      articles.forEach((article) => {
        expect(article.sources.length).toBeGreaterThan(0)
      })
    })

    it('all sources have valid types', () => {
      articles.forEach((article) => {
        article.sources.forEach((source) => {
          expect(validSourceTypes).toContain(source.type)
        })
      })
    })

    it('all sources have required fields', () => {
      articles.forEach((article) => {
        article.sources.forEach((source) => {
          expect(source.title).toBeDefined()
          expect(source.title.length).toBeGreaterThan(0)
          expect(source.url).toBeDefined()
          expect(source.url).toMatch(/^https?:\/\//)
          expect(source.type).toBeDefined()
        })
      })
    })

    it('many articles have peer-reviewed sources', () => {
      const articlesWithPeerReviewed = articles.filter((a) =>
        a.sources.some((s) => s.type === 'peer_reviewed')
      ).length

      const percentage = (articlesWithPeerReviewed / articles.length) * 100
      // Target: at least 40% have peer-reviewed sources
      // Many training articles legitimately cite industry sources (TrainingPeaks, TrainerRoad)
      expect(percentage).toBeGreaterThanOrEqual(40)
    })
  })

  describe('Last Verified Dates', () => {
    it('all articles have lastVerified dates', () => {
      articles.forEach((article) => {
        expect(article.lastVerified).toBeDefined()
        expect(article.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      })
    })

    it('lastVerified dates are within reasonable range', () => {
      // Articles should be verified within the last 2 years
      const twoYearsAgo = new Date()
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)

      articles.forEach((article) => {
        const verifiedDate = new Date(article.lastVerified)
        expect(verifiedDate.getTime()).toBeGreaterThan(twoYearsAgo.getTime())
      })
    })
  })

  describe('Consensus Notes', () => {
    it('articles with nuanced positions have consensusNote', () => {
      // Strong_evidence and debated should have consensus notes
      const nuancedArticles = articles.filter(
        (a) => a.confidenceLevel === 'strong_evidence' || a.confidenceLevel === 'debated'
      )

      const withConsensusNote = nuancedArticles.filter((a) => a.consensusNote !== undefined)
      const percentage = (withConsensusNote.length / nuancedArticles.length) * 100

      // At least 50% should have consensus notes
      expect(percentage).toBeGreaterThanOrEqual(50)
    })

    it('consensusNote is meaningful when present', () => {
      articles.forEach((article) => {
        if (article.consensusNote) {
          expect(article.consensusNote.length).toBeGreaterThan(20)
        }
      })
    })
  })

  describe('Known Debates', () => {
    it('knownDebates have required structure', () => {
      articles.forEach((article) => {
        if (article.knownDebates) {
          article.knownDebates.forEach((debate) => {
            expect(debate.topic).toBeDefined()
            expect(debate.topic.length).toBeGreaterThan(5)
            expect(debate.positions).toBeDefined()
            expect(debate.positions.length).toBeGreaterThanOrEqual(2)
            expect(debate.recommendation).toBeDefined()
            expect(debate.recommendation.length).toBeGreaterThan(10)
          })
        }
      })
    })

    it('positions represent different viewpoints', () => {
      articles.forEach((article) => {
        if (article.knownDebates) {
          article.knownDebates.forEach((debate) => {
            // Positions should be distinct
            const uniquePositions = new Set(debate.positions)
            expect(uniquePositions.size).toBe(debate.positions.length)
          })
        }
      })
    })
  })

  describe('Article Versioning', () => {
    it('all articles have version numbers', () => {
      articles.forEach((article) => {
        expect(article.version).toBeDefined()
        expect(article.version).toBeGreaterThanOrEqual(1)
      })
    })
  })

  describe('Content Quality', () => {
    it('all articles have meaningful content', () => {
      articles.forEach((article) => {
        expect(article.content.length).toBeGreaterThan(500)
        expect(article.excerpt.length).toBeGreaterThan(50)
        expect(article.excerpt.length).toBeLessThan(300)
      })
    })

    it('all articles have key takeaways', () => {
      articles.forEach((article) => {
        expect(article.keyTakeaways.length).toBeGreaterThanOrEqual(3)
        article.keyTakeaways.forEach((takeaway) => {
          expect(takeaway.length).toBeGreaterThan(10)
        })
      })
    })

    it('all articles have reading time estimates', () => {
      articles.forEach((article) => {
        expect(article.readingTime).toBeGreaterThanOrEqual(3)
        expect(article.readingTime).toBeLessThanOrEqual(15)
      })
    })
  })

  describe('Category Distribution', () => {
    it('has articles in all categories', () => {
      const categories = new Set(articles.map((a) => a.category))

      expect(categories.has('fundamentals')).toBe(true)
      expect(categories.has('metrics')).toBe(true)
      expect(categories.has('concepts')).toBe(true)
    })

    it('has reasonable distribution across categories', () => {
      const fundamentals = articles.filter((a) => a.category === 'fundamentals').length
      const metrics = articles.filter((a) => a.category === 'metrics').length
      const concepts = articles.filter((a) => a.category === 'concepts').length

      // Each category should have at least 2 articles
      expect(fundamentals).toBeGreaterThanOrEqual(2)
      expect(metrics).toBeGreaterThanOrEqual(2)
      expect(concepts).toBeGreaterThanOrEqual(2)
    })
  })
})

describe('Governance Metadata Propagation', () => {
  describe('getArticleBySlug', () => {
    it('returns article with all governance fields', () => {
      const article = getArticleBySlug('what-is-ftp')

      expect(article).toBeDefined()
      expect(article?.confidenceLevel).toBeDefined()
      expect(article?.status).toBeDefined()
      expect(article?.lastVerified).toBeDefined()
      expect(article?.sources).toBeDefined()
      expect(article?.version).toBeDefined()
    })

    it('returns undefined for non-existent slug', () => {
      const article = getArticleBySlug('non-existent-article')
      expect(article).toBeUndefined()
    })
  })

  describe('Search Result Enrichment', () => {
    // Mock structure representing enriched search results
    interface EnrichedChunk {
      article_slug: string
      confidenceLevel?: ConfidenceLevel
      consensusNote?: string
      sourceCount?: number
      lastVerified?: string
    }

    it('can enrich chunk with governance metadata', () => {
      const slug = 'sweet-spot-training'
      const article = getArticleBySlug(slug)

      const enrichedChunk: EnrichedChunk = {
        article_slug: slug,
        confidenceLevel: article?.confidenceLevel,
        consensusNote: article?.consensusNote,
        sourceCount: article?.sources.length,
        lastVerified: article?.lastVerified,
      }

      expect(enrichedChunk.confidenceLevel).toBe('debated')
      expect(enrichedChunk.consensusNote).toBeDefined()
      expect(enrichedChunk.sourceCount).toBeGreaterThan(0)
    })

    it('all test articles can be enriched', () => {
      allArticleSlugs.forEach((slug) => {
        const article = getArticleBySlug(slug)

        expect(article).toBeDefined()

        const enrichedChunk: EnrichedChunk = {
          article_slug: slug,
          confidenceLevel: article?.confidenceLevel,
          consensusNote: article?.consensusNote,
          sourceCount: article?.sources.length,
          lastVerified: article?.lastVerified,
        }

        expect(enrichedChunk.confidenceLevel).toBeDefined()
        expect(enrichedChunk.sourceCount).toBeGreaterThan(0)
        expect(enrichedChunk.lastVerified).toBeDefined()
      })
    })
  })
})

describe('Governance Statistics', () => {
  it('logs governance summary', () => {
    const stats = {
      total: articles.length,
      byConfidence: {
        established: articles.filter((a) => a.confidenceLevel === 'established').length,
        strong_evidence: articles.filter((a) => a.confidenceLevel === 'strong_evidence').length,
        emerging: articles.filter((a) => a.confidenceLevel === 'emerging').length,
        debated: articles.filter((a) => a.confidenceLevel === 'debated').length,
      },
      byCategory: {
        fundamentals: articles.filter((a) => a.category === 'fundamentals').length,
        metrics: articles.filter((a) => a.category === 'metrics').length,
        concepts: articles.filter((a) => a.category === 'concepts').length,
        'app-guide': articles.filter((a) => a.category === 'app-guide').length,
      },
      totalSources: articles.reduce((sum, a) => sum + a.sources.length, 0),
      avgSourcesPerArticle: 0,
      withConsensusNotes: articles.filter((a) => a.consensusNote).length,
      withDebates: articles.filter((a) => a.knownDebates && a.knownDebates.length > 0).length,
    }

    stats.avgSourcesPerArticle = Math.round((stats.totalSources / stats.total) * 10) / 10

    console.log('\n📊 GOVERNANCE STATISTICS:')
    console.log(`Total Articles: ${stats.total}`)
    console.log('\nBy Confidence Level:')
    console.log(`  - Established: ${stats.byConfidence.established}`)
    console.log(`  - Strong Evidence: ${stats.byConfidence.strong_evidence}`)
    console.log(`  - Emerging: ${stats.byConfidence.emerging}`)
    console.log(`  - Debated: ${stats.byConfidence.debated}`)
    console.log('\nBy Category:')
    console.log(`  - Fundamentals: ${stats.byCategory.fundamentals}`)
    console.log(`  - Metrics: ${stats.byCategory.metrics}`)
    console.log(`  - Concepts: ${stats.byCategory.concepts}`)
    console.log(`  - App Guide: ${stats.byCategory['app-guide']}`)
    console.log('\nSource Quality:')
    console.log(`  - Total Sources: ${stats.totalSources}`)
    console.log(`  - Avg per Article: ${stats.avgSourcesPerArticle}`)
    console.log(`  - With Consensus Notes: ${stats.withConsensusNotes}`)
    console.log(`  - With Known Debates: ${stats.withDebates}`)

    // Verify minimums
    expect(stats.total).toBeGreaterThanOrEqual(15)
    expect(stats.avgSourcesPerArticle).toBeGreaterThanOrEqual(1.5)
  })
})
