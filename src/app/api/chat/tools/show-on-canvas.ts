import { z } from 'zod'
import { defineTool } from './types'
import type { WidgetType, CanvasAction, CanvasActionPayload, WidgetConfig } from '@/lib/widgets/types'

/**
 * Schema for a widget to display on the canvas
 */
const widgetSchema = z.object({
  type: z.enum([
    'fitness',
    'pmc-chart',
    'sessions',
    'sleep',
    'power-curve',
    'workout-card',
    'chart'
  ]).describe('Type of widget to display'),
  insight: z.string().describe('Explain what the user should notice or why you are showing this data'),
  sourceReference: z.string().optional().describe('Wiki article slug to cite as sports science reference'),
  expandable: z.boolean().optional().default(true).describe('Whether widget content is expandable (collapsed shows insight only)'),
  config: z.record(z.string(), z.unknown()).optional().describe('Optional widget-specific configuration'),
})

type WidgetInput = z.infer<typeof widgetSchema>

const inputSchema = z.object({
  action: z.enum(['show', 'add', 'compare']).describe(
    'Action to perform: show (replace canvas), add (append to existing), compare (side-by-side layout)'
  ),
  widgets: z.array(widgetSchema).min(1).max(4).describe('Widgets to display (1-4)'),
  reason: z.string().describe('Brief explanation of why you are showing these widgets'),
})

type Input = z.infer<typeof inputSchema>

interface Output {
  success: boolean
  canvasAction: CanvasActionPayload
  displayedReason: string
}

/**
 * Get a human-readable title for a widget type
 */
function getWidgetTitle(type: WidgetType): string {
  const titles: Record<WidgetType, string> = {
    'fitness': 'Current Fitness',
    'pmc-chart': 'Performance Management',
    'sessions': 'Recent Sessions',
    'sleep': 'Sleep Metrics',
    'power-curve': 'Power Curve',
    'workout-card': 'Workout',
    'chart': 'Chart',
  }
  return titles[type] || type
}

/**
 * Convert AI tool input to WidgetConfig
 */
function toWidgetConfig(input: WidgetInput, index: number): WidgetConfig {
  return {
    id: `${input.type}-${Date.now()}-${index}`,
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
}

export const showOnCanvas = defineTool<Input, Output>({
  description: `Display widgets on the canvas to support your coaching conversation.

**Actions:**
- show: Replace canvas with these widgets
- add: Add widgets to existing canvas
- compare: Side-by-side comparison layout

**Always provide insights:** Don't just show data - explain what matters.
- Bad: "Showing your fitness"
- Good: "Your CTL of 72 indicates strong aerobic base - you're ready for intensity work"

**Available widget types:**
- fitness: CTL, ATL, TSB metrics
- pmc-chart: Performance Management Chart trends
- sessions: Recent training sessions
- power-curve: Power duration curve
- sleep: Sleep metrics
- workout-card: Structured workout details
- chart: Custom data visualizations

**When to use:**
- User asks to "show", "display", or "see" data
- Discussing fitness trends (show pmc-chart)
- Recommending a workout (show workout-card)
- Analyzing power profile (show power-curve)
- Comparing metrics (use 'compare' action)`,

  inputSchema,

  execute: async ({ action, widgets, reason }) => {
    // Convert input widgets to WidgetConfig format
    const widgetConfigs = widgets.map((w, i) => toWidgetConfig(w, i))

    // Determine layout based on action and widget count
    const layout = action === 'compare'
      ? 'compare'
      : widgetConfigs.length > 1
        ? 'stacked'
        : 'single'

    return {
      success: true,
      canvasAction: {
        action: action as CanvasAction,
        widgets: widgetConfigs,
        reason,
      },
      displayedReason: reason,
    }
  },
})
