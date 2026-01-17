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
 * Dashboard layout with insights panel on right
 */
const lgLayout: LayoutItem[] = [
  // Top row: 4 metric cards (fitness, fatigue, form, upload)
  createLayoutItem('fitness', 0, 0, 2, 2),
  createLayoutItem('fatigue', 2, 0, 2, 2),
  createLayoutItem('form', 4, 0, 2, 2),
  createLayoutItem('upload', 6, 0, 2, 2),
  // Insights panel on right spanning multiple rows
  createLayoutItem('insights', 8, 0, 4, 6),
  // Second row: sleep + sessions
  createLayoutItem('sleep', 0, 2, 2, 4),
  createLayoutItem('sessions', 2, 2, 6, 4),
  // PMC chart at bottom
  createLayoutItem('chart', 0, 6, 12, 4),
]

/**
 * Medium screen layout (md: 8 columns)
 */
const mdLayout: LayoutItem[] = [
  // Top row: 4 metric cards
  createLayoutItem('fitness', 0, 0, 2, 2),
  createLayoutItem('fatigue', 2, 0, 2, 2),
  createLayoutItem('form', 4, 0, 2, 2),
  createLayoutItem('upload', 6, 0, 2, 2),
  // Second row: sleep + sessions
  createLayoutItem('sleep', 0, 2, 2, 4),
  createLayoutItem('sessions', 2, 2, 6, 4),
  // Insights
  createLayoutItem('insights', 0, 6, 8, 4),
  // Chart at bottom
  createLayoutItem('chart', 0, 10, 8, 4),
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
  createLayoutItem('upload', 2, 2, 2, 2),
  // Sleep
  createLayoutItem('sleep', 0, 4, 4, 3),
  // Insights
  createLayoutItem('insights', 0, 7, 4, 4),
  // Sessions
  createLayoutItem('sessions', 0, 11, 4, 4),
  // Chart
  createLayoutItem('chart', 0, 15, 4, 4),
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
