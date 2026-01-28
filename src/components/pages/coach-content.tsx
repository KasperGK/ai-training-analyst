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
import { useSearchParams } from 'next/navigation'
import { useChat, type UIMessage } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { ResizeHandle } from '@/components/ui/resize-handle'
import { cn } from '@/lib/utils'
import { Canvas } from '@/components/coach/canvas'
import { FormattedMessage } from '@/components/coach/formatted-message'
import { ChatInputArea } from '@/components/coach/chat-input-area'
import { ChapterMenuPanel } from '@/components/coach/chapter-menu-panel'
import { useIntervalsData } from '@/hooks/use-intervals-data'
import { useConversations } from '@/hooks/use-conversations'
import { useCanvasState } from '@/hooks/use-canvas-state'
import { usePinnedWidgets } from '@/hooks/use-pinned-widgets'
import { useSmartSuggestions } from '@/hooks/use-smart-suggestions'
import { useCustomSuggestions } from '@/hooks/use-custom-suggestions'
import { useChapterTracking } from '@/hooks/use-chapter-tracking'
import type { WidgetConfig, CanvasActionPayload } from '@/lib/widgets/types'
import type { Chapter } from '@/lib/chat/chapters'
import {
  Bot,
  User,
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
    const validTypes = ['fitness', 'pmc-chart', 'sessions', 'sleep', 'power-curve', 'workout-card', 'chart', 'race-history', 'competitor-analysis']

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

/**
 * Format a timestamp for display on chat messages
 * Shows time for today, date + time for older messages
 */
function formatMessageTime(date: Date): string {
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  if (isToday) {
    return time
  }

  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  return `${dateStr}, ${time}`
}

/**
 * Safely extract createdAt from a message object
 */
function getMessageTimestamp(message: unknown): Date | null {
  if (
    message &&
    typeof message === 'object' &&
    'createdAt' in message &&
    message.createdAt instanceof Date
  ) {
    return message.createdAt
  }
  return null
}

export function CoachContent() {
  const searchParams = useSearchParams()
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')
  const [leftPanelWidth, setLeftPanelWidth] = useState(30) // percentage (chat 30%, canvas 70%)
  const [isLargeScreen, setIsLargeScreen] = useState(false)
  const [activeView, setActiveView] = useState<'chat' | 'history'>('chat')
  const [isScrolled, setIsScrolled] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [chapterMenuOpen, setChapterMenuOpen] = useState(false)
  const [currentVisibleMessageIndex, setCurrentVisibleMessageIndex] = useState(0)
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0)
  const chapterHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const lastNavigatedMessageIndex = useRef<number | null>(null)

  // Canvas state management with tool support
  const {
    state: canvasState,
    processCanvasAction,
    showWidgets,
    dismissWidget,
    pinWidget: pinWidgetState,
    unpinWidget: unpinWidgetState,
    restoreWidget,
    clearHistory,
    highlightWidget,
    loadPinnedWidgets,
    selectTab,
  } = useCanvasState()

  // Pinned widget persistence via localStorage
  const {
    savePinnedWidget,
    removePinnedWidget,
  } = usePinnedWidgets({
    onLoad: (persistedWidgets) => {
      // Load pinned widgets from localStorage on mount
      loadPinnedWidgets(persistedWidgets)
    },
  })

  // Wrap pin/unpin to persist to localStorage
  const pinWidget = (widgetId: string) => {
    pinWidgetState(widgetId)
    const widget = canvasState.widgets.find(w => w.id === widgetId)
    if (widget) {
      savePinnedWidget(widget)
    }
  }

  const unpinWidget = (widgetId: string) => {
    unpinWidgetState(widgetId)
    removePinnedWidget(widgetId)
  }

  const { athlete, currentFitness, sessions } = useIntervalsData()

  // Smart suggestions based on context
  const smartSuggestions = useSmartSuggestions({ currentFitness, sessions })

  // Custom user-defined suggestions
  const {
    suggestions: customSuggestions,
    addSuggestion: addCustomSuggestion,
    removeSuggestion: removeCustomSuggestion,
    canAddMore: canAddMoreSuggestions,
  } = useCustomSuggestions()

  // Conversation persistence
  const {
    conversations,
    loading: conversationsLoading,
    currentConversationId,
    currentMessages: savedMessages,
    loadConversations,
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

  // Handle pre-filled message from query param (e.g., from insights "Ask Coach")
  useEffect(() => {
    const message = searchParams.get('message')
    if (message) {
      setInput(message)
      // Clear the URL param without triggering navigation
      window.history.replaceState({}, '', '/coach')
    }
  }, [searchParams])

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
    const scrollArea = scrollRef.current
    if (!scrollArea) return

    const viewport = scrollArea.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight
    }
  }, [messages])

  // Track scroll position for compact mode and current visible message
  useEffect(() => {
    if (activeView !== 'chat') return  // Only track in chat view

    const scrollArea = scrollRef.current
    if (!scrollArea) return

    const viewport = scrollArea.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement
    if (!viewport) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport
      const scrolledFromBottom = scrollHeight - scrollTop - clientHeight
      setIsScrolled(scrolledFromBottom > 50)
      // Calculate scroll progress (0 to 1)
      const maxScroll = scrollHeight - clientHeight
      setScrollProgress(maxScroll > 0 ? scrollTop / maxScroll : 0)

      // Find currently visible message (for chapter highlighting)
      const viewportTop = scrollTop
      const viewportCenter = viewportTop + clientHeight / 2

      let closestIndex = 0
      let closestDistance = Infinity

      messageRefs.current.forEach((element, index) => {
        const rect = element.getBoundingClientRect()
        const elementTop = rect.top - viewport.getBoundingClientRect().top + scrollTop
        const elementCenter = elementTop + rect.height / 2
        const distance = Math.abs(elementCenter - viewportCenter)

        if (distance < closestDistance) {
          closestDistance = distance
          closestIndex = index
        }
      })

      setCurrentVisibleMessageIndex(closestIndex)
    }

    // Run once immediately to set initial state
    handleScroll()

    viewport.addEventListener('scroll', handleScroll)
    return () => viewport.removeEventListener('scroll', handleScroll)
  }, [activeView])  // Re-run when view changes

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
    // Skip if no athlete or conversation context
    if (!athlete?.id) {
      return
    }
    if (!currentConversationId) {
      return
    }
    // Skip if no new messages to save
    if (messages.length <= lastSavedMessageCount.current) return
    // Wait for streaming to complete before saving
    if (isLoading) return

    // Find new messages to save
    const newMessages = messages.slice(lastSavedMessageCount.current)
    const messagesToSave = newMessages
      .map((msg) => {
        const text = msg.parts
          .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
          .map((p) => p.text)
          .join('')

        // Extract tool calls from message parts for persistence
        const toolCalls = msg.parts
          .filter((p) => p.type.startsWith('tool-'))
          .map((p) => {
            const toolPart = p as { type: string; toolName?: string; state?: string; output?: unknown }
            return {
              type: toolPart.type,
              toolName: toolPart.toolName || toolPart.type.replace('tool-', ''),
              state: toolPart.state,
              result: toolPart.output,
            }
          })

        return {
          role: msg.role as 'user' | 'assistant',
          text,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined
        }
      })
      .filter((msg) => msg.text.trim().length > 0)

    if (messagesToSave.length === 0) {
      lastSavedMessageCount.current = messages.length
      return
    }

    // Save all messages with tool calls (fire-and-forget, but log errors)
    Promise.all(
      messagesToSave.map((msg) => saveMessageToDb(msg.role, msg.text, msg.toolCalls))
    ).catch((error) => {
      console.error('[CoachContent] Failed to save messages:', error)
    })

    lastSavedMessageCount.current = messages.length
  }, [messages, isLoading, athlete?.id, currentConversationId, saveMessageToDb])

  // Handle switching to history view - refresh the list
  const handleShowHistory = useCallback(() => {
    setActiveView('history')
    loadConversations() // Refresh to show any newly saved conversations
  }, [loadConversations])

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

  const handleSubmit = useCallback(() => {
    if (input.trim() && !isLoading) {
      // Ensure we have a conversation ID before sending (for history persistence)
      if (!currentConversationId) {
        startNewConversation()
      }
      sendMessage({ text: input })
      setInput('')
    }
  }, [input, isLoading, sendMessage, currentConversationId, startNewConversation])

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
      'race-history': `Analyze my race history. How are my results trending? What form (TSB) correlates with my best performances? Which race types am I strongest in?`,
      'competitor-analysis': `Analyze my competitor data. Who are my toughest rivals? What power gaps do I need to close? How do I compare to others in my category?`,
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
      createdAt: new Date(msg.created_at),
    })),
    [savedMessages]
  )

  // Restore canvas state from saved messages when loading a conversation
  useEffect(() => {
    if (savedMessages.length === 0) return

    // Process each assistant message to find canvas actions
    for (const msg of savedMessages) {
      if (msg.role !== 'assistant') continue

      // Check tool_calls for showOnCanvas results
      if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
        for (const toolCall of msg.tool_calls) {
          const tc = toolCall as { toolName?: string; result?: { canvasAction?: CanvasActionPayload } }
          if (tc.toolName === 'showOnCanvas' && tc.result?.canvasAction) {
            processCanvasAction(tc.result.canvasAction)
          }
        }
      }

      // Fallback: parse legacy [CANVAS:X] text commands
      const widgets = parseCanvasCommands(msg.content)
      if (widgets) {
        showWidgets(widgets)
      }
    }
  }, [savedMessages, processCanvasAction, showWidgets])

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

  // Chapter tracking for navigation (must come after displayMessages)
  const { chapters } = useChapterTracking({
    messages: displayMessages as UIMessage[],
  })

  // Update current chapter index when scroll position changes
  useEffect(() => {
    if (chapters.length === 0) {
      setCurrentChapterIndex(0)
      return
    }

    // Find which chapter corresponds to the current visible message
    const chapterIdx = chapters.findIndex((c, i, arr) => {
      const next = arr[i + 1]
      if (!next) return true // Last chapter covers everything after
      return currentVisibleMessageIndex >= c.messageIndex &&
             currentVisibleMessageIndex < next.messageIndex
    })
    setCurrentChapterIndex(Math.max(0, chapterIdx))
  }, [currentVisibleMessageIndex, chapters])

  // Handle chapter menu trigger zone (right edge)
  const handleChapterHoverEnter = useCallback(() => {
    // Clear any existing timeout
    if (chapterHoverTimeoutRef.current) {
      clearTimeout(chapterHoverTimeoutRef.current)
    }
    // Show menu after 1.5s delay
    chapterHoverTimeoutRef.current = setTimeout(() => {
      setChapterMenuOpen(true)
    }, 500)
  }, [])

  const handleChapterHoverLeave = useCallback(() => {
    // Clear the timeout
    if (chapterHoverTimeoutRef.current) {
      clearTimeout(chapterHoverTimeoutRef.current)
      chapterHoverTimeoutRef.current = null
    }
    // Hide menu
    setChapterMenuOpen(false)

    // Re-scroll to navigated message after panel closes (300ms transition)
    if (lastNavigatedMessageIndex.current !== null) {
      const targetIndex = lastNavigatedMessageIndex.current
      setTimeout(() => {
        const messageElement = messageRefs.current.get(targetIndex)
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'instant', block: 'center' })
        }
      }, 320) // Slightly after 300ms transition
      lastNavigatedMessageIndex.current = null
    }
  }, [])

  // Handle chapter click - scroll to message and highlight widget in grid
  const handleChapterClick = useCallback((chapter: Chapter) => {
    // Store the navigated message index for re-scroll after panel closes
    lastNavigatedMessageIndex.current = chapter.messageIndex

    // Scroll to the message
    const messageElement = messageRefs.current.get(chapter.messageIndex)
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    // If it's a widget chapter, highlight the widget in the grid
    if (chapter.widgetId) {
      highlightWidget(chapter.widgetId)
    }
    // Menu stays open - closes on mouse leave
  }, [highlightWidget])

  // Handle carousel center change - auto-scroll messages to match
  const handleChapterCenterChange = useCallback((chapter: Chapter) => {
    lastNavigatedMessageIndex.current = chapter.messageIndex

    const messageElement = messageRefs.current.get(chapter.messageIndex)
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    if (chapter.widgetId) {
      highlightWidget(chapter.widgetId)
    }
  }, [highlightWidget])

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
                    onClick={handleShowHistory}
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
              <div
                className="relative flex-1 min-h-0 overflow-hidden"
              >
                {/* Chat content - hidden when menu opens */}
                <div
                  className={cn(
                    "h-full transition-all duration-300 ease-out relative",
                    chapterMenuOpen && "opacity-0 pointer-events-none"
                  )}
                >
                  {/* Timeline scrollbar indicator - pill is the hover trigger */}
                  {!chapterMenuOpen && (
                    <div className="absolute right-0 top-0 bottom-0 w-4 z-10">
                      <div className="w-full h-full relative flex items-center justify-center pointer-events-none">
                        {/* Track background */}
                        <div className="absolute inset-y-2 w-1 rounded-full bg-muted-foreground/10" />
                        {/* Thumb - pill shape, this is the hover trigger */}
                        <div
                          className="absolute w-2 min-h-[32px] rounded-full bg-muted-foreground/40 border border-muted-foreground/20 transition-colors duration-150 pointer-events-auto cursor-pointer hover:bg-muted-foreground/60 hover:scale-110"
                          style={{
                            height: '15%',
                            top: `calc(${scrollProgress * 85}% + 8px)`,
                          }}
                          onMouseEnter={handleChapterHoverEnter}
                        />
                      </div>
                    </div>
                  )}

                  <ScrollArea
                    className="h-full -mx-6 px-6 pr-10"
                    ref={scrollRef}
                  >
                <div className="space-y-6 pb-4">
                  {displayMessages.map((message, index) => {
                    const text = getMessageText(message)
                    const isUser = message.role === 'user'

                    return (
                      <div
                        key={`${message.id}-${index}`}
                        ref={(el) => {
                          if (el) {
                            messageRefs.current.set(index, el)
                          }
                        }}
                        className={cn(
                          'flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300',
                          isUser ? 'flex-row-reverse' : 'flex-row'
                        )}
                        style={{ animationDelay: `${Math.min(index * 50, 200)}ms` }}
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
                          {/* Timestamp */}
                          {(() => {
                            const timestamp = getMessageTimestamp(message)
                            return timestamp ? (
                              <span className="text-[10px] text-muted-foreground/60 px-1">
                                {formatMessageTime(timestamp)}
                              </span>
                            ) : null
                          })()}
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
                </div>

                {/* Chapter Menu Panel */}
                <ChapterMenuPanel
                  open={chapterMenuOpen}
                  chapters={chapters}
                  currentChapterIndex={currentChapterIndex}
                  onChapterClick={handleChapterClick}
                  onCenterChange={handleChapterCenterChange}
                  onMouseLeave={handleChapterHoverLeave}
                />
              </div>

              {/* Input */}
              <div className="border-t pt-4 mt-4 shrink-0">
                <ChatInputArea
                  value={input}
                  onChange={setInput}
                  onSubmit={handleSubmit}
                  smartSuggestions={smartSuggestions}
                  customSuggestions={customSuggestions}
                  onAddCustomSuggestion={addCustomSuggestion}
                  onRemoveCustomSuggestion={removeCustomSuggestion}
                  canAddMoreSuggestions={canAddMoreSuggestions}
                  isScrolled={isScrolled}
                  disabled={isLoading}
                />
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
                  onSelectTab={selectTab}
                />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
