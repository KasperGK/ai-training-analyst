/**
 * Widget System Types
 *
 * Defines the structure for widgets that can be displayed on the AI Coach canvas.
 */

export type WidgetType =
  | 'fitness'
  | 'pmc-chart'
  | 'sessions'
  | 'sleep'
  | 'power-curve'
  | 'workout-card'
  | 'chart'

/**
 * Context provided by AI when displaying a widget
 * Enables insight-first display where the AI explains what matters
 */
export interface WidgetContext {
  /** AI-generated insight explaining what to notice */
  insightSummary: string
  /** Optional wiki article slug for sports science citation */
  sourceReference?: string
  /** Whether the widget content is expandable (collapsed by default) */
  expandable: boolean
  /** Related goal IDs for goal-aware insights */
  goalIds?: string[]
}

export interface WidgetConfig {
  id: string
  type: WidgetType
  title: string
  description: string
  /** AI-provided context explaining why this widget is shown */
  context?: WidgetContext
  /** Error message if widget loading failed */
  error?: string
  /** Optional parameters the AI can pass */
  params?: Record<string, unknown>
}

export type CanvasAction = 'show' | 'add' | 'compare' | 'clear'

export interface CanvasState {
  widgets: WidgetConfig[]
  layout: 'single' | 'grid' | 'stacked' | 'compare'
}

/**
 * Payload for canvas actions from AI tools
 */
export interface CanvasActionPayload {
  action: CanvasAction
  widgets: WidgetConfig[]
  reason?: string
}

// Initial canvas state
export const DEFAULT_CANVAS_STATE: CanvasState = {
  widgets: [
    { id: 'fitness-default', type: 'fitness', title: 'Current Fitness', description: 'CTL, ATL, TSB metrics' }
  ],
  layout: 'single'
}
