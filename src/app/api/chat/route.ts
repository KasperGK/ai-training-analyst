import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'

export const maxDuration = 30

export async function POST(req: Request) {
  const { messages, athleteContext } = await req.json()

  const systemPrompt = buildSystemPrompt(athleteContext)

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: systemPrompt,
    messages,
  })

  return result.toTextStreamResponse()
}
