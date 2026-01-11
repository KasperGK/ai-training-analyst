'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'
import type { Layout, ResponsiveLayouts } from 'react-grid-layout/legacy'
import {
  GRID_BREAKPOINTS,
  GRID_COLS,
  GRID_ROW_HEIGHT,
  GRID_MARGIN,
  GRID_CONTAINER_PADDING,
} from '@/types/dashboard-grid'

// Create width-aware responsive grid
const ResponsiveGridLayout = WidthProvider(Responsive)

interface DashboardGridProps {
  layouts: ResponsiveLayouts
  onLayoutChange: (currentLayout: Layout, allLayouts: ResponsiveLayouts) => void
  children: React.ReactNode
  className?: string
}

/**
 * Dashboard Grid Component
 *
 * Wraps children in a react-grid-layout responsive grid.
 * Each child must have a `key` prop matching a layout item's `i` property.
 *
 * @example
 * <DashboardGrid layouts={layouts} onLayoutChange={onLayoutChange}>
 *   <div key="fitness"><FitnessCard /></div>
 *   <div key="chart"><PMCChart /></div>
 * </DashboardGrid>
 */
export function DashboardGrid({
  layouts,
  onLayoutChange,
  children,
  className,
}: DashboardGridProps) {
  const [mounted, setMounted] = useState(false)

  // SSR safety
  useEffect(() => {
    setMounted(true)
  }, [])

  // Memoize children to prevent unnecessary re-renders
  const gridChildren = useMemo(() => children, [children])

  // SSR fallback - render children without grid
  if (!mounted) {
    return (
      <div className={className}>
        <div className="grid grid-cols-12 gap-4">
          {children}
        </div>
      </div>
    )
  }

  return (
    <ResponsiveGridLayout
      className={className}
      layouts={layouts}
      breakpoints={GRID_BREAKPOINTS}
      cols={GRID_COLS}
      rowHeight={GRID_ROW_HEIGHT}
      margin={GRID_MARGIN}
      containerPadding={GRID_CONTAINER_PADDING}
      onLayoutChange={onLayoutChange}
      isDraggable={true}
      isResizable={true}
      resizeHandles={['se']}
      draggableHandle=".drag-handle"
      compactType="vertical"
      useCSSTransforms={true}
      transformScale={1}
    >
      {gridChildren}
    </ResponsiveGridLayout>
  )
}
