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
import { buildTools, type ToolContext } from './tools'
import { parseAthleteContext } from './tools/types'

export const maxDuration = 30

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

  // Use Opus for: training plan generation, deep analysis requests
  const opusPatterns = [
    'generate.*plan',
    'create.*plan',
    'build.*training',
    'analyze.*season',
    'periodiz',
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
        console.log('[chat] Overriding frontend athleteId with Supabase user.id:', user.id, '(frontend sent:', athleteId, ')')
      }
    }
  }
  // Fall back to frontend-provided athleteId only if auth unavailable
  if (!effectiveAthleteId && athleteId) {
    effectiveAthleteId = athleteId
    console.log('[chat] Using frontend-provided athleteId (auth unavailable):', effectiveAthleteId)
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
      console.log('[chat] Enriched context from intervals.icu:', enrichedContext.athlete)
    } catch (error) {
      console.error('[chat] Failed to fetch athlete from intervals.icu:', error)
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
      console.error('Failed to pre-fetch insights:', e)
    }
  }

  // Canvas mode: Add showOnCanvas tool instructions
  if (canvasMode) {
    const canvasInstructions = `## Canvas Mode (MANDATORY)

You are on the AI Coach page with a canvas. When users ask to see data, you MUST use the showOnCanvas tool.

### MANDATORY: Call showOnCanvas First
When the user asks to "show", "display", or "see" ANY data visualization:
1. FIRST call the showOnCanvas tool
2. THEN provide your text response explaining the data

**You MUST call showOnCanvas** for requests like:
- "show my fitness" → call showOnCanvas with type: "fitness"
- "show my form" → call showOnCanvas with type: "fitness"
- "show PMC" → call showOnCanvas with type: "pmc-chart"
- "show power curve" → call showOnCanvas with type: "power-curve"
- "show recent sessions" → call showOnCanvas with type: "sessions"

### Widget Types
- \`fitness\` - CTL, ATL, TSB metrics (use for "fitness", "form", "TSB" requests)
- \`pmc-chart\` - Performance Management Chart
- \`sessions\` - Recent training sessions
- \`power-curve\` - Power duration curve
- \`sleep\` - Sleep metrics
- \`workout-card\` - Structured workout

### Required Fields
Every showOnCanvas call needs:
1. \`action\`: Usually "show" (replaces canvas)
2. \`widgets\`: Array with type and insight
3. \`reason\`: Why you're showing this

### Insight Examples
The "insight" field must explain what matters about the data:
- BAD: "Showing your fitness data"
- GOOD: "CTL 72, TSB -15: You're building fitness but need recovery before intensity"

### Example Tool Call
User: "Show my fitness"
→ IMMEDIATELY call showOnCanvas:
\`\`\`
{
  "action": "show",
  "widgets": [{ "type": "fitness", "insight": "CTL 72 shows strong base. TSB -15 means moderate fatigue - good for tempo work." }],
  "reason": "Displaying fitness metrics per user request"
}
\`\`\`

### Critical Rule
DO NOT just describe data in text when asked to "show" something. The user wants to SEE the widget. Call showOnCanvas first, then explain.`

    systemPrompt = `${systemPrompt}\n\n${canvasInstructions}`
  }

  // Convert UI messages (with parts) to API messages (with content)
  const convertedMessages = (messages as UIMessage[]).map(msg => ({
    role: msg.role,
    content: msg.content || msg.parts?.filter(p => p.type === 'text').map(p => p.text).join('') || '',
  }))

  // Ensure wiki is seeded for RAG (lazy initialization, runs in background)
  if (features.rag) {
    ensureWikiSeeded().catch(err => {
      console.error('[chat] Auto-seed error:', err)
    })
  }

  // Build tool context
  const toolContext: ToolContext = {
    athleteId: effectiveAthleteId,
    athleteContext: effectiveAthleteContext,
    intervalsConnected,
    intervalsClient,
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
    stopWhen: stepCountIs(5), // Allow up to 5 tool call + response cycles
    tools,
  })

  return result.toUIMessageStreamResponse()
}
