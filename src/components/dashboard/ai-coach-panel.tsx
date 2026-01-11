'use client'

import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useConversations } from '@/hooks/use-conversations'
import type { WorkoutSuggestion } from '@/types'
import { Dumbbell, TrendingUp, Target, Calendar, Bot, User, Send, Plus, MessageSquare, Trash2 } from 'lucide-react'

interface AICoachPanelProps {
  athleteContext?: string // JSON string of athlete data for context
  athleteId?: string // User ID for database queries
  className?: string
}

// Tool result rendering components
function WorkoutCard({ workout, context }: { workout: WorkoutSuggestion; context: { currentTSB: number; selectedBecause: string; ftp: number } }) {
  return (
    <div className="rounded-lg border bg-muted p-3 mt-2">
      <div className="flex items-center gap-2 mb-2">
        <Dumbbell className="h-4 w-4" />
        <span className="font-medium capitalize">{workout.type} Workout</span>
        <span className="text-xs opacity-70">• {workout.duration_minutes}min • ~{workout.target_tss} TSS</span>
      </div>
      <p className="text-sm mb-2">{workout.description}</p>
      {workout.intervals && (
        <div className="text-xs bg-background/50 rounded p-2 font-mono">
          {workout.intervals.sets}x {workout.intervals.duration_seconds / 60}min @ {workout.intervals.target_power_percent}% FTP ({Math.round(context.ftp * workout.intervals.target_power_percent / 100)}W)
          <br />
          Rest: {workout.intervals.rest_seconds / 60}min between sets
        </div>
      )}
      <p className="text-xs mt-2 opacity-70">{context.selectedBecause}</p>
    </div>
  )
}

function TrendsCard({ data }: { data: { period: string; sessionCount: number; totalTSS: number; totalHours: number; avgIntensityFactor: number; sessionsPerWeek: number; fitnessData?: { startCTL: number; endCTL: number; ctlChange: number } | null } }) {
  return (
    <div className="rounded-lg border bg-muted/50 p-3 mt-2">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="h-4 w-4" />
        <span className="font-medium">Training Summary ({data.period})</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground">Sessions:</span> {data.sessionCount}
        </div>
        <div>
          <span className="text-muted-foreground">Per week:</span> {data.sessionsPerWeek}
        </div>
        <div>
          <span className="text-muted-foreground">Total TSS:</span> {data.totalTSS}
        </div>
        <div>
          <span className="text-muted-foreground">Hours:</span> {data.totalHours}
        </div>
        <div>
          <span className="text-muted-foreground">Avg IF:</span> {data.avgIntensityFactor}
        </div>
        {data.fitnessData && (
          <div className={data.fitnessData.ctlChange > 0 ? 'text-green-600' : 'text-red-600'}>
            <span className="text-muted-foreground">CTL:</span> {data.fitnessData.ctlChange > 0 ? '+' : ''}{data.fitnessData.ctlChange}
          </div>
        )}
      </div>
    </div>
  )
}

