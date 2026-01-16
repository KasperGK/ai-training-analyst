/**
 * Auto-seed Wiki Articles
 *
 * Ensures wiki articles are indexed in the vector database.
 * Called lazily on first RAG usage to avoid startup delays.
 */

import { articles } from '@/lib/wiki/articles'
import { chunkWikiArticle } from './chunker'
import { generateEmbeddings, getProviderInfo } from './embeddings'
import { storeWikiChunks, getWikiChunkCount, clearWikiChunks } from './vector-store'

// Track seeding state to avoid concurrent seeds
let seedingPromise: Promise<boolean> | null = null
let lastSeedCheck = 0
const SEED_CHECK_INTERVAL = 60 * 1000 // Check at most once per minute

/**
 * Ensure wiki is seeded. Safe to call multiple times.
 * Returns true if wiki is ready (already seeded or just seeded).
 */
export async function ensureWikiSeeded(): Promise<boolean> {
  // Debounce checks to avoid hammering the database
  const now = Date.now()
  if (now - lastSeedCheck < SEED_CHECK_INTERVAL) {
    return true // Assume seeded if recently checked
  }
  lastSeedCheck = now

  // If already seeding, wait for that to complete
  if (seedingPromise) {
    return seedingPromise
  }

  try {
    const chunkCount = await getWikiChunkCount()

    // Calculate expected minimum chunks (rough estimate: ~5-8 chunks per article)
    const expectedMinChunks = articles.length * 5

    if (chunkCount >= expectedMinChunks) {
      console.log(`[Auto-seed] Wiki already seeded: ${chunkCount} chunks`)
      return true
    }

    // Need to seed - check if partial or empty
    if (chunkCount > 0 && chunkCount < expectedMinChunks) {
      console.log(`[Auto-seed] Partial seed detected (${chunkCount} chunks, expected ~${expectedMinChunks}). Re-seeding...`)
      seedingPromise = seedWiki(true) // Force re-seed
    } else {
      console.log(`[Auto-seed] Wiki not seeded. Seeding ${articles.length} articles...`)
      seedingPromise = seedWiki(false)
    }

    const result = await seedingPromise
    seedingPromise = null
    return result
  } catch (error) {
    console.error('[Auto-seed] Error checking seed status:', error)
    seedingPromise = null
    return false
  }
}

/**
 * Seed all wiki articles into the vector database
 */
async function seedWiki(force: boolean): Promise<boolean> {
  try {
    // Clear existing if force
    if (force) {
      console.log('[Auto-seed] Clearing existing wiki chunks...')
      await clearWikiChunks()
    }

    // Chunk all articles
    const allChunks: Array<{
      articleSlug: string
      chunkIndex: number
      title: string
      content: string
    }> = []

    for (const article of articles) {
      const chunks = chunkWikiArticle(article.title, article.content, {
        maxChunkSize: 1000,
        overlap: 100,
      })

      for (const chunk of chunks) {
        allChunks.push({
          articleSlug: article.slug,
          chunkIndex: chunk.index,
          title: article.title,
          content: chunk.content,
        })
      }
    }

    console.log(`[Auto-seed] Generated ${allChunks.length} chunks, generating embeddings...`)

    // Generate embeddings for all chunks
    const contents = allChunks.map((c) => c.content)
    const embeddings = await generateEmbeddings(contents)

    // Combine chunks with embeddings
    const chunksWithEmbeddings = allChunks.map((chunk, i) => ({
      ...chunk,
      embedding: embeddings[i],
    }))

    // Store in database
    const success = await storeWikiChunks(chunksWithEmbeddings)

    if (!success) {
      console.error('[Auto-seed] Failed to store wiki chunks')
      return false
    }

    const providerInfo = getProviderInfo()
    console.log(`[Auto-seed] Successfully seeded ${chunksWithEmbeddings.length} wiki chunks using ${providerInfo.provider}`)

    return true
  } catch (error) {
    console.error('[Auto-seed] Error seeding wiki:', error)
    return false
  }
}
