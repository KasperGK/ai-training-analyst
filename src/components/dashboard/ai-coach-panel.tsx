'use client'

import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useConversations } from '@/hooks/use-conversations'
import type { WorkoutSuggestion } from '@/types'
import { Dumbbell, TrendingUp, Target, Calendar, Bot, User, Send, Plus, MessageSquare, Trash2, BarChart3 } from 'lucide-react'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'

// Simple markdown-like text formatter
function FormattedText({ text }: { text: string }) {
  // Split into paragraphs
  const paragraphs = text.split(/\n\n+/)

  return (
    <div className="space-y-2">
      {paragraphs.map((para, pIdx) => {
        // Check if paragraph is a list
        const lines = para.split('\n')
        const isNumberedList = lines.every(l => /^\d+\.\s/.test(l.trim()) || l.trim() === '')
        const isBulletList = lines.every(l => /^[-•]\s/.test(l.trim()) || l.trim() === '')

        if (isNumberedList || isBulletList) {
          return (
            <ol key={pIdx} className={cn("space-y-1 pl-4", isNumberedList ? "list-decimal" : "list-disc")}>
              {lines.filter(l => l.trim()).map((line, lIdx) => (
                <li key={lIdx} className="text-sm leading-relaxed">
                  <FormatInline text={line.replace(/^(\d+\.|-|•)\s*/, '')} />
                </li>
              ))}
            </ol>
          )
        }

        // Regular paragraph
        return (
          <p key={pIdx} className="text-sm leading-relaxed">
            <FormatInline text={para.replace(/\n/g, ' ')} />
          </p>
        )
      })}
    </div>
  )
}

// Format inline markdown: **bold**
function FormatInline({ text }: { text: string }) {
  // Simple bold text processing
  const parts: React.ReactNode[] = []
  const segments = text.split(/(\*\*[^*]+\*\*)/)

  segments.forEach((segment, i) => {
    if (segment.startsWith('**') && segment.endsWith('**')) {
      // Bold text
      const content = segment.slice(2, -2)
      parts.push(<strong key={i} className="font-semibold">{content}</strong>)
    } else if (segment) {
      parts.push(<span key={i}>{segment}</span>)
    }
  })

  return <>{parts}</>
}

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

// Chart rendering component
interface ChartData {
  chartType: 'line' | 'bar' | 'area'
  title: string
  data: Array<Record<string, string | number>>
  dataKeys: string[]
  colors: string[]
  useFillFromData?: boolean
}

