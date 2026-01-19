import { useReducer, useCallback } from 'react'
import type {
  CanvasState,
  CanvasAction,
  CanvasActionPayload,
  WidgetConfig
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
  | { type: 'reset' }
  | { type: 'set_error'; widgetId: string; error: string }
  | { type: 'dismiss'; widgetId: string }
  | { type: 'pin'; widgetId: string }
  | { type: 'unpin'; widgetId: string }
  | { type: 'restore'; widget: WidgetConfig }
  | { type: 'clear_history' }

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
      // Preserve pinned widgets when showing new widgets
      const pinnedWidgets = state.widgets.filter(w => state.pinnedWidgetIds.has(w.id))
      const newWidgetIds = new Set(action.widgets.map(w => w.id))
      // Filter out pinned widgets that are also in the new set (avoid duplicates)
      const pinnedToKeep = pinnedWidgets.filter(w => !newWidgetIds.has(w.id))
      const allWidgets = [...pinnedToKeep, ...action.widgets]
      return {
        ...state,
        widgets: allWidgets,
        layout: determineLayout('show', allWidgets.length),
      }
    }

    case 'add': {
      const combinedWidgets = [...state.widgets, ...action.widgets]
      return {
        ...state,
        widgets: combinedWidgets,
        layout: determineLayout('add', combinedWidgets.length),
      }
    }

    case 'compare':
      return {
        ...state,
        widgets: action.widgets.slice(0, 2), // Max 2 for comparison
        layout: 'compare',
      }

    case 'clear': {
      // Keep pinned widgets when clearing
      const pinnedWidgets = state.widgets.filter(w => state.pinnedWidgetIds.has(w.id))
      return {
        ...state,
        widgets: pinnedWidgets,
        layout: pinnedWidgets.length > 0 ? determineLayout('show', pinnedWidgets.length) : 'single',
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

      return {
        ...state,
        widgets: newWidgets,
        layout: determineLayout('show', newWidgets.length),
        pinnedWidgetIds: newPinnedIds,
        dismissedWidgets: [...state.dismissedWidgets, widgetToDismiss],
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
      return {
        ...state,
        widgets: newWidgets,
        layout: determineLayout('add', newWidgets.length),
        dismissedWidgets: state.dismissedWidgets.filter(w => w.id !== restoredWidget.id),
      }
    }

    case 'clear_history':
      return {
        ...state,
        dismissedWidgets: [],
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
   * Pin a widget (persists across AI messages)
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

  return {
    state,
    processCanvasAction,
    clearCanvas,
    resetCanvas,
    setWidgetError,
    showWidgets,
    addWidgets,
    dismissWidget,
    pinWidget,
    unpinWidget,
    restoreWidget,
    clearHistory,
  }
}
