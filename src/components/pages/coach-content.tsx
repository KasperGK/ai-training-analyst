'use client'

/**
 * Coach Content Component
 *
 * Full AI coaching experience with:
 * - Chat interface on the left
 * - Dynamic widget canvas on the right (tool-driven + text fallback)
 *
 * Extracted from coach/page.tsx for carousel rendering.
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useChat, type UIMessage } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { ResizeHandle } from '@/components/ui/resize-handle'
import { cn } from '@/lib/utils'
import { Canvas } from '@/components/coach/canvas'
import { FormattedMessage } from '@/components/coach/formatted-message'
import { useIntervalsData } from '@/hooks/use-intervals-data'
import { useConversations } from '@/hooks/use-conversations'
import { useCanvasState } from '@/hooks/use-canvas-state'
import { useSmartSuggestions } from '@/hooks/use-smart-suggestions'
import type { WidgetConfig, CanvasActionPayload } from '@/lib/widgets/types'
import {
  Bot,
  User,
  Send,
  Plus,
  Trash2,
  MessageSquare,
} from 'lucide-react'

/**
 * Extract canvas action from showOnCanvas tool result in message parts
 */
function extractCanvasActionFromMessage(message: UIMessage): CanvasActionPayload | null {
  if (!message.parts) return null

  for (const part of message.parts) {
    // AI SDK formats tool parts with type like "tool-{toolName}"
    // Check for showOnCanvas tool results
    if (part.type === 'tool-showOnCanvas') {
      const toolPart = part as {
        type: string
        state?: string
        output?: { canvasAction?: CanvasActionPayload }
      }

      // Check for result state (could be 'result' or 'output-available')
      if (
        (toolPart.state === 'result' || toolPart.state === 'output-available') &&
        toolPart.output?.canvasAction
      ) {
        return toolPart.output.canvasAction
      }
    }
  }
  return null
}

/**
 * Parse legacy [CANVAS:X] text commands (fallback)
 */
