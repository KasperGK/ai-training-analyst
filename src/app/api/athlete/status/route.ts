import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

export const runtime = 'edge'

interface StatusRequest {
  ctl: number
  atl: number
  tsb: number
  ctl_trend: 'up' | 'down' | 'stable'
}

export async function POST(request: Request) {
  try {
    const body: StatusRequest = await request.json()
    const { ctl, atl, tsb, ctl_trend } = body

    // Generate a personalized status using Claude
    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: `You are a cycling coach giving brief, actionable status updates.
Be direct and practical. Use 1-2 short sentences max.
Never use emoji. Never be overly enthusiastic.
Reference the actual numbers when relevant.`,
      prompt: `Athlete fitness metrics:
- CTL (Fitness): ${ctl.toFixed(0)} (trend: ${ctl_trend})
- ATL (Fatigue): ${atl.toFixed(0)}
- TSB (Form): ${tsb.toFixed(0)}

Give a brief status update about their current form and one practical suggestion.`,
    })

    return NextResponse.json({ status: text.trim() })
  } catch (error) {
    console.error('Failed to generate status:', error)

    // Return a fallback based on TSB zones
    const { tsb, ctl_trend } = await request.json().catch(() => ({ tsb: 0, ctl_trend: 'stable' }))
    const fallback = getFallbackStatus(tsb, ctl_trend)

    return NextResponse.json({ status: fallback })
  }
}

function getFallbackStatus(tsb: number, trend: string): string {
  if (tsb > 25) {
    return 'Very fresh - great window for a hard effort, but avoid too much rest or you may lose fitness.'
  }
  if (tsb >= 5) {
    return 'Fresh and ready to perform. Good time for quality sessions or racing.'
  }
  if (tsb >= -10) {
    return `Balanced state${trend === 'up' ? ', fitness building' : ''}. Productive training zone.`
  }
  if (tsb >= -25) {
    return 'Accumulated fatigue. Consider an easier day to let your body absorb recent training.'
  }
  return 'High fatigue - prioritize rest and recovery to avoid overtraining.'
}