function ChartCard({ data }: { data: ChartData }) {
  const { chartType, title, data: chartData, dataKeys, colors, useFillFromData } = data

  if (!chartData || chartData.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/50 p-3 mt-2">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="h-4 w-4" />
          <span className="font-medium">{title}</span>
        </div>
        <p className="text-sm text-muted-foreground">No data available</p>
      </div>
    )
  }

  // Build chart config from dataKeys
  const chartConfig: Record<string, { label: string; color: string }> = {}
  dataKeys.forEach((key, i) => {
    chartConfig[key] = {
      label: key,
      color: colors[i] || `hsl(var(--chart-${i + 1}))`,
    }
  })

  return (
    <div className="rounded-lg border bg-muted/50 p-3 mt-2">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="h-4 w-4" />
        <span className="font-medium text-sm">{title}</span>
      </div>
      <ChartContainer config={chartConfig} className="h-[180px] w-full">
        {chartType === 'line' ? (
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
            <ChartTooltip content={<ChartTooltipContent />} />
            {dataKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[i] || `hsl(var(--chart-${i + 1}))`}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        ) : chartType === 'area' ? (
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
            <ChartTooltip content={<ChartTooltipContent />} />
            {dataKeys.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                fill={colors[i] || `hsl(var(--chart-${i + 1}))`}
                stroke={colors[i] || `hsl(var(--chart-${i + 1}))`}
                fillOpacity={0.3}
              />
            ))}
          </AreaChart>
        ) : (
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
            <ChartTooltip content={<ChartTooltipContent />} />
            {dataKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                fill={useFillFromData ? undefined : (colors[i] || `hsl(var(--chart-${i + 1}))`)}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        )}
      </ChartContainer>
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
    currentMessages: savedMessages,
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

  // Common message type for display
  type DisplayMessage = {
    id: string
    role: 'user' | 'assistant'
    createdAt?: Date
    parts: Array<{ type: string; text?: string; [key: string]: unknown }>
  }

  // Helper to extract text from message parts
  const getMessageText = (message: DisplayMessage) => {
    return message.parts
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text' && !!part.text)
      .map(part => part.text)
      .join('')
  }

  // Helper to extract tool results from message parts
  // AI SDK 6 uses tool-{toolName} type with state property
  const getToolResults = (message: DisplayMessage) => {
    const results = (message.parts as Array<{ type: string; state?: string; output?: unknown }>).filter((part) => {
      // Tool parts have type starting with 'tool-' and state 'output-available' (or saved results)
      return part.type.startsWith('tool-') && (part.state === 'output-available' || part.output) && part.output
    }).map(part => ({
      type: 'tool-result' as const,
      toolName: part.type.replace('tool-', ''),
      result: part.output,
    }))

    // Deduplicate by toolName + stringified result
    const seen = new Set<string>()
    return results.filter(r => {
      const key = `${r.toolName}:${JSON.stringify(r.result)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
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

    if (toolName === 'generateChart' && data.chartType && data.data) {
      return <ChartCard data={data as unknown as ChartData} />
    }

    return null
  }

  // Convert saved messages from DB format to display format
  const savedDisplayMessages = useMemo(() =>
    savedMessages.map(msg => {
      // Start with text part
      const parts: Array<{ type: string; text?: string; [key: string]: unknown }> = []

      if (msg.content) {
        parts.push({ type: 'text' as const, text: msg.content })
      }

      // Restore tool call results if saved
      if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
        for (const toolCall of msg.tool_calls) {
          if (toolCall && typeof toolCall === 'object' && 'type' in toolCall) {
            parts.push(toolCall as { type: string; [key: string]: unknown })
          }
        }
      }

      return {
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        createdAt: new Date(msg.created_at),
        parts,
      }
    }),
    [savedMessages]
  )

  // Display either saved messages (when returning to conversation) or current session messages
  // Don't combine them - this prevents duplicates
  const displayMessages: DisplayMessage[] = useMemo(() => {
    // If we have current session messages, show those (they're being saved in background)
    if (messages.length > 0) {
      return messages.map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        createdAt: 'createdAt' in m ? (m.createdAt as Date) : new Date(),
        parts: m.parts as Array<{ type: string; text?: string; [key: string]: unknown }>,
      }))
    }

    // If we have saved messages from a previous session, show those
    if (savedDisplayMessages.length > 0) {
      return savedDisplayMessages
    }

    // Otherwise show welcome message
    return [{
      id: 'welcome',
      role: 'assistant' as const,
      createdAt: new Date(),
      parts: [{ type: 'text' as const, text: "Hi! I'm your AI training analyst. I can help you understand your training data, analyze your fitness trends, suggest workouts, and provide personalized recommendations. What would you like to know?" }],
    }]
  }, [messages, savedDisplayMessages])

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
        {/* Header with title and tabs */}
        <div className="pb-2 border-b flex flex-col gap-1 shrink-0">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">AI Coach</span>
          {athleteId && (
            <div className="flex items-center justify-center gap-0.5 text-xs">
              <button
                onClick={() => setActiveTab('chat')}
                className={cn(
                  'px-2.5 py-0.5 rounded transition-colors',
                  activeTab === 'chat'
                    ? 'bg-foreground text-background font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Chat
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={cn(
                  'px-2.5 py-0.5 rounded transition-colors',
                  activeTab === 'history'
                    ? 'bg-foreground text-background font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                History
              </button>
            </div>
          )}
        </div>

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
                    'flex flex-col gap-1 max-w-[85%]',
                    isUser ? 'items-end' : 'items-start'
                  )}>
                    <div
                      className={cn(
                        'rounded-2xl px-4 py-2.5',
                        isUser
                          ? 'bg-primary text-primary-foreground rounded-tr-sm'
                          : 'bg-muted rounded-tl-sm'
                      )}
                    >
                      {text && (
                        isUser
                          ? <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
                          : <FormattedText text={text} />
                      )}
                      {toolResults.map((tr, idx) => (
                        <div key={idx}>
                          {renderToolResult(tr.toolName, tr.result)}
                        </div>
                      ))}
                    </div>
                    {timestamp && (
                      <span className="text-[10px] text-muted-foreground/60 px-2">
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
