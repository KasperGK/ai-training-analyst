import { z } from 'zod'
import { defineTool } from './types'
import type { CanvasAction, CanvasActionPayload } from '@/lib/widgets/types'
import { toWidgetConfig } from '@/lib/widgets/config-factory'

/**
 * Chart-specific configuration schema for overlay charts
 */
const chartConfigSchema = z.object({
  chartType: z.enum(['line', 'area', 'overlay']).default('overlay').describe('Chart visualization type'),
  sessionId: z.string().describe('Session ID to fetch data for, or "latest" for most recent session'),
  metrics: z.array(z.enum(['power', 'heartRate', 'cadence', 'speed', 'altitude']))
    .min(1)
    .max(3)
    .describe('Metrics to display (power on left axis, others on right axis)'),
  timeRange: z.object({
    start: z.number(),
    end: z.number(),
  }).optional().describe('Optional time range in seconds to display'),
}).describe('Configuration for chart widget')

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
    'chart',
    'race-history',
    'competitor-analysis',
    'plan-proposal',
    'plan-projection',
    'training-calendar',
    'session-analysis'
  ]).describe('Type of widget to display'),
  insight: z.string().describe('Explain what the user should notice or why you are showing this data'),
  sourceReference: z.string().optional().describe('Wiki article slug to cite as sports science reference'),
  expandable: z.boolean().optional().default(true).describe('Whether widget content is expandable (collapsed shows insight only)'),
  config: z.record(z.string(), z.unknown()).optional().describe('Optional widget-specific configuration'),
  chartConfig: chartConfigSchema.optional().describe('Required for chart widgets: specify sessionId and metrics'),
})

const inputSchema = z.object({
  action: z.enum(['show', 'add', 'compare']).describe(
    'Action: "show" clears canvas and displays these widgets (replaces everything except pinned). "add" appends widgets alongside what is already on canvas. "compare" replaces canvas with exactly 2 widgets side-by-side. Default to "show" unless user says "also show" or "add".'
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

export const showOnCanvas = defineTool<Input, Output>({
  description: `Display widgets on the canvas to support your coaching conversation.

**Always provide insights:** Don't just show data - explain what matters.
- Bad: "Showing your fitness"
- Good: "Your CTL of 72 indicates strong aerobic base - you're ready for intensity work"

**Widget types:** fitness, pmc-chart, sessions, power-curve, sleep, workout-card, chart, race-history, competitor-analysis, plan-proposal, plan-projection, training-calendar, session-analysis

**Chart widget:** Requires chartConfig with sessionId ("latest" or ID) and metrics array (["power", "heartRate"], etc.). Power on left Y-axis, others on right.

**Data widgets:** race-history/competitor-analysis need config from analyzeRace. plan-proposal/plan-projection need config from proposePlan. session-analysis needs config with session, analysis, comparison, personalBests.`,

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
