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
  // Top row: 4 metric cards
  createLayoutItem('fitness', 0, 0, 2, 2),
  createLayoutItem('fatigue', 2, 0, 2, 2),
  createLayoutItem('form', 4, 0, 2, 2),
  createLayoutItem('upload', 6, 0, 2, 2),
  // Chart below metrics
  createLayoutItem('chart', 0, 2, 8, 4),
  // Insights next to sessions
  createLayoutItem('insights', 0, 6, 3, 4),
  // Sessions below chart
  createLayoutItem('sessions', 3, 6, 5, 4),
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
  createLayoutItem('upload', 6, 0, 2, 2),
  // Chart below metrics
  createLayoutItem('chart', 0, 2, 8, 4),
  // Insights below chart
  createLayoutItem('insights', 0, 6, 4, 4),
  // Sessions next to insights
  createLayoutItem('sessions', 4, 6, 4, 4),
  // AI Coach below
  createLayoutItem('ai-coach', 0, 10, 8, 6),
]

/**
 * Small screen layout (sm: 4 columns)
 * Stacked layout for mobile
 */
const smLayout: LayoutItem[] = [
  // Top row: 2x2 metrics
  createLayoutItem('fitness', 0, 0, 2, 2),
  createLayoutItem('fatigue', 2, 0, 2, 2),
  createLayoutItem('form', 0, 2, 2, 2),
  createLayoutItem('upload', 2, 2, 2, 2),
  // Chart
  createLayoutItem('chart', 0, 4, 4, 4),
  // Insights
  createLayoutItem('insights', 0, 8, 4, 4),
  // AI Coach
  createLayoutItem('ai-coach', 0, 12, 4, 6),
  // Sessions
  createLayoutItem('sessions', 0, 18, 4, 4),
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
