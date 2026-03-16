'use client'

import React, { useState, useEffect, useCallback } from 'react'
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
  onDragModeChange?: (isDragging: boolean) => void
  children: React.ReactNode
  className?: string
}

/**
 * Dashboard Grid Component
 *
 * Wraps children in a react-grid-layout responsive grid.
 * Uses RGL's native push-down behavior for iOS-like widget rearrangement.
 * Each child must have a `key` prop matching a layout item's `i` property.
 */
export function DashboardGrid({
  layouts,
  onLayoutChange,
  onDragModeChange,
  children,
  className,
}: DashboardGridProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleDragStart = useCallback(() => {
    onDragModeChange?.(true)
  }, [onDragModeChange])

  const handleDragStop = useCallback(() => {
    onDragModeChange?.(false)
  }, [onDragModeChange])

  // SSR fallback
  if (!mounted) {
    return (
      <div className={className}>
        <div className="grid grid-cols-12 gap-4">{children}</div>
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
      onDragStart={handleDragStart}
      onDragStop={handleDragStop}
      isDraggable={true}
      isResizable={true}
      resizeHandles={['se']}
      draggableHandle=".drag-handle"
      compactType="vertical"
      preventCollision={false}
      useCSSTransforms={true}
      transformScale={1}
    >
      {children}
    </ResponsiveGridLayout>
  )
}
