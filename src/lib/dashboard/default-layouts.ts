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
  // Sessions below chart
  createLayoutItem('sessions', 0, 6, 8, 4),
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
  // AI Coach below chart
  createLayoutItem('ai-coach', 0, 6, 8, 6),
  // Sessions below AI Coach
  createLayoutItem('sessions', 0, 12, 8, 4),
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
  // AI Coach
  createLayoutItem('ai-coach', 0, 8, 4, 6),
  // Sessions
  createLayoutItem('sessions', 0, 14, 4, 4),
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
