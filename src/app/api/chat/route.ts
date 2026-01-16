import { anthropic } from '@ai-sdk/anthropic'
import { streamText, stepCountIs } from 'ai'
import { cookies } from 'next/headers'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'
import { intervalsClient } from '@/lib/intervals-icu'
import { getPersonalizationSection } from '@/lib/personalization/prompt-builder'
import { getInsights } from '@/lib/insights/insight-generator'
import { features } from '@/lib/features'
import { buildTools, type ToolContext } from './tools'
import { parseAthleteContext } from './tools/types'

export const maxDuration = 30

interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  parts?: { type: string; text: string }[]
  content?: string
}

export async function POST(req: Request): Promise<Response> {
  const { messages, athleteContext, athleteId, canvasMode } = await req.json()

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
  if (features.memory && athleteId) {
    const personalization = await getPersonalizationSection(athleteId)
    if (personalization) {
      systemPrompt = `${systemPrompt}\n\n${personalization}\n\nUse the getAthleteMemory and saveAthleteMemory tools to retrieve and store information about this athlete.`
    }
  }

  // Inject active insights at conversation start
  if (features.insights && athleteId) {
    try {
      const activeInsights = await getInsights(athleteId, { limit: 5, includeRead: false })
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

  // Canvas mode: Add widget display instructions
  if (canvasMode) {
    const canvasInstructions = `## Canvas Mode (AI Coach Page)

You are on the AI Coach page with a canvas that can display training widgets. When the user asks to see or show data, include a canvas command in your response.

**Available widgets:**
- \`[CANVAS:fitness]\` - Shows CTL, ATL, TSB metrics
- \`[CANVAS:pmc-chart]\` - Shows Performance Management Chart (fitness history)
- \`[CANVAS:sessions]\` - Shows recent training sessions table
- \`[CANVAS:sleep]\` - Shows sleep metrics
- \`[CANVAS:power-curve]\` - Shows power duration curve

**How to use:**
When the user asks to "show", "display", or wants to "see" their data, include the appropriate canvas command at the START of your response. The command will be parsed and the widget displayed - it won't show in the chat.

**Examples:**
- User: "Show my fitness" → Start response with \`[CANVAS:fitness]\` then explain the data
- User: "How's my power curve?" → Start with \`[CANVAS:power-curve]\` then analyze
- User: "Show me my recent workouts" → Start with \`[CANVAS:sessions]\` then summarize
- User: "I want to see my PMC" → Start with \`[CANVAS:pmc-chart]\` then explain trends

You can show multiple widgets by including multiple commands: \`[CANVAS:fitness][CANVAS:pmc-chart]\`

Always explain what the widget shows after displaying it. Be proactive - if the conversation is about fitness trends, show the PMC chart.`

    systemPrompt = `${systemPrompt}\n\n${canvasInstructions}`
  }

  // Convert UI messages (with parts) to API messages (with content)
  const convertedMessages = (messages as UIMessage[]).map(msg => ({
    role: msg.role,
    content: msg.content || msg.parts?.filter(p => p.type === 'text').map(p => p.text).join('') || '',
  }))

  // Build tool context
  const toolContext: ToolContext = {
    athleteId,
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

  const result = streamText({
    model: anthropic('claude-opus-4-5-20251101'),
    system: systemPrompt,
    messages: convertedMessages,
    stopWhen: stepCountIs(5), // Allow up to 5 tool call + response cycles
    tools,
  })

  return result.toUIMessageStreamResponse()
}
