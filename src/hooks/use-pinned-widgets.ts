import { useState, useEffect, useCallback } from 'react'
import type { WidgetConfig } from '@/lib/widgets/types'

const STORAGE_KEY = 'coach-pinned-widgets-v1'

/**
 * Serialize a WidgetConfig for localStorage
 * Strips any stale data that shouldn't persist
 */
function serializeWidget(widget: WidgetConfig): WidgetConfig {
  return {
    id: widget.id,
    type: widget.type,
    title: widget.title,
    description: widget.description,
    context: widget.context,
    params: widget.params,
    chartConfig: widget.chartConfig,
    isPinned: true,
    // Note: error state is NOT persisted (data may be stale)
  }
}

/**
 * Load pinned widgets from localStorage
 */
function loadFromStorage(): WidgetConfig[] {
  if (typeof window === 'undefined') return []

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []

    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []

    // Validate each widget has required fields
    return parsed.filter((w: unknown): w is WidgetConfig => {
      if (!w || typeof w !== 'object') return false
      const obj = w as Record<string, unknown>
      return (
        typeof obj.id === 'string' &&
        typeof obj.type === 'string' &&
        typeof obj.title === 'string'
      )
    })
  } catch (error) {
    console.error('Failed to load pinned widgets:', error)
    return []
  }
}

/**
 * Save pinned widgets to localStorage
 */
function saveToStorage(widgets: WidgetConfig[]): void {
  if (typeof window === 'undefined') return

  try {
    const serialized = widgets.map(serializeWidget)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized))
  } catch (error) {
    console.error('Failed to save pinned widgets:', error)
  }
}

interface UsePinnedWidgetsOptions {
  /** Called when pinned widgets are loaded from storage */
  onLoad?: (widgets: WidgetConfig[]) => void
}

interface UsePinnedWidgetsResult {
  /** Currently persisted pinned widgets */
  pinnedWidgets: WidgetConfig[]
  /** Save a widget to persistent storage */
  savePinnedWidget: (widget: WidgetConfig) => void
  /** Remove a widget from persistent storage */
  removePinnedWidget: (widgetId: string) => void
  /** Check if a widget is persisted */
  isWidgetPersisted: (widgetId: string) => boolean
  /** Clear all persisted widgets */
  clearPinnedWidgets: () => void
}

/**
 * Hook for managing pinned widget persistence via localStorage
 *
 * Pinned widgets survive:
 * - Page refresh
 * - New conversations
 *
 * Use cases:
 * - "I want to keep tracking this metric across sessions"
 * - Resume context where you left off
 */
export function usePinnedWidgets(
  options: UsePinnedWidgetsOptions = {}
): UsePinnedWidgetsResult {
  const { onLoad } = options
  const [pinnedWidgets, setPinnedWidgets] = useState<WidgetConfig[]>([])

  // Load from storage on mount
  useEffect(() => {
    const loaded = loadFromStorage()
    setPinnedWidgets(loaded)

    if (loaded.length > 0 && onLoad) {
      onLoad(loaded)
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Save a widget to persistent storage
  const savePinnedWidget = useCallback((widget: WidgetConfig) => {
    setPinnedWidgets(prev => {
      // Check if already exists
      const exists = prev.some(w => w.id === widget.id)
      if (exists) {
        // Update existing
        const updated = prev.map(w =>
          w.id === widget.id ? serializeWidget(widget) : w
        )
        saveToStorage(updated)
        return updated
      } else {
        // Add new
        const updated = [...prev, serializeWidget(widget)]
        saveToStorage(updated)
        return updated
      }
    })
  }, [])

  // Remove a widget from persistent storage
  const removePinnedWidget = useCallback((widgetId: string) => {
    setPinnedWidgets(prev => {
      const updated = prev.filter(w => w.id !== widgetId)
      saveToStorage(updated)
      return updated
    })
  }, [])

  // Check if a widget is persisted
  const isWidgetPersisted = useCallback(
    (widgetId: string) => pinnedWidgets.some(w => w.id === widgetId),
    [pinnedWidgets]
  )

  // Clear all persisted widgets
  const clearPinnedWidgets = useCallback(() => {
    setPinnedWidgets([])
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  return {
    pinnedWidgets,
    savePinnedWidget,
    removePinnedWidget,
    isWidgetPersisted,
    clearPinnedWidgets,
  }
}
