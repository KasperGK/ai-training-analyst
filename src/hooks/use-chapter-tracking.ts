import { useMemo } from 'react'
import type { UIMessage } from '@ai-sdk/react'
import type { Chapter, ChapterType } from '@/lib/chat/chapters'
import { truncateTitle, createChapterId } from '@/lib/chat/chapters'
import type { CanvasActionPayload, WidgetConfig } from '@/lib/widgets/types'

/**
 * Widget type to human-readable label mapping
 */
const WIDGET_TYPE_LABELS: Record<string, string> = {
  'fitness': 'Fitness Overview',
  'pmc-chart': 'PMC Chart',
  'power-curve': 'Power Curve',
  'sessions': 'Recent Sessions',
  'sleep': 'Sleep Analysis',
  'workout-card': 'Workout Details',
  'chart': 'Data Chart',
}

/**
 * Message part with text content
 */
interface TextPart {
  type: 'text'
  text: string
}

/**
 * Tool part from showOnCanvas
 */
interface ToolPart {
  type: string
  state?: string
  output?: {
    canvasAction?: CanvasActionPayload
  }
}

/**
 * Extract text from message parts
 */
function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is TextPart => p.type === 'text' && !!p.text)
    .map(p => p.text)
    .join('')
}

/**
 * Extract canvas action from showOnCanvas tool result
 */
function extractCanvasAction(message: UIMessage): CanvasActionPayload | null {
  if (!message.parts) return null

  for (const part of message.parts) {
    if (part.type === 'tool-showOnCanvas') {
      const toolPart = part as ToolPart
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
 * Get a display title for a widget
 * Uses widget type label as base, appends insight if available
 */
function getWidgetTitle(widget: WidgetConfig): string {
  const typeLabel = WIDGET_TYPE_LABELS[widget.type] || widget.title

  // If we have an insight summary, append it to the type label
  if (widget.context?.insightSummary) {
    return truncateTitle(`${typeLabel}: ${widget.context.insightSummary}`)
  }

  return typeLabel
}

/**
 * Extract a clean chapter title from user question text
 * Removes common question prefixes and creates a descriptive summary
 */
function extractChapterTitle(text: string): string {
  // Common question/command prefixes to remove
  const prefixes = [
    /^(can you |please |could you |would you |show me |display |analyze |tell me |explain |what is |what are |what's |how do |how does |how is |how are |why is |why are |why does |when is |when did |i want to |i need to |i'd like to |let me see |give me )/gi,
  ]

  let title = text.trim()

  // Remove each prefix pattern
  for (const prefix of prefixes) {
    title = title.replace(prefix, '')
  }

  // Remove trailing question marks and periods
  title = title.replace(/[?.!]+$/, '').trim()

  // Capitalize first letter
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1)
  }

  // Truncate if still too long
  return truncateTitle(title, 35)
}

interface UseChapterTrackingOptions {
  /** Messages to derive chapters from */
  messages: UIMessage[]
}

interface UseChapterTrackingResult {
  /** Derived chapters from conversation */
  chapters: Chapter[]
  /** Get chapter by message index */
  getChapterByMessageIndex: (index: number) => Chapter | undefined
  /** Get chapters of a specific type */
  getChaptersByType: (type: ChapterType) => Chapter[]
}

/**
 * Hook to derive conversation chapters from messages
 *
 * Chapters are:
 * - User questions (role === 'user')
 * - Widget showings (AI message with showOnCanvas tool result)
 */
export function useChapterTracking({
  messages,
}: UseChapterTrackingOptions): UseChapterTrackingResult {
  const chapters = useMemo(() => {
    const result: Chapter[] = []

    messages.forEach((message, index) => {
      const timestamp = new Date()

      // User messages become question chapters
      if (message.role === 'user') {
        const text = getMessageText(message)
        if (text.trim()) {
          result.push({
            id: createChapterId('question', index),
            type: 'question',
            title: extractChapterTitle(text),
            messageIndex: index,
            timestamp,
          })
        }
        return
      }

      // Assistant messages with canvas actions become widget chapters
      if (message.role === 'assistant') {
        const canvasAction = extractCanvasAction(message)
        if (canvasAction && canvasAction.widgets.length > 0) {
          // Create a chapter for each widget shown
          canvasAction.widgets.forEach((widget, widgetIndex) => {
            result.push({
              id: createChapterId('widget', index) + `-${widgetIndex}`,
              type: 'widget',
              title: getWidgetTitle(widget),
              messageIndex: index,
              widgetId: widget.id,
              widgetType: widget.type,
              timestamp,
            })
          })
        }
      }
    })

    return result
  }, [messages])

  const getChapterByMessageIndex = useMemo(() => {
    return (index: number) => chapters.find(c => c.messageIndex === index)
  }, [chapters])

  const getChaptersByType = useMemo(() => {
    return (type: ChapterType) => chapters.filter(c => c.type === type)
  }, [chapters])

  return {
    chapters,
    getChapterByMessageIndex,
    getChaptersByType,
  }
}
