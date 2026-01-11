/**
 * RAG Seed API
 *
 * POST /api/rag/seed - Embed and store all wiki articles
 * GET /api/rag/seed - Check seed status
 */

import { NextResponse } from 'next/server'
import { articles } from '@/lib/wiki/articles'
import { chunkWikiArticle } from '@/lib/rag/chunker'
import { generateEmbeddings, getProviderInfo } from '@/lib/rag/embeddings'
import { storeWikiChunks, clearWikiChunks, getWikiChunkCount } from '@/lib/rag/vector-store'

/**
 * GET /api/rag/seed - Check seed status
 */
export async function GET() {
  const chunkCount = await getWikiChunkCount()
  const providerInfo = getProviderInfo()

  return NextResponse.json({
    seeded: chunkCount > 0,
    chunkCount,
    articleCount: articles.length,
    provider: providerInfo,
  })
}

/**
 * POST /api/rag/seed - Embed and store all wiki articles
 *
 * Body:
 * - force: boolean (optional) - Clear existing chunks first
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { force = false } = body

    // Check if already seeded
    const existingCount = await getWikiChunkCount()
    if (existingCount > 0 && !force) {
      return NextResponse.json({
        success: true,
        message: 'Wiki already seeded. Use force=true to re-seed.',
        chunkCount: existingCount,
      })
    }

    // Clear existing if force
    if (force && existingCount > 0) {
      console.log('[RAG Seed] Clearing existing wiki chunks...')
      await clearWikiChunks()
    }

    console.log(`[RAG Seed] Processing ${articles.length} wiki articles...`)

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

    console.log(`[RAG Seed] Generated ${allChunks.length} chunks, generating embeddings...`)

    // Generate embeddings for all chunks
    const contents = allChunks.map((c) => c.content)
    const embeddings = await generateEmbeddings(contents)

    console.log(`[RAG Seed] Generated ${embeddings.length} embeddings, storing...`)

    // Combine chunks with embeddings
    const chunksWithEmbeddings = allChunks.map((chunk, i) => ({
      ...chunk,
      embedding: embeddings[i],
    }))

    // Store in database
    const success = await storeWikiChunks(chunksWithEmbeddings)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to store wiki chunks' },
        { status: 500 }
      )
    }

    const providerInfo = getProviderInfo()
    console.log(`[RAG Seed] Successfully seeded ${chunksWithEmbeddings.length} wiki chunks using ${providerInfo.provider}`)

    return NextResponse.json({
      success: true,
      articlesProcessed: articles.length,
      chunksStored: chunksWithEmbeddings.length,
      provider: providerInfo,
    })
  } catch (error) {
    console.error('[RAG Seed] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to seed wiki' },
      { status: 500 }
    )
  }
}
