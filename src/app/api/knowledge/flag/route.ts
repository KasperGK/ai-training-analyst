import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createFlag, hasUserFlaggedArticle, type FlagType } from '@/lib/db/knowledge-flags'
import { getArticleBySlug } from '@/lib/wiki/articles'

const VALID_FLAG_TYPES: FlagType[] = ['inaccurate', 'outdated', 'misleading', 'needs_source']

/**
 * POST /api/knowledge/flag
 * Submit a content flag for a wiki article
 */
export async function POST(request: Request) {
  try {
    // Get Supabase client
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { articleSlug, flagType, description } = body

    // Validate required fields
    if (!articleSlug || typeof articleSlug !== 'string') {
      return NextResponse.json({ error: 'articleSlug is required' }, { status: 400 })
    }
    if (!flagType || !VALID_FLAG_TYPES.includes(flagType)) {
      return NextResponse.json(
        { error: `flagType must be one of: ${VALID_FLAG_TYPES.join(', ')}` },
        { status: 400 }
      )
    }
    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return NextResponse.json(
        { error: 'description is required (minimum 10 characters)' },
        { status: 400 }
      )
    }

    // Verify article exists
    const article = getArticleBySlug(articleSlug)
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // Check if user already has a pending flag for this article
    const alreadyFlagged = await hasUserFlaggedArticle(user.id, articleSlug)
    if (alreadyFlagged) {
      return NextResponse.json(
        { error: 'You already have a pending flag for this article' },
        { status: 409 }
      )
    }

    // Create the flag
    const flag = await createFlag(user.id, articleSlug, flagType, description.trim())
    if (!flag) {
      return NextResponse.json({ error: 'Failed to create flag' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      flagId: flag.id,
      message: 'Thank you for your feedback. We will review this content.',
    })
  } catch (error) {
    console.error('Error in POST /api/knowledge/flag:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
