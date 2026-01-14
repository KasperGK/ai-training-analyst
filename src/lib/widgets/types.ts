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

export interface WidgetConfig {
  id: string
  type: WidgetType
  title: string
  description: string
  // Optional parameters the AI can pass
  params?: Record<string, unknown>
}

export interface CanvasState {
  widgets: WidgetConfig[]
  layout: 'single' | 'grid' | 'stacked'
}

// Initial canvas state
export const DEFAULT_CANVAS_STATE: CanvasState = {
  widgets: [
    { id: 'fitness-default', type: 'fitness', title: 'Current Fitness', description: 'CTL, ATL, TSB metrics' }
  ],
  layout: 'single'
}
