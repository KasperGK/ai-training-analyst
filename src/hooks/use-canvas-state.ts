import { useReducer, useCallback } from 'react'
import type {
  CanvasState,
  CanvasAction,
  CanvasActionPayload,
  WidgetConfig,
} from '@/lib/widgets/types'
import { DEFAULT_CANVAS_STATE } from '@/lib/widgets/types'

/**
 * Action types for the canvas reducer
 */
type CanvasReducerAction =
  | { type: 'show'; widgets: WidgetConfig[] }
  | { type: 'add'; widgets: WidgetConfig[] }
  | { type: 'compare'; widgets: WidgetConfig[] }
  | { type: 'clear' }
  | { type: 'clear_non_pinned' }
  | { type: 'reset' }
  | { type: 'set_error'; widgetId: string; error: string }
  | { type: 'dismiss'; widgetId: string }
  | { type: 'pin'; widgetId: string }
  | { type: 'unpin'; widgetId: string }
  | { type: 'restore'; widget: WidgetConfig }
  | { type: 'clear_history' }
  | { type: 'highlight_widget'; widgetId: string | null }
  | { type: 'load_pinned'; widgets: WidgetConfig[] }
  | { type: 'select_tab'; widgetId: string | null }

/**
 * Determine layout based on widget count and action
 */
function determineLayout(
  action: CanvasAction,
  widgetCount: number
): CanvasState['layout'] {
  if (action === 'compare') return 'compare'
  if (widgetCount === 0) return 'single'
  if (widgetCount === 1) return 'single'
  if (widgetCount === 2) return 'grid'
  return 'stacked'
}

/**
 * Canvas state reducer
 */
