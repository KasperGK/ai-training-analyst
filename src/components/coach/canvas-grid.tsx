'use client'

/**
 * Canvas Grid Component
 *
 * Adaptive grid layout that shows all active widgets simultaneously.
 * Grid adapts based on widget count:
 * - 1 widget: Full width
 * - 2 widgets: 2 columns side-by-side
 * - 3+ widgets: Auto-fit grid with min 320px per widget
 *
 * Responsive: 2-col on desktop, 1-col on mobile
 */

import { useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface CanvasGridProps {
  children: React.ReactNode
  widgetCount: number
  className?: string
  /** ID of widget to highlight (for chapter navigation) */
  highlightedWidgetId?: string | null
}

export function CanvasGrid({
  children,
  widgetCount,
  className,
  highlightedWidgetId,
}: CanvasGridProps) {
  const gridRef = useRef<HTMLDivElement>(null)

  // Scroll to highlighted widget
  useEffect(() => {
    if (!highlightedWidgetId || !gridRef.current) return

    const widgetElement = gridRef.current.querySelector(
      `[data-widget-id="${highlightedWidgetId}"]`
    )
    if (widgetElement) {
      widgetElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightedWidgetId])

  // Determine grid class based on widget count
  const gridClass = getGridClass(widgetCount)

  return (
    <div
      ref={gridRef}
      className={cn(
        'grid gap-4 auto-rows-min',
        gridClass,
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * Determine optimal grid layout based on widget count
 * Always single column - widgets stack vertically
 */
function getGridClass(count: number): string {
  return 'grid-cols-1'
}

interface CanvasGridItemProps {
  children: React.ReactNode
  widgetId: string
  isHighlighted?: boolean
  className?: string
}

/**
 * Individual grid item wrapper with highlight support
 */
export function CanvasGridItem({
  children,
  widgetId,
  isHighlighted,
  className,
}: CanvasGridItemProps) {
  return (
    <div
      data-widget-id={widgetId}
      className={cn(
        'transition-all duration-300',
        isHighlighted && 'ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg animate-pulse',
        className
      )}
    >
      {children}
    </div>
  )
}
