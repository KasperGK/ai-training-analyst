import { anthropic } from '@ai-sdk/anthropic'
import { streamText, stepCountIs } from 'ai'
import { cookies } from 'next/headers'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'
import { intervalsClient } from '@/lib/intervals-icu'
import { getPersonalizationSection } from '@/lib/personalization/prompt-builder'
import { getInsights } from '@/lib/insights/insight-generator'
import { ensureWikiSeeded } from '@/lib/rag/auto-seed'
import { features } from '@/lib/features'
import { createClient } from '@/lib/supabase/server'
import { hasZwiftPowerData } from '@/lib/db/race-results'
import { buildTools, type ToolContext } from './tools'
import { parseAthleteContext } from './tools/types'
import { getConversationSummary } from '@/lib/chat/conversation-manager'
import { logger } from '@/lib/logger'

export const maxDuration = 45

interface Message {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Determine if request needs Opus (complex analysis) vs Sonnet (routine queries).
 * Use Opus 4.5 for: training plan generation, deep analysis, periodization.
 * Use Sonnet 4 for: everything else (80% of requests).
 */
function shouldUseOpus(messages: Message[]): boolean {
  const lastUserMessage = messages.filter(m => m.role === 'user').pop()
  if (!lastUserMessage) return false

  const content = typeof lastUserMessage.content === 'string'
    ? lastUserMessage.content.toLowerCase()
    : ''

  // Use Opus for: training plan generation, deep analysis, comparisons, patterns
  const opusPatterns = [
    'generate.*plan',
    'create.*plan',
    'build.*training',
    'analyze.*season',
    'periodiz',
    'compare.*workout',
    'compare.*session',
    'compare.*race',
    'pattern',
    'what.*see.*in.*training',
    'deep.*analy',
    'race.*season',
    'how.*races.*going',
  ]
  return opusPatterns.some(p => new RegExp(p).test(content))
}

interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  parts?: { type: string; text: string }[]
  content?: string
}

