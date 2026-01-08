import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'

export const maxDuration = 30

interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  parts?: { type: string; text: string }[]
  content?: string
}

export async function POST(req: Request) {
  const { messages, athleteContext } = await req.json()

  const systemPrompt = buildSystemPrompt(athleteContext)

  // Convert UI messages (with parts) to API messages (with content)
  const convertedMessages = (messages as UIMessage[]).map(msg => ({
    role: msg.role,
    content: msg.content || msg.parts?.filter(p => p.type === 'text').map(p => p.text).join('') || '',
  }))

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: systemPrompt,
    messages: convertedMessages,
  })

  return result.toUIMessageStreamResponse()
}