function parseCanvasCommands(text: string): WidgetConfig[] | null {
  const canvasMatch = text.match(/\[CANVAS:([^\]]+)\]/g)
  if (!canvasMatch) return null

  const widgets: WidgetConfig[] = []
  for (const match of canvasMatch) {
    const type = match.replace('[CANVAS:', '').replace(']', '').trim().toLowerCase()
    const validTypes = ['fitness', 'pmc-chart', 'sessions', 'sleep', 'power-curve', 'workout-card', 'chart']

    if (validTypes.includes(type)) {
      widgets.push({
        id: `${type}-${Date.now()}-${widgets.length}`,
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
    'power-curve': 'Power Curve',
    'workout-card': 'Workout',
    'chart': 'Chart'
  }
  return titles[type] || type
}

export function CoachContent() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')
  const [leftPanelWidth, setLeftPanelWidth] = useState(30) // percentage (chat 30%, canvas 70%)
  const [isLargeScreen, setIsLargeScreen] = useState(false)
  const [activeView, setActiveView] = useState<'chat' | 'history'>('chat')

  // Canvas state management with tool support
  const {
    state: canvasState,
    processCanvasAction,
    showWidgets,
    dismissWidget,
    pinWidget,
    unpinWidget,
    restoreWidget,
    clearHistory,
  } = useCanvasState()

  const { athlete, currentFitness, sessions } = useIntervalsData()

  // Smart suggestions based on context
  const smartSuggestions = useSmartSuggestions({ currentFitness, sessions })

  // Conversation persistence
  const {
    conversations,
    loading: conversationsLoading,
    currentConversationId,
    currentMessages: savedMessages,
    loadConversation,
    startNewConversation,
    deleteConversation,
    saveMessage: saveMessageToDb,
  } = useConversations()

  const lastSavedMessageCount = useRef(0)
  const lastProcessedCanvasMessageId = useRef<string | null>(null)

  // Track screen size for responsive layout
  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024)
    }
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // Handle resize
  const handleResize = useCallback((delta: number) => {
    if (!containerRef.current) return
    const containerWidth = containerRef.current.offsetWidth
    const deltaPercent = (delta / containerWidth) * 100
    setLeftPanelWidth(prev => {
      const newWidth = prev + deltaPercent
      // Clamp between 25% and 75%
      return Math.min(75, Math.max(25, newWidth))
    })
  }, [])

  // Build athlete context for AI - include recent sessions for smart lookup
  const athleteContext = useMemo(() => {
    if (!athlete) return undefined

    // Format recent sessions for AI context (last 20, most recent first)
    // AI can use findSessions tool for older sessions if needed
    const recentSessions = (sessions || [])
      .slice(0, 20)
      .map(s => ({
        id: s.id,
        date: s.date,
        name: s.workout_type || s.sport,
        sport: s.sport,
        duration_min: s.duration_seconds ? Math.round(s.duration_seconds / 60) : null,
        tss: s.tss,
        intensity_factor: s.intensity_factor,
        avg_power: s.avg_power,
        normalized_power: s.normalized_power,
        // Help AI identify races: high IF (>0.9), "race" in name, or high TSS relative to duration
        likelyRace: (s.intensity_factor && s.intensity_factor > 0.9) ||
          (s.workout_type?.toLowerCase().includes('race')) ||
          (s.workout_type?.toLowerCase().includes('event')) ||
          (s.workout_type?.toLowerCase().includes('competition'))
      }))

    return JSON.stringify({
      name: athlete.name,
      ftp: athlete.ftp,
      weight_kg: athlete.weight_kg,
      max_hr: athlete.max_hr,
      lthr: athlete.lthr,
      resting_hr: athlete.resting_hr,
      currentFitness,
      // Include actual sessions so AI can find them by date/type
      recentSessions,
      today: new Date().toISOString().split('T')[0], // Help AI calculate "yesterday", "last week", etc.
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

  const { messages, sendMessage, setMessages, status, error } = useChat({ transport })
  const isLoading = status === 'submitted' || status === 'streaming'

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Process canvas actions from AI tool calls or text commands (fallback)
  useEffect(() => {
    if (messages.length === 0) return

    const lastMessage = messages[messages.length - 1]
    if (lastMessage.role !== 'assistant') return

    // Skip if we already processed this message
    if (lastProcessedCanvasMessageId.current === lastMessage.id) return

    // First, try to extract canvas action from showOnCanvas tool result
    const toolAction = extractCanvasActionFromMessage(lastMessage)
    if (toolAction) {
      lastProcessedCanvasMessageId.current = lastMessage.id
      processCanvasAction(toolAction)
      return
    }

    // Fallback: Parse legacy [CANVAS:X] text commands
    const text = lastMessage.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map(p => p.text)
      .join('')

    const widgets = parseCanvasCommands(text)
    if (widgets) {
      lastProcessedCanvasMessageId.current = lastMessage.id
      showWidgets(widgets)
    }
  }, [messages, processCanvasAction, showWidgets])

  // Save messages to database
  useEffect(() => {
    if (!athlete?.id || !currentConversationId) return
    if (messages.length <= lastSavedMessageCount.current) return
    if (isLoading) return // Wait for streaming to complete

    // Find new messages to save
    const newMessages = messages.slice(lastSavedMessageCount.current)

    for (const msg of newMessages) {
      const text = msg.parts
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('')

      if (text) {
        saveMessageToDb(msg.role as 'user' | 'assistant', text)
      }
    }

    lastSavedMessageCount.current = messages.length
  }, [messages, isLoading, athlete?.id, currentConversationId, saveMessageToDb])

  // Handle new conversation
  const handleNewConversation = useCallback(() => {
    startNewConversation()
    setMessages([])
    lastSavedMessageCount.current = 0
    setActiveView('chat')
  }, [startNewConversation, setMessages])

  // Handle loading a conversation
  const handleLoadConversation = useCallback(async (id: string) => {
    await loadConversation(id)
    setMessages([])
    lastSavedMessageCount.current = 0
    setActiveView('chat')
  }, [loadConversation, setMessages])

  // Handle delete conversation
  const handleDeleteConversation = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Delete this conversation?')) {
      await deleteConversation(id)
    }
  }, [deleteConversation])

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

  // Handle analyze widget - sends contextual prompt to chat
  const handleAnalyzeWidget = useCallback((widget: WidgetConfig) => {
    const analyzePrompts: Record<WidgetConfig['type'], string> = {
      'fitness': `Analyze my current fitness metrics in detail. What do the CTL, ATL, and TSB values tell me about my current training state? What should I focus on?`,
      'pmc-chart': `Analyze my PMC chart trends. How has my fitness evolved recently? Are there any concerning patterns or positive developments?`,
      'sessions': `Analyze my recent training sessions. What patterns do you see? Am I training consistently? How is my training load distribution?`,
      'sleep': `Analyze my sleep metrics. How is my recovery? Is my sleep quality affecting my training adaptations?`,
      'power-curve': `Analyze my power curve. What does it tell me about my strengths and weaknesses as a cyclist? What power durations should I focus on improving?`,
      'workout-card': `Analyze this workout in detail. How did I perform? What could be improved?`,
      'chart': `Analyze this chart data in detail. What patterns or insights do you see?`,
    }

    const prompt = analyzePrompts[widget.type] || `Analyze the ${widget.title} widget in detail.`
    sendMessage({ text: prompt })
  }, [sendMessage])

  // Get message text helper
  const getMessageText = (message: typeof messages[0]) => {
    return message.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text' && !!p.text)
      .map(p => p.text)
      .join('')
  }

  // Convert saved messages from DB format to display format
  const savedDisplayMessages = useMemo(() =>
    savedMessages.map(msg => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      parts: [{ type: 'text' as const, text: msg.content }],
    })),
    [savedMessages]
  )

  // Display messages: live session messages, saved messages, or welcome
  const displayMessages = useMemo(() => {
    // If we have current session messages, show those
    if (messages.length > 0) {
      return messages
    }

    // If we have saved messages from a previous session, show those
    if (savedDisplayMessages.length > 0) {
      return savedDisplayMessages
    }

    // Otherwise show welcome message
    return [{
      id: 'welcome',
      role: 'assistant' as const,
      parts: [{
        type: 'text' as const,
        text: "Hi! I'm your AI coach. I can show you your training data, analyze your fitness, suggest workouts, and answer questions about your training.\n\nTry asking me to \"show my fitness\" or \"show my power curve\" and I'll display it for you."
      }]
    }]
  }, [messages, savedDisplayMessages])

  return (
    <main className="h-full bg-muted/40 pt-24 pb-4 lg:pb-6 pl-2 pr-4 lg:pr-6">
      <div ref={containerRef} className="h-full">
        {/* Mobile: Stack vertically, Desktop: Side by side with resize */}
        <div className="flex flex-col lg:flex-row h-full gap-6 lg:gap-0 pl-2 lg:pl-4 pr-0">
          {/* Chat Card - positioned so rounded edge peeks from Dashboard */}
          <div
            className="flex flex-col min-h-[400px] lg:min-h-0 lg:h-full"
            style={isLargeScreen ? { flex: `0 0 ${leftPanelWidth}%` } : undefined}
          >
            <Card className="flex flex-col h-full overflow-hidden p-5">
              <div className="flex items-center justify-between shrink-0">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Chat
                </span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <button
                    onClick={() => setActiveView('chat')}
                    className={cn(
                      'px-2 py-0.5 rounded transition-colors',
                      activeView === 'chat'
                        ? 'bg-muted text-foreground'
                        : 'hover:text-foreground'
                    )}
                  >
                    Chat
                  </button>
                  <span className="text-muted-foreground/30">|</span>
                  <button
                    onClick={() => setActiveView('history')}
                    className={cn(
                      'px-2 py-0.5 rounded transition-colors',
                      activeView === 'history'
                        ? 'bg-muted text-foreground'
                        : 'hover:text-foreground'
                    )}
                  >
                    History
                  </button>
                </div>
              </div>
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden mt-3">
              {/* History View */}
              {activeView === 'history' ? (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="pb-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={handleNewConversation}
                    >
                      <Plus className="h-4 w-4" />
                      New conversation
                    </Button>
                  </div>
                  <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
                    <div className="space-y-1">
                      {conversationsLoading ? (
                        <div className="text-sm text-muted-foreground text-center py-8">Loading...</div>
                      ) : conversations.length === 0 ? (
                        <div className="text-center py-12 px-4">
                          <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                          <p className="text-sm font-medium text-muted-foreground">No conversations yet</p>
                          <p className="text-xs text-muted-foreground/70 mt-1">Start chatting to save your history</p>
                        </div>
                      ) : (
                        conversations.map((conv) => (
                          <div
                            key={conv.id}
                            onClick={() => handleLoadConversation(conv.id)}
                            className={cn(
                              'group flex items-start gap-3 rounded-md p-2.5 cursor-pointer transition-colors',
                              currentConversationId === conv.id
                                ? 'bg-muted'
                                : 'hover:bg-muted/50'
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-sm font-medium">{conv.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {conv.last_message_at.split('T')[0]}
                                <span className="mx-1">·</span>
                                {conv.message_count} msg
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0 -mr-1"
                              onClick={(e) => handleDeleteConversation(conv.id, e)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <>
              {/* Messages */}
              <ScrollArea className="flex-1 min-h-0 -mx-6 px-6" ref={scrollRef}>
                <div className="space-y-4 pb-4">
                  {displayMessages.map((message, index) => {
                    const text = getMessageText(message)
                    const isUser = message.role === 'user'

                    return (
                      <div
                        key={`${message.id}-${index}`}
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
                              <FormattedMessage text={text} />
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
              <div className="border-t pt-4 mt-4 shrink-0">
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
                  {smartSuggestions.map((suggestion, idx) => (
                    <QuickAction
                      key={idx}
                      label={suggestion.label}
                      onClick={() => handleQuickAction(suggestion.prompt)}
                    />
                  ))}
                </div>
              </div>
                </>
              )}
            </div>
          </Card>
          </div>

          {/* Resize Handle - Hidden on mobile */}
          <div className="hidden lg:flex items-center px-1">
            <ResizeHandle onResize={handleResize} />
          </div>

          {/* Canvas Card */}
          <div className="flex-1 min-h-[400px] lg:min-h-0 lg:h-full min-w-0">
            <Card className="flex flex-col h-full p-5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide shrink-0">
                Canvas
              </span>
              <div className="flex-1 min-h-0 overflow-auto mt-3 -mx-2 px-2">
                <Canvas
                  state={canvasState}
                  onDismissWidget={dismissWidget}
                  onPinWidget={pinWidget}
                  onUnpinWidget={unpinWidget}
                  onRestoreWidget={restoreWidget}
                  onClearHistory={clearHistory}
                  onAnalyzeWidget={handleAnalyzeWidget}
                />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
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
