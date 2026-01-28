/**
 * RAG Embeddings Tests
 *
 * Validates embedding generation and similarity calculations.
 * Uses the local all-MiniLM-L6-v2 model (384 dimensions).
 */

import { describe, it, expect, beforeAll } from 'vitest'
import {
  generateEmbedding,
  generateEmbeddings,
  cosineSimilarity,
  EMBEDDING_DIMENSIONS,
  getProviderInfo,
} from '@/lib/rag/embeddings'

describe('Embeddings', () => {
  describe('Configuration', () => {
    it('uses expected embedding dimensions', () => {
      // Local model: 384, Voyage: 1024
      expect([384, 1024]).toContain(EMBEDDING_DIMENSIONS)
    })

    it('returns valid provider info', () => {
      const info = getProviderInfo()

      expect(info).toHaveProperty('provider')
      expect(info).toHaveProperty('dimensions')
      expect(info).toHaveProperty('model')
      expect(['local', 'voyage']).toContain(info.provider)
      expect(info.dimensions).toBe(EMBEDDING_DIMENSIONS)
    })
  })

  describe('Single Embedding Generation', () => {
    it('generates correct dimensional vectors', async () => {
      const embedding = await generateEmbedding('FTP training for cyclists')

      expect(embedding).toBeInstanceOf(Array)
      expect(embedding.length).toBe(EMBEDDING_DIMENSIONS)
    })

    it('generates normalized vectors (L2 norm approximately 1)', async () => {
      const embedding = await generateEmbedding('threshold interval training')

      // Calculate L2 norm
      const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))

      // Should be very close to 1 (normalized)
      expect(norm).toBeCloseTo(1.0, 2)
    })

    it('generates consistent embeddings for same text', async () => {
      const text = 'zone 2 endurance training'
      const embedding1 = await generateEmbedding(text)
      const embedding2 = await generateEmbedding(text)

      // Should be identical (deterministic)
      const similarity = cosineSimilarity(embedding1, embedding2)
      expect(similarity).toBeCloseTo(1.0, 5)
    })

    it('handles empty string gracefully', async () => {
      const embedding = await generateEmbedding('')

      expect(embedding).toBeInstanceOf(Array)
      expect(embedding.length).toBe(EMBEDDING_DIMENSIONS)
    })

    it('handles long text without error', async () => {
      const longText = 'Training science concepts. '.repeat(100)
      const embedding = await generateEmbedding(longText)

      expect(embedding).toBeInstanceOf(Array)
      expect(embedding.length).toBe(EMBEDDING_DIMENSIONS)
    })
  })

  describe('Batch Embedding Generation', () => {
    it('generates embeddings for multiple texts', async () => {
      const texts = ['FTP test', 'TSS calculation', 'recovery week']
      const embeddings = await generateEmbeddings(texts)

      expect(embeddings.length).toBe(texts.length)
      embeddings.forEach((embedding) => {
        expect(embedding.length).toBe(EMBEDDING_DIMENSIONS)
      })
    })

    it('returns empty array for empty input', async () => {
      const embeddings = await generateEmbeddings([])
      expect(embeddings).toEqual([])
    })

    it('maintains order of embeddings', async () => {
      const texts = ['FTP', 'TSS', 'CTL']
      const embeddings = await generateEmbeddings(texts)
      const individualEmbeddings = await Promise.all(texts.map((t) => generateEmbedding(t)))

      // Each batch embedding should match individual embedding
      for (let i = 0; i < texts.length; i++) {
        const similarity = cosineSimilarity(embeddings[i], individualEmbeddings[i])
        expect(similarity).toBeCloseTo(1.0, 5)
      }
    })
  })

  describe('Cosine Similarity', () => {
    it('returns 1.0 for identical vectors', () => {
      const vec = [0.5, 0.5, 0.5, 0.5]
      expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0, 5)
    })

    it('returns 0 for orthogonal vectors', () => {
      const vec1 = [1, 0, 0, 0]
      const vec2 = [0, 1, 0, 0]
      expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(0, 5)
    })

    it('returns -1 for opposite vectors', () => {
      const vec1 = [1, 0, 0, 0]
      const vec2 = [-1, 0, 0, 0]
      expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(-1, 5)
    })

    it('throws error for mismatched dimensions', () => {
      const vec1 = [1, 0, 0]
      const vec2 = [1, 0]
      expect(() => cosineSimilarity(vec1, vec2)).toThrow('same dimensions')
    })

    it('handles normalized vectors correctly', () => {
      // Normalize vectors
      const normalize = (v: number[]) => {
        const norm = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0))
        return v.map((x) => x / norm)
      }

      const vec1 = normalize([3, 4, 0, 0])
      const vec2 = normalize([4, 3, 0, 0])

      // cos(θ) = (3*4 + 4*3) / (5 * 5) = 24/25 = 0.96
      expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(0.96, 2)
    })
  })

  describe('Semantic Similarity', () => {
    it('similar concepts have higher similarity than unrelated concepts', async () => {
      const ftpQuery = await generateEmbedding('FTP functional threshold power')
      const thresholdArticle = await generateEmbedding('threshold training for cyclists')
      const marathonUnrelated = await generateEmbedding('marathon running shoes')

      const relatedSimilarity = cosineSimilarity(ftpQuery, thresholdArticle)
      const unrelatedSimilarity = cosineSimilarity(ftpQuery, marathonUnrelated)

      expect(relatedSimilarity).toBeGreaterThan(unrelatedSimilarity)
    })

    it('cycling concepts cluster together', async () => {
      const ftpEmbed = await generateEmbedding('FTP cycling power')
      const tssEmbed = await generateEmbedding('TSS training stress score')
      const ctlEmbed = await generateEmbedding('CTL chronic training load')
      const cookingEmbed = await generateEmbedding('pasta recipe cooking dinner')

      // All cycling metrics should be more similar to each other
      const ftpTssSim = cosineSimilarity(ftpEmbed, tssEmbed)
      const ftpCtlSim = cosineSimilarity(ftpEmbed, ctlEmbed)
      const ftpCookingSim = cosineSimilarity(ftpEmbed, cookingEmbed)

      expect(ftpTssSim).toBeGreaterThan(ftpCookingSim)
      expect(ftpCtlSim).toBeGreaterThan(ftpCookingSim)
    })

    it('synonyms have high similarity', async () => {
      const embed1 = await generateEmbedding('recovery rest day')
      const embed2 = await generateEmbedding('recuperation off day')

      const similarity = cosineSimilarity(embed1, embed2)
      // Local model (all-MiniLM-L6-v2) may have lower similarity for synonyms
      expect(similarity).toBeGreaterThan(0.4) // Synonyms should be similar
    })

    it('questions and statements about same topic are similar', async () => {
      const question = await generateEmbedding('What is normalized power?')
      const statement = await generateEmbedding(
        'Normalized power is a metric that accounts for variability in cycling efforts'
      )

      const similarity = cosineSimilarity(question, statement)
      expect(similarity).toBeGreaterThan(0.4) // Should match above threshold
    })
  })

  describe('Edge Cases', () => {
    it('handles special characters', async () => {
      const embedding = await generateEmbedding('FTP @ 300W, HR: 150bpm (zone 4)')

      expect(embedding.length).toBe(EMBEDDING_DIMENSIONS)
    })

    it('handles numbers and units', async () => {
      const embedding = await generateEmbedding('2x20 minute intervals at 95% FTP')

      expect(embedding.length).toBe(EMBEDDING_DIMENSIONS)
    })

    it('handles unicode characters', async () => {
      const embedding = await generateEmbedding('VO₂max training 80% FTP → 90% FTP')

      expect(embedding.length).toBe(EMBEDDING_DIMENSIONS)
    })

    it('handles mixed case consistently', async () => {
      const lower = await generateEmbedding('ftp training')
      const upper = await generateEmbedding('FTP TRAINING')
      const mixed = await generateEmbedding('FTP Training')

      // Case variations should have high similarity
      const lowerUpperSim = cosineSimilarity(lower, upper)
      const lowerMixedSim = cosineSimilarity(lower, mixed)

      expect(lowerUpperSim).toBeGreaterThan(0.9)
      expect(lowerMixedSim).toBeGreaterThan(0.9)
    })
  })
})
