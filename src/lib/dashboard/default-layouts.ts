import type { Layout, LayoutItem, ResponsiveLayouts } from 'react-grid-layout/legacy'
import { getWidgetConstraints } from './widget-registry'

/**
 * Create a layout item with widget constraints
 */
function createLayoutItem(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number
): LayoutItem {
  return {
    i: id,
    x,
    y,
    w,
    h,
    ...getWidgetConstraints(id),
  }
}

/**
 * Large screen layout (lg: 12 columns)
 * Main layout with AI Coach on the right
 */
const lgLayout: LayoutItem[] = [
  // Top row: 4 metric cards + sleep
  createLayoutItem('fitness', 0, 0, 2, 2),
  createLayoutItem('fatigue', 2, 0, 2, 2),
  createLayoutItem('form', 4, 0, 2, 2),
  createLayoutItem('sleep', 6, 0, 2, 2),
  // Second row: upload + chart
  createLayoutItem('upload', 0, 2, 2, 2),
  createLayoutItem('chart', 2, 2, 6, 4),
  // Insights next to sessions
  createLayoutItem('insights', 0, 4, 2, 4),
  // Sessions below chart
  createLayoutItem('sessions', 2, 6, 6, 4),
  // AI Coach on the right spanning full height
  createLayoutItem('ai-coach', 8, 0, 4, 10),
]

/**
 * Medium screen layout (md: 8 columns)
 * AI Coach moves below main content
 */
const mdLayout: LayoutItem[] = [
  // Top row: 4 metric cards
  createLayoutItem('fitness', 0, 0, 2, 2),
  createLayoutItem('fatigue', 2, 0, 2, 2),
  createLayoutItem('form', 4, 0, 2, 2),
  createLayoutItem('sleep', 6, 0, 2, 2),
  // Second row: upload + chart
  createLayoutItem('upload', 0, 2, 2, 2),
  createLayoutItem('chart', 2, 2, 6, 4),
  // Insights below upload
  createLayoutItem('insights', 0, 4, 2, 4),
  // Sessions next to insights
  createLayoutItem('sessions', 2, 6, 6, 4),
  // AI Coach below
  createLayoutItem('ai-coach', 0, 10, 8, 6),
]

/**
 * Small screen layout (sm: 4 columns)
 * Stacked layout for mobile
 */
const smLayout: LayoutItem[] = [
  // Top rows: 2x2 metrics
  createLayoutItem('fitness', 0, 0, 2, 2),
  createLayoutItem('fatigue', 2, 0, 2, 2),
  createLayoutItem('form', 0, 2, 2, 2),
  createLayoutItem('sleep', 2, 2, 2, 2),
  createLayoutItem('upload', 0, 4, 2, 2),
  // Chart
  createLayoutItem('chart', 0, 6, 4, 4),
  // Insights
  createLayoutItem('insights', 0, 10, 4, 4),
  // AI Coach
  createLayoutItem('ai-coach', 0, 14, 4, 6),
  // Sessions
  createLayoutItem('sessions', 0, 20, 4, 4),
]

/**
 * Default responsive layouts
 */
export const DEFAULT_LAYOUTS: ResponsiveLayouts = {
  lg: lgLayout,
  md: mdLayout,
  sm: smLayout,
}

/**
 * Get default layout for a specific breakpoint
 */
export const getDefaultLayout = (
  breakpoint: string
): Layout | undefined => DEFAULT_LAYOUTS[breakpoint]
