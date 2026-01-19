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
    case 'show':
      return {
        widgets: action.widgets,
        layout: determineLayout('show', action.widgets.length),
      }

    case 'add':
      const combinedWidgets = [...state.widgets, ...action.widgets]
      return {
        widgets: combinedWidgets,
        layout: determineLayout('add', combinedWidgets.length),
      }

    case 'compare':
      return {
        widgets: action.widgets.slice(0, 2), // Max 2 for comparison
        layout: 'compare',
      }

    case 'clear':
      return {
        widgets: [],
        layout: 'single',
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

  return {
    state,
    processCanvasAction,
    clearCanvas,
    resetCanvas,
    setWidgetError,
    showWidgets,
    addWidgets,
  }
}
