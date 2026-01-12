import type { WidgetDefinition } from '@/types/dashboard-grid'

/**
 * Widget Registry
 *
 * Register all available dashboard widgets here.
 * Each widget defines its size constraints and default dimensions.
 *
 * To add a new widget:
 * 1. Add entry here with id, name, and size constraints
 * 2. Add default position in default-layouts.ts
 * 3. Create component and add to page.tsx
 */
export const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
  fitness: {
    id: 'fitness',
    name: 'Fitness (CTL)',
    description: '42-day training load',
    minW: 2,
    minH: 2,
    maxW: 4,
    maxH: 4,
    defaultW: 2,
    defaultH: 2,
  },
  fatigue: {
    id: 'fatigue',
    name: 'Fatigue (ATL)',
    description: '7-day training load',
    minW: 2,
    minH: 2,
    maxW: 4,
    maxH: 4,
    defaultW: 2,
    defaultH: 2,
  },
  form: {
    id: 'form',
    name: 'Form (TSB)',
    description: 'Accumulated fatigue',
    minW: 2,
    minH: 2,
    maxW: 4,
    maxH: 4,
    defaultW: 2,
    defaultH: 2,
  },
  sleep: {
    id: 'sleep',
    name: 'Sleep',
    description: 'Last night\'s sleep from Garmin',
    minW: 2,
    minH: 2,
    maxW: 4,
    maxH: 4,
    defaultW: 2,
    defaultH: 2,
  },
  upload: {
    id: 'upload',
    name: 'Upload',
    description: 'Drop .FIT file',
    minW: 2,
    minH: 2,
    maxW: 4,
    maxH: 4,
    defaultW: 2,
    defaultH: 2,
  },
  chart: {
    id: 'chart',
    name: 'Performance Management',
    description: 'Fitness, fatigue, and form over time',
    minW: 4,
    minH: 3,
    maxW: 12,
    maxH: 8,
    defaultW: 8,
    defaultH: 4,
  },
  sessions: {
    id: 'sessions',
    name: 'Recent Sessions',
    description: 'Training session history',
    minW: 4,
    minH: 3,
    maxW: 12,
    maxH: 10,
    defaultW: 8,
    defaultH: 4,
  },
  'ai-coach': {
    id: 'ai-coach',
    name: 'AI Coach',
    description: 'Training assistant',
    minW: 3,
    minH: 4,
    maxW: 8,
    maxH: 12,
    defaultW: 4,
    defaultH: 10,
  },
}

/**
 * Get all registered widget IDs
 */
export const getWidgetIds = (): string[] => Object.keys(WIDGET_REGISTRY)

/**
 * Get widget definition by ID
 */
export const getWidget = (id: string): WidgetDefinition | undefined =>
  WIDGET_REGISTRY[id]

/**
 * Get size constraints for a widget (for use in layout items)
 */
export const getWidgetConstraints = (
  id: string
): { minW?: number; minH?: number; maxW?: number; maxH?: number } => {
  const widget = WIDGET_REGISTRY[id]
  if (!widget) return {}
  return {
    minW: widget.minW,
    minH: widget.minH,
    maxW: widget.maxW,
    maxH: widget.maxH,
  }
}