function GoalsCard({ data }: { data: { goals: Array<{ title: string; progress: number | null }>; upcomingEvents: Array<{ name: string; daysUntil: number; priority: string }>; periodizationPhase: string } }) {
  return (
    <div className="rounded-lg border bg-muted/50 p-3 mt-2">
      <div className="flex items-center gap-2 mb-2">
        <Target className="h-4 w-4" />
        <span className="font-medium">Goals & Events</span>
        <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded capitalize">{data.periodizationPhase} phase</span>
      </div>
      {data.goals.length > 0 && (
        <div className="mb-2">
          <span className="text-xs text-muted-foreground">Active Goals:</span>
          {data.goals.map((g, i) => (
            <div key={i} className="text-sm flex justify-between">
              <span>{g.title}</span>
              {g.progress !== null && <span className="text-muted-foreground">{g.progress}%</span>}
            </div>
          ))}
        </div>
      )}
      {data.upcomingEvents.length > 0 && (
        <div>
          <span className="text-xs text-muted-foreground">Upcoming Events:</span>
          {data.upcomingEvents.slice(0, 3).map((e, i) => (
            <div key={i} className="text-sm flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              <span>{e.name}</span>
              <span className="text-xs text-muted-foreground">({e.daysUntil}d)</span>
              <span className={cn('text-xs px-1 rounded', e.priority === 'A' ? 'bg-red-500/20 text-red-600' : e.priority === 'B' ? 'bg-yellow-500/20 text-yellow-600' : 'bg-gray-500/20')}>
                {e.priority}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function AICoachPanel({ athleteContext, athleteId, className }: AICoachPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')
  const [activeTab, setActiveTab] = useState('chat')
  const lastSavedMessageCount = useRef(0)

  // Conversation persistence
  const {
    conversations,
    loading: conversationsLoading,
    currentConversationId,
    loadConversation,
    startNewConversation,
    deleteConversation,
    saveMessage: saveMessageToDb,
  } = useConversations()

  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/chat',
    body: {
      athleteContext,
      athleteId,
    },
  }), [athleteContext, athleteId])

  const { messages, sendMessage, setMessages, status, error } = useChat({ transport })

  const isLoading = status === 'submitted' || status === 'streaming'

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Save new messages to database
  useEffect(() => {
    if (!athleteId || !currentConversationId) return
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
        // Extract tool calls if any
        const toolCalls = (msg.parts as unknown[]).filter(
          (p: unknown) => typeof p === 'object' && p !== null && 'type' in p && typeof (p as { type: string }).type === 'string' && (p as { type: string }).type.startsWith('tool-')
        )

        saveMessageToDb(
          msg.role as 'user' | 'assistant',
          text,
          toolCalls.length > 0 ? toolCalls : undefined
        )
      }
    }

    lastSavedMessageCount.current = messages.length
  }, [messages, isLoading, athleteId, currentConversationId, saveMessageToDb])

  // Handle new conversation
  const handleNewConversation = useCallback(() => {
    startNewConversation()
    setMessages([])
    lastSavedMessageCount.current = 0
  }, [startNewConversation, setMessages])

  // Handle loading a conversation
  const handleLoadConversation = useCallback(async (id: string) => {
    await loadConversation(id)
    // Note: We don't load old messages into useChat since it's designed for new sessions
    // Instead, show them separately and start fresh AI context
    setMessages([])
    lastSavedMessageCount.current = 0
    setActiveTab('chat')
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

  // Helper to extract text from message parts
  const getMessageText = (message: typeof messages[0]) => {
    return message.parts
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map(part => part.text)
      .join('')
  }

  // Helper to extract tool results from message parts
  // AI SDK 6 uses tool-{toolName} type with state property
  const getToolResults = (message: typeof messages[0]) => {
    return (message.parts as unknown as Array<{ type: string; state?: string; output?: unknown }>).filter((part) => {
      // Tool parts have type starting with 'tool-' and state 'output-available'
      return part.type.startsWith('tool-') && part.state === 'output-available' && part.output
    }).map(part => ({
      type: 'tool-result' as const,
      toolName: part.type.replace('tool-', ''),
      result: part.output,
    }))
  }

  // Render tool result based on tool name
  const renderToolResult = (toolName: string, result: unknown) => {
    const data = result as Record<string, unknown>

    if (toolName === 'suggestWorkout' && data.workout) {
      return <WorkoutCard workout={data.workout as WorkoutSuggestion} context={data.context as { currentTSB: number; selectedBecause: string; ftp: number }} />
    }

    if (toolName === 'queryHistoricalTrends' && data.sessionCount !== undefined) {
      return <TrendsCard data={data as { period: string; sessionCount: number; totalTSS: number; totalHours: number; avgIntensityFactor: number; sessionsPerWeek: number; fitnessData?: { startCTL: number; endCTL: number; ctlChange: number } | null }} />
    }

    if (toolName === 'getAthleteGoals' && (data.goals || data.upcomingEvents)) {
      return <GoalsCard data={data as { goals: Array<{ title: string; progress: number | null }>; upcomingEvents: Array<{ name: string; daysUntil: number; priority: string }>; periodizationPhase: string }} />
    }

    return null
  }

  // Show welcome message if no messages yet
  const displayMessages = messages.length === 0
    ? [{
        id: 'welcome',
        role: 'assistant' as const,
        createdAt: new Date(),
        parts: [{ type: 'text' as const, text: "Hi! I'm your AI training analyst. I can help you understand your training data, analyze your fitness trends, suggest workouts, and provide personalized recommendations. What would you like to know?" }],
      }]
    : messages

  // Format timestamp
  const formatTime = (date: Date | undefined) => {
    if (!date) return ''
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div className={cn('flex h-full flex-col overflow-hidden', className)}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        {/* Tab Header */}
        {athleteId && (
          <div className="px-4 pt-3 pb-2 border-b">
            <TabsList className="h-8">
              <TabsTrigger value="chat" className="text-xs px-3">
                Chat
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs px-3">
                History
              </TabsTrigger>
            </TabsList>
          </div>
        )}

        {/* History Tab Content */}
        <TabsContent value="history" className="flex-1 flex flex-col min-h-0 overflow-hidden mt-0 data-[state=inactive]:hidden">
          <div className="p-3 border-b">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => {
                handleNewConversation()
                setActiveTab('chat')
              }}
            >
              <Plus className="h-4 w-4" />
              New conversation
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-1">
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
        </TabsContent>

        {/* Chat Tab Content */}
        <TabsContent value="chat" className="flex-1 flex flex-col min-h-0 overflow-hidden mt-0 data-[state=inactive]:hidden">
          <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
            <div className="p-4">
            <div className="space-y-4">
            {displayMessages.map((message) => {
              const text = getMessageText(message)
              const toolResults = message.role === 'assistant' ? getToolResults(message) : []
              const isUser = message.role === 'user'
              const timestamp = 'createdAt' in message ? formatTime(message.createdAt as Date) : ''

              return (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3',
                    isUser ? 'flex-row-reverse' : 'flex-row'
                  )}
                >
                  {/* Avatar */}
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className={cn(
                      isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    )}>
                      {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>

                  {/* Message content */}
                  <div className={cn(
                    'flex flex-col gap-1',
                    isUser ? 'items-end' : 'items-start'
                  )}>
                    <div
                      className={cn(
                        'max-w-[280px] rounded-lg px-3 py-2 text-sm',
                        isUser
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      )}
                    >
                      {text && <p className="whitespace-pre-wrap">{text}</p>}
                      {toolResults.map((tr, idx) => (
                        <div key={idx}>
                          {renderToolResult(tr.toolName, tr.result)}
                        </div>
                      ))}
                    </div>
                    {timestamp && (
                      <span className="text-[10px] text-muted-foreground px-1">
                        {timestamp}
                      </span>
                    )}
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
                <div className="rounded-lg bg-muted px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-muted-foreground">Thinking...</span>
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
          </div>
        </ScrollArea>

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
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </Button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            <QuickAction
              label="Suggest workout"
              onClick={() => setInput("What workout should I do today?")}
            />
            <QuickAction
              label="Weekly summary"
              onClick={() => setInput('Give me a summary of my training this week')}
            />
            <QuickAction
              label="Check my form"
              onClick={() => setInput("How's my current form? Am I ready for intensity?")}
            />
            <QuickAction
              label="My goals"
              onClick={() => setInput("What are my current goals and how am I progressing?")}
            />
          </div>
        </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function QuickAction({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
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
