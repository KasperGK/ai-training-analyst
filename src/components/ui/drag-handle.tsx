'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils'

/**
 * 4-dot grip icon (2x2 grid)
 */
function Grip4({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <circle cx="5" cy="5" r="1.5" />
      <circle cx="11" cy="5" r="1.5" />
      <circle cx="5" cy="11" r="1.5" />
      <circle cx="11" cy="11" r="1.5" />
    </svg>
  )
}

interface DragHandleProps {
  className?: string
}

// Constants for drag detection
const DRAG_THRESHOLD = 5 // pixels moved to count as drag
const DRAG_TIMEOUT = 200 // ms after mouseup to block clicks

// Global drag state - prevents click events on cards after dragging
let isDragging = false
let dragStartPos: { x: number; y: number } | null = null
let dragTimeout: NodeJS.Timeout | null = null

export function setDragging(value: boolean) {
  if (value) {
    isDragging = true
    // Clear any existing timeout
    if (dragTimeout) clearTimeout(dragTimeout)
  } else {
    // DON'T set isDragging = false here immediately
    // Keep it true during the timeout window to block click events
    // that fire after mouseup
    if (dragTimeout) clearTimeout(dragTimeout)
    dragTimeout = setTimeout(() => {
      isDragging = false
    }, DRAG_TIMEOUT)
  }
}

export function wasDragging(): boolean {
  return isDragging
}

/**
 * Drag Handle Component
 *
 * A subtle grip icon that serves as the drag handle for grid items.
 * Only this element triggers drag operations, not the entire card.
 * Hidden by default, visible on parent hover (requires parent to have "group" class).
 */
export function DragHandle({ className }: DragHandleProps) {
  const handleMouseDown = (e: React.MouseEvent) => {
    // Record starting position - don't set dragging yet, wait for movement
    dragStartPos = { x: e.clientX, y: e.clientY }
  }

  // Listen for mouse movement and mouseup globally
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Only check if we have a start position and haven't started dragging yet
      if (dragStartPos && !isDragging) {
        const dx = Math.abs(e.clientX - dragStartPos.x)
        const dy = Math.abs(e.clientY - dragStartPos.y)
        if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
          setDragging(true)
        }
      }
    }

    const handleGlobalMouseUp = () => {
      dragStartPos = null
      if (isDragging) {
        setDragging(false)
      }
    }

    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [])

  return (
    <div
      className={cn(
        'drag-handle cursor-grab active:cursor-grabbing',
        'absolute top-0.5 right-0.5 z-10',
        'p-1 rounded hover:bg-muted/50 transition-all duration-200',
        'text-muted-foreground/50 hover:text-muted-foreground',
        'opacity-0 group-hover:opacity-100',
        className
      )}
      title="Drag to move"
      onMouseDown={handleMouseDown}
    >
      <Grip4 className="h-4 w-4" />
    </div>
  )
}
