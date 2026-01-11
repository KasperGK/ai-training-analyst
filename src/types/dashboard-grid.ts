import type { Layout, LayoutItem, ResponsiveLayouts as RGLResponsiveLayouts } from 'react-grid-layout'

// Widget definition - extensible for future widgets
export interface WidgetDefinition {
  id: string
  name: string
  description?: string
  minW: number
  minH: number
  maxW?: number
  maxH?: number
  defaultW: number
  defaultH: number
}

// Re-export react-grid-layout types for convenience
export type { Layout, LayoutItem }

// Dashboard-specific layout item (with string id)
export interface DashboardLayoutItem {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
}

// Use react-grid-layout's ResponsiveLayouts type
export type ResponsiveLayouts = RGLResponsiveLayouts<'lg' | 'md' | 'sm'>

// Grid configuration constants
export const GRID_BREAKPOINTS = { lg: 1200, md: 996, sm: 768 }
export const GRID_COLS = { lg: 12, md: 8, sm: 4 }
export const GRID_ROW_HEIGHT = 80
export const GRID_MARGIN: [number, number] = [16, 16]
export const GRID_CONTAINER_PADDING: [number, number] = [0, 0]
