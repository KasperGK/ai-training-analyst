'use client'

/**
 * AI Coach Page
 *
 * Full-page AI coaching experience with:
 * - Chat interface on the left
 * - Dynamic widget canvas on the right
 *
 * The AI can control which widgets appear on the canvas
 * based on the conversation context.
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { Canvas } from '@/components/coach/canvas'
import { useIntervalsData } from '@/hooks/use-intervals-data'
import type { CanvasState, WidgetConfig } from '@/lib/widgets/types'
import { DEFAULT_CANVAS_STATE } from '@/lib/widgets/types'
import {
  ArrowLeft,
  Bot,
  User,
  Send,
  Settings,
  Sparkles,
} from 'lucide-react'

// Parse canvas commands from AI messages
function parseCanvasCommands(text: string): WidgetConfig[] | null {
  // Look for [CANVAS:widget-type] patterns in AI response
  const canvasMatch = text.match(/\[CANVAS:([^\]]+)\]/g)
  if (!canvasMatch) return null

  const widgets: WidgetConfig[] = []
  for (const match of canvasMatch) {
    const type = match.replace('[CANVAS:', '').replace(']', '').trim().toLowerCase()
    const validTypes = ['fitness', 'pmc-chart', 'sessions', 'sleep', 'power-curve']

    if (validTypes.includes(type)) {
      widgets.push({
        id: `${type}-${Date.now()}`,
        type: type as WidgetConfig['type'],
        title: getWidgetTitle(type),
        description: ''
      })
    }
  }

  return widgets.length > 0 ? widgets : null
}

function getWidgetTitle(type: string): string {
  const titles: Record<string, string> = {
    'fitness': 'Current Fitness',
    'pmc-chart': 'Performance Management',
    'sessions': 'Recent Sessions',
    'sleep': 'Sleep Metrics',
    'power-curve': 'Power Curve'
  }
  return titles[type] || type
}

// Simple text formatter
function FormattedText({ text }: { text: string }) {
  // Remove canvas commands from display
  const cleanText = text.replace(/\[CANVAS:[^\]]+\]/g, '').trim()
  if (!cleanText) return null

  const paragraphs = cleanText.split(/\n\n+/)

  return (
    <div className="space-y-2">
      {paragraphs.map((para, pIdx) => {
        const lines = para.split('\n')
        const isNumberedList = lines.every(l => /^\d+\.\s/.test(l.trim()) || l.trim() === '')
        const isBulletList = lines.every(l => /^[-•]\s/.test(l.trim()) || l.trim() === '')

        if (isNumberedList || isBulletList) {
          return (
            <ul key={pIdx} className={cn("space-y-1 pl-4", isNumberedList ? "list-decimal" : "list-disc")}>
              {lines.filter(l => l.trim()).map((line, lIdx) => (
                <li key={lIdx} className="text-sm leading-relaxed">
                  {line.replace(/^(\d+\.|-|•)\s*/, '')}
                </li>
              ))}
            </ul>
          )
        }

        return (
          <p key={pIdx} className="text-sm leading-relaxed">
            {para.replace(/\n/g, ' ')}
          </p>
        )
      })}
    </div>
  )
}

export default function CoachPage() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')
  const [canvasState, setCanvasState] = useState<CanvasState>(DEFAULT_CANVAS_STATE)

  const { athlete, currentFitness, sessions, connected } = useIntervalsData()

  // Build athlete context for AI
  const athleteContext = useMemo(() => {
    if (!athlete) return undefined
    return JSON.stringify({
      name: athlete.name,
      ftp: athlete.ftp,
      weight_kg: athlete.weight_kg,
      max_hr: athlete.max_hr,
      currentFitness,
      recentSessionCount: sessions?.length ?? 0
    })
  }, [athlete, currentFitness, sessions])

  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/chat',
    body: {
      athleteContext,
      athleteId: athlete?.id,
      canvasMode: true, // Signal to backend that canvas commands are supported
    },
  }), [athleteContext, athlete?.id])

  const { messages, sendMessage, status, error } = useChat({ transport })
  const isLoading = status === 'submitted' || status === 'streaming'

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Parse canvas commands from AI responses
  useEffect(() => {
    if (messages.length === 0) return

    const lastMessage = messages[messages.length - 1]
    if (lastMessage.role !== 'assistant') return

    const text = lastMessage.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map(p => p.text)
      .join('')

    const widgets = parseCanvasCommands(text)
    if (widgets) {
      setCanvasState(prev => ({
        ...prev,
        widgets: widgets,
        layout: widgets.length > 1 ? 'stacked' : 'single'
      }))
    }
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && !isLoading) {
      sendMessage({ text: input })
      setInput('')
    }
  }

  const handleQuickAction = useCallback((text: string) => {
    setInput(text)
  }, [])

  // Get message text helper
  const getMessageText = (message: typeof messages[0]) => {
    return message.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text' && !!p.text)
      .map(p => p.text)
      .join('')
  }

  // Default welcome message
  const displayMessages = messages.length > 0 ? messages : [{
    id: 'welcome',
    role: 'assistant' as const,
    parts: [{
      type: 'text' as const,
      text: "Hi! I'm your AI coach. I can show you your training data, analyze your fitness, suggest workouts, and answer questions about your training.\n\nTry asking me to \"show my fitness\" or \"show my power curve\" and I'll display it for you."
    }]
  }]

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-14 border-b flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="font-semibold">AI Coach</h1>
          {!connected && (
            <span className="text-xs text-muted-foreground">(Not connected)</span>
          )}
        </div>
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </Link>
      </header>

      {/* Main content - Split layout */}
      <div className="flex-1 min-h-0 flex">
        {/* Chat Panel */}
        <div className="w-[400px] border-r flex flex-col shrink-0">
          {/* Messages */}
          <ScrollArea className="flex-1" ref={scrollRef}>
            <div className="p-4 space-y-4">
              {displayMessages.map((message) => {
                const text = getMessageText(message)
                const isUser = message.role === 'user'

                return (
                  <div
                    key={message.id}
                    className={cn(
                      'flex gap-3',
                      isUser ? 'flex-row-reverse' : 'flex-row'
                    )}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className={cn(
                        isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      )}>
                        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className={cn(
                      'flex flex-col gap-1 max-w-[85%]',
                      isUser ? 'items-end' : 'items-start'
                    )}>
                      <div className={cn(
                        'rounded-2xl px-4 py-2.5',
                        isUser
                          ? 'bg-primary text-primary-foreground rounded-tr-sm'
                          : 'bg-muted rounded-tl-sm'
                      )}>
                        {isUser ? (
                          <p className="text-sm whitespace-pre-wrap">{text}</p>
                        ) : (
                          <FormattedText text={text} />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {isLoading && (
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-muted">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex justify-center">
                  <div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
                    Error: {error.message}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t p-4">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your training..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={isLoading || !input.trim()}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>

            <div className="mt-3 flex flex-wrap gap-2">
              <QuickAction label="Show fitness" onClick={() => handleQuickAction("Show my current fitness")} />
              <QuickAction label="Show power curve" onClick={() => handleQuickAction("Show my power curve")} />
              <QuickAction label="Show PMC" onClick={() => handleQuickAction("Show my PMC chart")} />
              <QuickAction label="Recent workouts" onClick={() => handleQuickAction("Show my recent workouts")} />
            </div>
          </div>
        </div>

        {/* Canvas Panel */}
        <div className="flex-1 overflow-auto p-6 bg-muted/30">
          <Canvas state={canvasState} />
        </div>
      </div>
    </div>
  )
}

function QuickAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {label}
    </button>
  )
}
