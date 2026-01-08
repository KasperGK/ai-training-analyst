'use client'

import { useRef, useEffect, useState, useMemo } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { WorkoutSuggestion } from '@/types'
import { Dumbbell, TrendingUp, Target, Calendar } from 'lucide-react'

interface AICoachPanelProps {
  athleteContext?: string // JSON string of athlete data for context
  athleteId?: string // User ID for database queries
  className?: string
}

// Tool result rendering components
function WorkoutCard({ workout, context }: { workout: WorkoutSuggestion; context: { currentTSB: number; selectedBecause: string; ftp: number } }) {
  const typeColors: Record<string, string> = {
    recovery: 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400',
    endurance: 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400',
    tempo: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400',
    threshold: 'bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400',
    intervals: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400',
  }

  return (
    <div className={cn('rounded-lg border p-3 mt-2', typeColors[workout.type] || 'bg-muted')}>
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

  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/chat',
    body: {
      athleteContext,
      athleteId,
    },
  }), [athleteContext, athleteId])

  const { messages, sendMessage, status, error } = useChat({ transport })

  const isLoading = status === 'submitted' || status === 'streaming'

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

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
  const getToolResults = (message: typeof messages[0]) => {
    return (message.parts as unknown as Array<{ type: string; toolName?: string; result?: unknown }>).filter((part) => {
      return part.type === 'tool-result' && part.result
    }) as Array<{ type: 'tool-result'; toolName: string; result: unknown }>
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
        parts: [{ type: 'text' as const, text: "Hi! I'm your AI training analyst. I can help you understand your training data, analyze your fitness trends, suggest workouts, and provide personalized recommendations. What would you like to know?" }],
      }]
    : messages

  return (
    <Card className={cn('flex h-full flex-col', className)}>
      <CardHeader className="border-b pb-3">
        <CardTitle className="text-lg">AI Coach</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col p-0">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {displayMessages.map((message) => {
              const text = getMessageText(message)
              const toolResults = message.role === 'assistant' ? getToolResults(message) : []

              return (
                <div
                  key={message.id}
                  className={cn(
                    'flex flex-col',
                    message.role === 'user' ? 'items-end' : 'items-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[90%] rounded-lg px-4 py-2 text-sm',
                      message.role === 'user'
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
                </div>
              )
            })}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-lg bg-muted px-4 py-2 text-sm">
                  <p className="text-muted-foreground animate-pulse">Analyzing...</p>
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

        <div className="border-t p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your training..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              Send
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
      </CardContent>
    </Card>
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
