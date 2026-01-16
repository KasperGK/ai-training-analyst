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

// Global drag state - prevents click events on cards after dragging
let isDragging = false
let dragTimeout: NodeJS.Timeout | null = null

export function setDragging(value: boolean) {
  isDragging = value
  if (value) {
    // Clear any existing timeout
    if (dragTimeout) clearTimeout(dragTimeout)
  } else {
    // Keep the flag true for a short time after drag ends
    // to catch the click event that fires after mouseup
    dragTimeout = setTimeout(() => {
      isDragging = false
    }, 100)
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
  const handleMouseDown = () => {
    setDragging(true)
  }

  // Also listen for global mouseup to clear drag state
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setDragging(false)
      }
    }
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
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
