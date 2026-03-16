'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'
import type { Layout, ResponsiveLayouts } from 'react-grid-layout/legacy'
import {
  GRID_BREAKPOINTS,
  GRID_COLS,
  GRID_ROW_HEIGHT,
  GRID_MARGIN,
  GRID_CONTAINER_PADDING,
} from '@/types/dashboard-grid'
import type { LayoutItem } from '@/types/dashboard-grid'

// Create width-aware responsive grid
const ResponsiveGridLayout = WidthProvider(Responsive)

// Minimum overlap ratio (of smaller widget area) to trigger a swap
const SWAP_OVERLAP_THRESHOLD = 0.35

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
 * Wraps children in a react-grid-layout responsive grid with iOS-like swap behavior.
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
  const [isDragging, setIsDragging] = useState(false)

  // Refs to avoid stale closures in drag callbacks
  const layoutsRef = useRef(layouts)
  const swapTargetRef = useRef<string | null>(null)
  const originalLayoutsRef = useRef<ResponsiveLayouts | null>(null)
  const isDraggingRef = useRef(false)
  const currentBreakpointRef = useRef<string>('lg')

  // Keep layoutsRef in sync
  useEffect(() => {
    layoutsRef.current = layouts
  }, [layouts])

  // SSR safety
  useEffect(() => {
    setMounted(true)
  }, [])

  // Track current breakpoint for correct collision detection
  const handleBreakpointChange = useCallback((newBreakpoint: string) => {
    currentBreakpointRef.current = newBreakpoint
  }, [])

  // Capture state before drag starts
  const handleDragStart = useCallback(
    (_layout: Layout, oldItem: LayoutItem | null) => {
      if (!oldItem) return
      setIsDragging(true)
      isDraggingRef.current = true
      swapTargetRef.current = null
      // Deep clone to preserve original positions
      originalLayoutsRef.current = JSON.parse(JSON.stringify(layoutsRef.current))
      onDragModeChange?.(true)
    },
    [onDragModeChange]
  )

  // During drag, detect collision and perform live layout swap
  const handleDrag = useCallback(
    (
      _layout: Layout,
      oldItem: LayoutItem | null,
      newItem: LayoutItem | null,
      _placeholder: LayoutItem | null
    ) => {
      if (!oldItem || !newItem || !originalLayoutsRef.current) return

      const originalLayouts = originalLayoutsRef.current
      const bp = currentBreakpointRef.current
      const bpOriginalLayout = originalLayouts[bp]
      if (!bpOriginalLayout) return

      // Find the item we're dragging over (from ORIGINAL positions) with overlap threshold
      const collidingItem = bpOriginalLayout.find((item) => {
        if (item.i === oldItem.i) return false

        // Calculate overlap area
        const overlapX = Math.max(
          0,
          Math.min(newItem.x + newItem.w, item.x + item.w) - Math.max(newItem.x, item.x)
        )
        const overlapY = Math.max(
          0,
          Math.min(newItem.y + newItem.h, item.y + item.h) - Math.max(newItem.y, item.y)
        )
        const overlapArea = overlapX * overlapY
        if (overlapArea === 0) return false

        // Require meaningful overlap relative to smaller widget
        const smallerArea = Math.min(newItem.w * newItem.h, item.w * item.h)
        return overlapArea / smallerArea > SWAP_OVERLAP_THRESHOLD
      })

      const currentSwapTarget = swapTargetRef.current

      if (collidingItem && collidingItem.i !== currentSwapTarget) {
        // New collision - perform live swap
        swapTargetRef.current = collidingItem.i

        const currentLayouts = layoutsRef.current

        // Build swapped layout for all breakpoints
        const swappedLayouts: ResponsiveLayouts = {}
        for (const bpKey of Object.keys(currentLayouts) as Array<keyof ResponsiveLayouts>) {
          const bpLayout = currentLayouts[bpKey]
          const origBp = originalLayouts[bpKey]
          if (!bpLayout || !origBp) continue

          const origDraggedBp = origBp.find((i) => i.i === oldItem.i)
          if (!origDraggedBp) continue

          swappedLayouts[bpKey] = bpLayout.map((item) => {
            if (item.i === collidingItem.i) {
              // Move colliding item to dragged item's original position
              return { ...item, x: origDraggedBp.x, y: origDraggedBp.y }
            }
            return item
          })
        }

        onLayoutChange(swappedLayouts[bp] || _layout, swappedLayouts)

      } else if (!collidingItem && currentSwapTarget) {
        // No longer colliding - revert the swap
        swapTargetRef.current = null

        const revertedLayouts: ResponsiveLayouts = {}
        for (const bpKey of Object.keys(originalLayouts) as Array<keyof ResponsiveLayouts>) {
          const origBp = originalLayouts[bpKey]
          if (!origBp) continue
          revertedLayouts[bpKey] = origBp.map((item) => ({ ...item }))
        }
        onLayoutChange(revertedLayouts[bp] || _layout, revertedLayouts)
      }
    },
    [onLayoutChange]
  )

  // Commit swap on drag stop
  const handleDragStop = useCallback(
    (_layout: Layout, oldItem: LayoutItem | null) => {
      const swapTarget = swapTargetRef.current

      if (swapTarget && originalLayoutsRef.current && oldItem) {
        const originalLayouts = originalLayoutsRef.current
        const currentLayouts = layoutsRef.current
        const bp = currentBreakpointRef.current

        // Finalize: place dragged item at colliding item's original position
        const swappedLayouts: ResponsiveLayouts = {}

        for (const bpKey of Object.keys(currentLayouts) as Array<keyof ResponsiveLayouts>) {
          const bpLayout = currentLayouts[bpKey]
          const origBp = originalLayouts[bpKey]
          if (!bpLayout || !origBp) continue

          const origDragged = origBp.find((i) => i.i === oldItem.i)
          const origColliding = origBp.find((i) => i.i === swapTarget)
          if (!origDragged || !origColliding) continue

          swappedLayouts[bpKey] = bpLayout.map((item) => {
            if (item.i === oldItem.i) {
              return { ...item, x: origColliding.x, y: origColliding.y }
            }
            if (item.i === swapTarget) {
              return { ...item, x: origDragged.x, y: origDragged.y }
            }
            return item
          })
        }

        onLayoutChange(swappedLayouts[bp] || _layout, swappedLayouts)
      }

      // Cleanup
      swapTargetRef.current = null
      originalLayoutsRef.current = null
      isDraggingRef.current = false
      setIsDragging(false)
      onDragModeChange?.(false)
    },
    [onLayoutChange, onDragModeChange]
  )

  // Suppress RGL's onLayoutChange during drag to prevent it overwriting our swap
  const handleLayoutChange = useCallback(
    (currentLayout: Layout, allLayouts: ResponsiveLayouts) => {
      if (isDraggingRef.current) return
      onLayoutChange(currentLayout, allLayouts)
    },
    [onLayoutChange]
  )

  // SSR fallback
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
      onLayoutChange={handleLayoutChange}
      onBreakpointChange={handleBreakpointChange}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragStop={handleDragStop}
      isDraggable={true}
      isResizable={true}
      resizeHandles={['se']}
      draggableHandle=".drag-handle"
      compactType="vertical"
      preventCollision={isDragging}
      useCSSTransforms={true}
      transformScale={1}
    >
      {children}
    </ResponsiveGridLayout>
  )
}