function canvasReducer(
  state: CanvasState,
  action: CanvasReducerAction
): CanvasState {
  switch (action.type) {
    case 'show': {
      // "Show" replaces all non-pinned widgets with new ones
      // Dismissed non-pinned widgets go to history for restoration
      const pinnedWidgets = state.widgets.filter(w => state.pinnedWidgetIds.has(w.id))
      const nonPinnedWidgets = state.widgets.filter(w => !state.pinnedWidgetIds.has(w.id))

      // Move non-pinned existing widgets to dismissed history (deduplicate by id)
      const existingDismissedIds = new Set(state.dismissedWidgets.map(w => w.id))
      const freshDismissals = nonPinnedWidgets.filter(w => !existingDismissedIds.has(w.id))
      const newDismissed = [...state.dismissedWidgets, ...freshDismissals]

      // Combine: pinned (preserved) + new widgets
      const allWidgets = [...pinnedWidgets, ...action.widgets]
      const widgetOrder = [...pinnedWidgets.map(w => w.id), ...action.widgets.map(w => w.id)]

      // Auto-select the first new widget's tab
      const newSelectedTab = action.widgets.length > 0 ? action.widgets[0].id : state.selectedTabId

      return {
        ...state,
        widgets: allWidgets,
        layout: determineLayout('show', allWidgets.length),
        widgetOrder,
        dismissedWidgets: newDismissed,
        highlightedWidgetId: null,
        selectedTabId: newSelectedTab,
      }
    }

    case 'add': {
      const combinedWidgets = [...state.widgets, ...action.widgets]
      const widgetOrder = [...state.widgetOrder, ...action.widgets.map(w => w.id)]

      return {
        ...state,
        widgets: combinedWidgets,
        layout: determineLayout('add', combinedWidgets.length),
        widgetOrder,
        highlightedWidgetId: null,
      }
    }

    case 'compare': {
      const compareWidgets = action.widgets.slice(0, 2) // Max 2 for comparison
      const widgetOrder = compareWidgets.map(w => w.id)
      return {
        ...state,
        widgets: compareWidgets,
        layout: 'compare',
        widgetOrder,
        highlightedWidgetId: null,
      }
    }

    case 'clear': {
      // Keep pinned widgets when clearing
      const pinnedWidgets = state.widgets.filter(w => state.pinnedWidgetIds.has(w.id))
      const widgetOrder = pinnedWidgets.map(w => w.id)

      return {
        ...state,
        widgets: pinnedWidgets,
        layout: pinnedWidgets.length > 0 ? determineLayout('show', pinnedWidgets.length) : 'single',
        widgetOrder,
        highlightedWidgetId: null,
      }
    }

    case 'clear_non_pinned': {
      // Clear all widgets except pinned ones, reset tab selection to grid view
      const pinnedOnly = state.widgets.filter(w => state.pinnedWidgetIds.has(w.id))
      return {
        ...state,
        widgets: pinnedOnly,
        selectedTabId: null,
        widgetOrder: pinnedOnly.map(w => w.id),
        layout: pinnedOnly.length > 0 ? determineLayout('show', pinnedOnly.length) : 'single',
        highlightedWidgetId: null,
        dismissedWidgets: [], // Clear history when switching conversations
      }
    }

    case 'reset':
      return DEFAULT_CANVAS_STATE

    case 'set_error':
      return {
        ...state,
        widgets: state.widgets.map((w) =>
          w.id === action.widgetId ? { ...w, error: action.error } : w
        ),
      }

    case 'dismiss': {
      const widgetToDismiss = state.widgets.find(w => w.id === action.widgetId)
      if (!widgetToDismiss) return state

      const newWidgets = state.widgets.filter(w => w.id !== action.widgetId)
      const newPinnedIds = new Set(state.pinnedWidgetIds)
      newPinnedIds.delete(action.widgetId)
      const newWidgetOrder = state.widgetOrder.filter(id => id !== action.widgetId)

      return {
        ...state,
        widgets: newWidgets,
        layout: determineLayout('show', newWidgets.length),
        pinnedWidgetIds: newPinnedIds,
        dismissedWidgets: [...state.dismissedWidgets, widgetToDismiss],
        widgetOrder: newWidgetOrder,
        highlightedWidgetId: state.highlightedWidgetId === action.widgetId
          ? null
          : state.highlightedWidgetId,
        // Clear tab selection if dismissed widget was selected
        selectedTabId: state.selectedTabId === action.widgetId
          ? null
          : state.selectedTabId,
      }
    }

    case 'pin': {
      const newPinnedIds = new Set(state.pinnedWidgetIds)
      newPinnedIds.add(action.widgetId)
      return {
        ...state,
        pinnedWidgetIds: newPinnedIds,
        widgets: state.widgets.map(w =>
          w.id === action.widgetId ? { ...w, isPinned: true } : w
        ),
      }
    }

    case 'unpin': {
      const newPinnedIds = new Set(state.pinnedWidgetIds)
      newPinnedIds.delete(action.widgetId)
      return {
        ...state,
        pinnedWidgetIds: newPinnedIds,
        widgets: state.widgets.map(w =>
          w.id === action.widgetId ? { ...w, isPinned: false } : w
        ),
      }
    }

    case 'restore': {
      const restoredWidget = action.widget
      const newWidgets = [...state.widgets, restoredWidget]
      const newWidgetOrder = [...state.widgetOrder, restoredWidget.id]

      return {
        ...state,
        widgets: newWidgets,
        layout: determineLayout('add', newWidgets.length),
        dismissedWidgets: state.dismissedWidgets.filter(w => w.id !== restoredWidget.id),
        widgetOrder: newWidgetOrder,
        highlightedWidgetId: restoredWidget.id,
      }
    }

    case 'clear_history':
      return {
        ...state,
        dismissedWidgets: [],
      }

    case 'highlight_widget':
      return {
        ...state,
        highlightedWidgetId: action.widgetId,
      }

    case 'load_pinned': {
      // Load pinned widgets (from localStorage on new conversation)
      if (action.widgets.length === 0) return state

      const existingIds = new Set(state.widgets.map(w => w.id))
      const newPinnedWidgets = action.widgets.filter(w => !existingIds.has(w.id))

      if (newPinnedWidgets.length === 0) return state

      const allWidgets = [...newPinnedWidgets, ...state.widgets]
      const newPinnedIds = new Set(state.pinnedWidgetIds)
      newPinnedWidgets.forEach(w => newPinnedIds.add(w.id))
      const widgetOrder = allWidgets.map(w => w.id)

      return {
        ...state,
        widgets: allWidgets,
        pinnedWidgetIds: newPinnedIds,
        layout: determineLayout('show', allWidgets.length),
        widgetOrder,
      }
    }

    case 'select_tab':
      return {
        ...state,
        selectedTabId: action.widgetId,
        highlightedWidgetId: null, // Clear highlight when selecting tab
      }

    default:
      return state
  }
}

