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
  | 'race-history'
  | 'competitor-analysis'

/**
 * Chart-specific types for overlay visualizations
 */
export type ChartMetric = 'power' | 'heartRate' | 'cadence' | 'speed' | 'altitude'

export interface ChartSeries {
  key: ChartMetric
  name: string
  color: string
  yAxisId: 'left' | 'right'
  type?: 'line' | 'area'
}

export interface YAxisConfig {
  id: 'left' | 'right'
  label: string
  unit: string
  domain?: [number | 'auto', number | 'auto']
}

export interface ChartAnnotation {
  id: string
  type: 'line' | 'area'
  x?: number
  xStart?: number
  xEnd?: number
  label: string
  color?: string
}

export interface ChartConfig {
  chartType: 'line' | 'area' | 'overlay'
  sessionId: string
  metrics: ChartMetric[]
  /** Optional: specific time range to display (in seconds from start) */
  timeRange?: { start: number; end: number }
  /** Annotations like intervals or markers */
  annotations?: ChartAnnotation[]
}

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
  /** Chart-specific configuration (when type is 'chart') */
  chartConfig?: ChartConfig
  /** Whether the widget is pinned (persists across AI messages) */
  isPinned?: boolean
}

/**
 * Type guard to check if widget has chart config
 */
export function isChartWidget(widget: WidgetConfig): widget is WidgetConfig & { chartConfig: ChartConfig } {
  return widget.type === 'chart' && widget.chartConfig !== undefined
}

export type CanvasAction = 'show' | 'add' | 'compare' | 'clear'

/**
 * Widget icon type for status badges
 */
export type WidgetIcon = 'fitness' | 'chart' | 'sessions' | 'power' | 'sleep' | 'workout' | 'race' | 'competitors'

export interface CanvasState {
  widgets: WidgetConfig[]
  layout: 'single' | 'grid' | 'stacked' | 'compare'
  /** IDs of pinned widgets that persist across AI messages and conversations */
  pinnedWidgetIds: Set<string>
  /** History of dismissed widgets for restoration */
  dismissedWidgets: WidgetConfig[]
  /** Order of widget IDs for display (newest last) */
  widgetOrder: string[]
  /** Currently highlighted widget ID (for chapter navigation) */
  highlightedWidgetId: string | null
  /** Selected tab ID: null = "All" (show grid), string = single widget */
  selectedTabId: string | null
}

/**
 * Payload for canvas actions from AI tools
 */
export interface CanvasActionPayload {
  action: CanvasAction
  widgets: WidgetConfig[]
  reason?: string
}

/** Map widget type to icon */
export function getWidgetIcon(type: WidgetType): WidgetIcon {
  const iconMap: Record<WidgetType, WidgetIcon> = {
    'fitness': 'fitness',
    'pmc-chart': 'chart',
    'sessions': 'sessions',
    'sleep': 'sleep',
    'power-curve': 'power',
    'workout-card': 'workout',
    'chart': 'chart',
    'race-history': 'race',
    'competitor-analysis': 'competitors',
  }
  return iconMap[type] || 'chart'
}

// Initial canvas state
export const DEFAULT_CANVAS_STATE: CanvasState = {
  widgets: [],
  layout: 'single',
  pinnedWidgetIds: new Set<string>(),
  dismissedWidgets: [],
  widgetOrder: [],
  highlightedWidgetId: null,
  selectedTabId: null,
}
