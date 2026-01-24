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
  const [isDragging, setIsDragging] = useState(false)
  // Just track the swap target ID, no pixel calculations needed
  const [swapTarget, setSwapTarget] = useState<string | null>(null)
  const originalLayoutsRef = useRef<ResponsiveLayouts | null>(null)
  const justSwappedRef = useRef(false)

  // SSR safety
  useEffect(() => {
    setMounted(true)
  }, [])

  // Capture state before drag starts
  const handleDragStart = useCallback(
    (_layout: Layout, oldItem: LayoutItem | null) => {
      if (!oldItem) return
      setIsDragging(true)
      setSwapTarget(null)
      // Deep clone to preserve original positions
      originalLayoutsRef.current = JSON.parse(JSON.stringify(layouts))
    },
    [layouts]
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

      // Find the item we're dragging over (from ORIGINAL positions)
      const collidingItem = originalLayouts.lg?.find((item) => {
        if (item.i === oldItem.i) return false
        return (
          newItem.x < item.x + item.w &&
          newItem.x + newItem.w > item.x &&
          newItem.y < item.y + item.h &&
          newItem.y + newItem.h > item.y
        )
      })

      if (collidingItem && collidingItem.i !== swapTarget) {
        // New collision - perform live swap
        setSwapTarget(collidingItem.i)

        const origDragged = originalLayouts.lg?.find((i) => i.i === oldItem.i)
        if (!origDragged) return

        // Build swapped layout - move colliding item to dragged item's original spot
        const swappedLayouts: ResponsiveLayouts = {}
        for (const bp of Object.keys(layouts) as Array<keyof ResponsiveLayouts>) {
          const bpLayout = layouts[bp]
          const origBp = originalLayouts[bp]
          if (!bpLayout || !origBp) continue

          const origDraggedBp = origBp.find((i) => i.i === oldItem.i)
          if (!origDraggedBp) continue

          swappedLayouts[bp] = bpLayout.map((item) => {
            if (item.i === collidingItem.i) {
              // Move colliding item to dragged item's original position
              return { ...item, x: origDraggedBp.x, y: origDraggedBp.y }
            }
            return item
          })
        }

        // Trigger layout update - colliding widget will animate to new position
        onLayoutChange(swappedLayouts.lg || _layout, swappedLayouts)

      } else if (!collidingItem && swapTarget) {
        // No longer colliding - revert the swap
        setSwapTarget(null)

        // Restore original layout for the previously swapped item
        const revertedLayouts: ResponsiveLayouts = {}
        for (const bp of Object.keys(layouts) as Array<keyof ResponsiveLayouts>) {
          const origBp = originalLayouts[bp]
          if (!origBp) continue
          revertedLayouts[bp] = origBp.map((item) => ({ ...item }))
        }
        onLayoutChange(revertedLayouts.lg || _layout, revertedLayouts)
      }
    },
    [layouts, onLayoutChange, swapTarget]
  )

  // Commit swap on drag stop
  const handleDragStop = useCallback(
    (_layout: Layout, oldItem: LayoutItem | null) => {
      if (swapTarget && originalLayoutsRef.current && oldItem) {
        // Finalize: place dragged item at colliding item's original position
        const swappedLayouts: ResponsiveLayouts = {}
        const originalLayouts = originalLayoutsRef.current

        for (const bp of Object.keys(layouts) as Array<keyof ResponsiveLayouts>) {
          const bpLayout = layouts[bp]
          const origBp = originalLayouts[bp]
          if (!bpLayout || !origBp) continue

          const origDragged = origBp.find((i) => i.i === oldItem.i)
          const origColliding = origBp.find((i) => i.i === swapTarget)
          if (!origDragged || !origColliding) continue

          swappedLayouts[bp] = bpLayout.map((item) => {
            if (item.i === oldItem.i) {
              // Dragged item → colliding item's original position
              return { ...item, x: origColliding.x, y: origColliding.y }
            }
            if (item.i === swapTarget) {
              // Colliding item stays at dragged item's original position (already moved)
              return { ...item, x: origDragged.x, y: origDragged.y }
            }
            return item
          })
        }

        // Set flag to prevent RGL's onLayoutChange from overwriting our swap
        justSwappedRef.current = true
        onLayoutChange(swappedLayouts.lg || _layout, swappedLayouts)

        // Clear flag after a tick (RGL's onLayoutChange fires synchronously after onDragStop)
        setTimeout(() => {
          justSwappedRef.current = false
        }, 0)
      }

      // Cleanup
      setSwapTarget(null)
      setIsDragging(false)
      originalLayoutsRef.current = null
    },
    [layouts, onLayoutChange, swapTarget]
  )

  // Wrapper to intercept RGL's onLayoutChange and prevent it from overwriting our swap
  const handleLayoutChange = useCallback(
    (currentLayout: Layout, allLayouts: ResponsiveLayouts) => {
      // If we just did a swap, ignore RGL's layout change (it would overwrite our swap)
      if (justSwappedRef.current) {
        return
      }
      onLayoutChange(currentLayout, allLayouts)
    },
    [onLayoutChange]
  )

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
      onLayoutChange={handleLayoutChange}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragStop={handleDragStop}
      isDraggable={true}
      isResizable={true}
      resizeHandles={['se']}
      draggableHandle=".drag-handle"
      compactType={isDragging ? null : 'vertical'}
      preventCollision={false}
      useCSSTransforms={true}
      transformScale={1}
    >
      {children}
    </ResponsiveGridLayout>
  )
}
