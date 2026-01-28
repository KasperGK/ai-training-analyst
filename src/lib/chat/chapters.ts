/**
 * Chapter Types for Chat Navigation
 *
 * Chapters represent key moments in the conversation:
 * - User questions
 * - Widget showings (when AI displays data on canvas)
 *
 * Used for the hover chapter navigation popup.
 */

/**
 * Chapter types - what kind of moment this represents
 */
export type ChapterType = 'question' | 'widget'

/**
 * A chapter represents a navigable point in the conversation
 */
export interface Chapter {
  /** Unique identifier for this chapter */
  id: string
  /** Type of chapter */
  type: ChapterType
  /** Display title (truncated question or widget insight) */
  title: string
  /** Index of the message this chapter corresponds to */
  messageIndex: number
  /** If widget chapter, the widget ID (for grid highlight navigation) */
  widgetId?: string
  /** Widget type if applicable */
  widgetType?: string
  /** Timestamp when this chapter occurred */
  timestamp: Date
}

/**
 * Maximum length for chapter titles
 */
export const CHAPTER_TITLE_MAX_LENGTH = 60

/**
 * Truncate text to a maximum length, adding ellipsis if needed
 */
export function truncateTitle(text: string, maxLength: number = CHAPTER_TITLE_MAX_LENGTH): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 1).trim() + '…'
}

/**
 * Create a unique chapter ID
 */
export function createChapterId(type: ChapterType, messageIndex: number): string {
  return `chapter-${type}-${messageIndex}`
}
