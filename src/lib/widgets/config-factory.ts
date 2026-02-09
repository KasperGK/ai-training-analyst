import type { WidgetType, WidgetConfig, ChartMetric } from './types'

/**
 * Get a human-readable title for a widget type.
 * Shared between server tool (show-on-canvas.ts) and client extraction (coach-content.tsx).
 */
export function getWidgetTitle(type: WidgetType): string {
  const titles: Record<WidgetType, string> = {
    'fitness': 'Current Fitness',
    'pmc-chart': 'Performance Management',
    'sessions': 'Recent Sessions',
    'sleep': 'Sleep Metrics',
    'power-curve': 'Power Curve',
    'workout-card': 'Workout',
    'chart': 'Chart',
    'race-history': 'Race History',
    'competitor-analysis': 'Competitor Analysis',
    'plan-proposal': 'Training Plan Proposal',
    'plan-projection': 'Fitness Projection',
    'training-calendar': 'Training Calendar',
    'session-analysis': 'Session Analysis',
  }
  return titles[type] || type
}

/**
 * Widget input shape matching the AI tool's widget schema.
 * Used to convert raw tool input into WidgetConfig on both server and client.
 */
export interface WidgetInput {
  type: string
  insight: string
  sourceReference?: string
  expandable?: boolean
  config?: Record<string, unknown>
  chartConfig?: {
    chartType?: string
    sessionId: string
    metrics: string[]
    timeRange?: { start: number; end: number }
  }
}

/**
 * Convert AI tool input to WidgetConfig.
 * Shared between server tool (show-on-canvas.ts) and client extraction (coach-content.tsx).
 */
export function toWidgetConfig(input: WidgetInput, index: number): WidgetConfig {
  const config: WidgetConfig = {
    id: `${input.type}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    type: input.type as WidgetType,
    title: getWidgetTitle(input.type as WidgetType),
    description: '',
    context: {
      insightSummary: input.insight,
      sourceReference: input.sourceReference,
      expandable: input.expandable ?? true,
    },
    params: input.config,
  }

  // Add chart-specific configuration if present
  if (input.type === 'chart' && input.chartConfig) {
    config.chartConfig = {
      chartType: (input.chartConfig.chartType as 'line' | 'area' | 'overlay') || 'overlay',
      sessionId: input.chartConfig.sessionId,
      metrics: input.chartConfig.metrics as ChartMetric[],
      timeRange: input.chartConfig.timeRange,
    }
    // Generate a more descriptive title for chart widgets
    const metricNames = input.chartConfig.metrics.map(m =>
      m === 'heartRate' ? 'HR' : m.charAt(0).toUpperCase() + m.slice(1)
    ).join(' + ')
    config.title = `${metricNames} Overlay`
  }

  return config
}
