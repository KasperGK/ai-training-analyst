/**
 * RAG Search API
 *
 * POST /api/rag/search - Search wiki and session history
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchWiki, searchSessions } from '@/lib/rag/vector-store'

/**
 * POST /api/rag/search - Search knowledge base
 *
 * Body:
 * - query: string (required)
 * - sources: string[] (optional) - ['wiki', 'sessions']
 * - matchCount: number (optional, default 5)
 * - matchThreshold: number (optional, default 0.7)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      query,
      sources = ['wiki'],
      matchCount = 5,
      matchThreshold = 0.4,
    } = body

    if (!query) {
      return NextResponse.json(
        { error: 'Missing required field: query' },
        { status: 400 }
      )
    }

    const results: {
      wiki?: Array<{ slug: string; title: string; content: string; similarity: number }>
      sessions?: Array<{ sessionId: string; summary: string; similarity: number }>
    } = {}

    // Search wiki if requested
    if (sources.includes('wiki')) {
      const wikiResults = await searchWiki(query, { matchCount, matchThreshold })
      results.wiki = wikiResults.map((r) => ({
        slug: r.article_slug,
        title: r.title,
        content: r.content,
        similarity: r.similarity || 0,
      }))
    }

    // Search sessions if requested (requires auth)
    if (sources.includes('sessions')) {
      const supabase = await createClient()
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const sessionResults = await searchSessions(query, user.id, {
            matchCount,
            matchThreshold,
          })
          results.sessions = sessionResults.map((r) => ({
            sessionId: r.session_id,
            summary: r.summary,
            similarity: r.similarity || 0,
          }))
        }
      }
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error('[RAG Search] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    )
  }
}