/**
 * Hook for managing canvas state with support for AI tool actions
 */
export function useCanvasState(initialState?: CanvasState) {
  const [state, dispatch] = useReducer(
    canvasReducer,
    initialState ?? DEFAULT_CANVAS_STATE
  )

  /**
   * Process a canvas action from the AI tool
   */
  const processCanvasAction = useCallback((payload: CanvasActionPayload) => {
    switch (payload.action) {
      case 'show':
        dispatch({ type: 'show', widgets: payload.widgets })
        break
      case 'add':
        dispatch({ type: 'add', widgets: payload.widgets })
        break
      case 'compare':
        dispatch({ type: 'compare', widgets: payload.widgets })
        break
      case 'clear':
        dispatch({ type: 'clear' })
        break
    }
  }, [])

  /**
   * Clear all widgets from the canvas
   */
  const clearCanvas = useCallback(() => {
    dispatch({ type: 'clear' })
  }, [])

  /**
   * Clear non-pinned widgets (for conversation switching)
   */
  const clearNonPinnedWidgets = useCallback(() => {
    dispatch({ type: 'clear_non_pinned' })
  }, [])

  /**
   * Reset canvas to default state
   */
  const resetCanvas = useCallback(() => {
    dispatch({ type: 'reset' })
  }, [])

  /**
   * Set error on a specific widget
   */
  const setWidgetError = useCallback((widgetId: string, error: string) => {
    dispatch({ type: 'set_error', widgetId, error })
  }, [])

  /**
   * Show specific widgets (replace current)
   */
  const showWidgets = useCallback((widgets: WidgetConfig[]) => {
    dispatch({ type: 'show', widgets })
  }, [])

  /**
   * Add widgets to existing canvas
   */
  const addWidgets = useCallback((widgets: WidgetConfig[]) => {
    dispatch({ type: 'add', widgets })
  }, [])

  /**
   * Dismiss a widget (remove from canvas, add to history)
   */
  const dismissWidget = useCallback((widgetId: string) => {
    dispatch({ type: 'dismiss', widgetId })
  }, [])

  /**
   * Pin a widget (persists across AI messages and conversations)
   */
  const pinWidget = useCallback((widgetId: string) => {
    dispatch({ type: 'pin', widgetId })
  }, [])

  /**
   * Unpin a widget
   */
  const unpinWidget = useCallback((widgetId: string) => {
    dispatch({ type: 'unpin', widgetId })
  }, [])

  /**
   * Restore a dismissed widget
   */
  const restoreWidget = useCallback((widget: WidgetConfig) => {
    dispatch({ type: 'restore', widget })
  }, [])

  /**
   * Clear dismissed widget history
   */
  const clearHistory = useCallback(() => {
    dispatch({ type: 'clear_history' })
  }, [])

  /**
   * Highlight a widget in the grid (for chapter navigation)
   */
  const highlightWidget = useCallback((widgetId: string | null) => {
    dispatch({ type: 'highlight_widget', widgetId })

    // Clear highlight after animation
    if (widgetId) {
      setTimeout(() => {
        dispatch({ type: 'highlight_widget', widgetId: null })
      }, 2000)
    }
  }, [])

  /**
   * Load pinned widgets (from localStorage on new conversation)
   */
  const loadPinnedWidgets = useCallback((widgets: WidgetConfig[]) => {
    dispatch({ type: 'load_pinned', widgets })
  }, [])

  /**
   * Select a tab (null = "All" to show grid, widgetId = show single widget)
   */
  const selectTab = useCallback((widgetId: string | null) => {
    dispatch({ type: 'select_tab', widgetId })
  }, [])

  return {
    state,
    processCanvasAction,
    clearCanvas,
    clearNonPinnedWidgets,
    resetCanvas,
    setWidgetError,
    showWidgets,
    addWidgets,
    dismissWidget,
    pinWidget,
    unpinWidget,
    restoreWidget,
    clearHistory,
    highlightWidget,
    loadPinnedWidgets,
    selectTab,
  }
}