export async function POST(req: Request): Promise<Response> {
  const { messages, athleteContext, athleteId, canvasMode } = await req.json()

  // ALWAYS get Supabase user.id from auth for database queries
  // The frontend might send an intervals.icu athlete ID which won't work for local DB queries
  // Sessions are stored with Supabase user.id as athlete_id
  let effectiveAthleteId: string | undefined
  const supabase = await createClient()
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.id) {
      effectiveAthleteId = user.id
      if (athleteId && athleteId !== user.id) {
        logger.info('[chat] Overriding frontend athleteId with Supabase user.id:', user.id, '(frontend sent:', athleteId, ')')
      }
    }
  }
  // Fall back to frontend-provided athleteId only if auth unavailable
  if (!effectiveAthleteId && athleteId) {
    effectiveAthleteId = athleteId
    logger.info('[chat] Using frontend-provided athleteId (auth unavailable):', effectiveAthleteId)
  }

  // Get intervals.icu credentials (same pattern as /api/intervals/data)
  const cookieStore = await cookies()
  let accessToken = cookieStore.get('intervals_access_token')?.value
  let intervalsAthleteId = cookieStore.get('intervals_athlete_id')?.value

  // Fallback to env vars
  if (!accessToken || !intervalsAthleteId) {
    accessToken = process.env.INTERVALS_ICU_API_KEY
    intervalsAthleteId = process.env.INTERVALS_ICU_ATHLETE_ID
  }

  // Set credentials if available
  const intervalsConnected = !!(accessToken && intervalsAthleteId)
  if (intervalsConnected) {
    intervalsClient.setCredentials(accessToken!, intervalsAthleteId!)
  }

  // If athlete data is missing from frontend context, fetch from intervals.icu
  let effectiveAthleteContext = athleteContext
  const parsedContext = parseAthleteContext(athleteContext)

  if (intervalsConnected && !parsedContext.athlete?.ftp) {
    try {
      const athlete = await intervalsClient.getAthlete()
      const cycling = athlete.sportSettings?.find((s: { type?: string }) => s.type === 'Bike') || athlete.sportSettings?.[0]

      const enrichedContext = {
        ...parsedContext,
        athlete: {
          ...parsedContext.athlete,
          ftp: cycling?.ftp ?? null,
          max_hr: cycling?.max_hr ?? null,
          lthr: cycling?.lthr ?? null,
          weight_kg: athlete.icu_weight ?? athlete.weight ?? null,
          resting_hr: athlete.icu_resting_hr ?? null,
          name: athlete.name ?? null,
        }
      }
      effectiveAthleteContext = JSON.stringify(enrichedContext, null, 2)
      logger.info('[chat] Enriched context from intervals.icu:', enrichedContext.athlete)
    } catch (error) {
      logger.error('[chat] Failed to fetch athlete from intervals.icu:', error)
    }
  }

  // Build system prompt with athlete context
  let systemPrompt = buildSystemPrompt(effectiveAthleteContext)

  // Add personalization section if memory feature is enabled
  if (features.memory && effectiveAthleteId) {
    const personalization = await getPersonalizationSection(effectiveAthleteId)
    if (personalization) {
      systemPrompt = `${systemPrompt}\n\n${personalization}\n\nUse the getAthleteMemory and saveAthleteMemory tools to retrieve and store information about this athlete.`
    }
  }

  // Inject active insights at conversation start
  if (features.insights && effectiveAthleteId) {
    try {
      const activeInsights = await getInsights(effectiveAthleteId, { limit: 5, includeRead: false })
      if (activeInsights.length > 0) {
        // Format insights for system prompt
        const insightLines = activeInsights.map(insight => {
          const priorityEmoji = insight.priority === 'urgent' ? '🚨' :
            insight.priority === 'high' ? '⚠️' :
            insight.priority === 'medium' ? '📊' : 'ℹ️'
          return `${priorityEmoji} [${insight.priority.toUpperCase()}] ${insight.title}: ${insight.content}`
        })

        const insightsSection = `## Active Insights (Pre-fetched)
The following insights are based on the athlete's recent training data. Lead with urgent/high priority insights when starting conversations:

${insightLines.join('\n')}

Note: These insights are already available - you don't need to call getActiveInsights unless the athlete asks for updated insights.`

        systemPrompt = `${systemPrompt}\n\n${insightsSection}`
      }
    } catch (e) {
      // Don't fail chat if insights fetch fails
      logger.error('[chat] Failed to pre-fetch insights:', e)
    }
  }

  // Inject conversation history summary for cross-conversation context
  if (effectiveAthleteId) {
    try {
      const conversationSummary = await getConversationSummary(effectiveAthleteId, 5)
      if (conversationSummary) {
        const historySection = `## Recent Conversation History

You have access to the athlete's full conversation history via the searchConversationHistory tool.
When the athlete references something from a past discussion, use this tool to find the context.

Recent conversation topics:
${conversationSummary}

If the athlete asks about previous discussions or you need context from past conversations, use the searchConversationHistory tool to search for relevant messages.`

        systemPrompt = `${systemPrompt}\n\n${historySection}`
      }
    } catch (e) {
      logger.error('[chat] Failed to fetch conversation summary:', e)
    }
  }

  // Canvas mode: Add showOnCanvas behavioral rules (tool description covers schema/types)
  if (canvasMode) {
    const canvasInstructions = `## Canvas Mode

You have a canvas. When users ask to "show", "display", or "see" data:
1. Call showOnCanvas FIRST, then provide your text response
2. Use \`show\` for new context (replaces non-pinned widgets), \`add\` when user says "also show" or "add to"
3. The insight field must explain WHY something matters, not just WHAT is shown
4. "form" or "TSB" requests → type "fitness". "PMC" → type "pmc-chart"
5. Never describe data in text only — the user wants to SEE it on canvas`

    systemPrompt = `${systemPrompt}\n\n${canvasInstructions}`
  }

  // Convert UI messages (with parts) to API messages (with content)
  // Filter out messages with empty content (e.g. assistant messages with only tool-call parts)
  const convertedMessages = (messages as UIMessage[]).map(msg => ({
    role: msg.role,
    content: msg.content || msg.parts?.filter(p => p.type === 'text').map(p => p.text).join('') || '',
  })).filter(msg => msg.content.length > 0)

  // Ensure wiki is seeded for RAG (lazy initialization, runs in background)
  if (features.rag) {
    ensureWikiSeeded().catch(err => {
      logger.error('[chat] Auto-seed error:', err)
    })
  }

  // Check if athlete has ZwiftPower data
  const zwiftPowerConnected = effectiveAthleteId
    ? await hasZwiftPowerData(effectiveAthleteId)
    : false

  // Build tool context
  const toolContext: ToolContext = {
    athleteId: effectiveAthleteId,
    athleteContext: effectiveAthleteContext,
    intervalsConnected,
    intervalsClient,
    zwiftPowerConnected,
    flags: {
      useLocalData: features.localData,
      enableRag: features.rag,
      enableMemory: features.memory,
      enableInsights: features.insights,
    },
  }

  // Build tools with context
  const tools = buildTools(toolContext)

  // Use Opus for complex analysis, Sonnet for routine queries (80% cost savings)
  const useOpus = shouldUseOpus(convertedMessages)
  const model = useOpus
    ? anthropic('claude-opus-4-5-20251101')
    : anthropic('claude-sonnet-4-20250514')

  const result = streamText({
    model,
    system: systemPrompt,
    messages: convertedMessages,
    stopWhen: stepCountIs(8), // Allow up to 8 tool call + response cycles
    tools,
  })

  return result.toUIMessageStreamResponse()
}
