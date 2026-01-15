'use client'

import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { GripVertical } from 'lucide-react'

interface ResizeHandleProps {
  onResize: (delta: number) => void
  className?: string
}

export function ResizeHandle({ onResize, className }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    let lastX = 0

    const handleMouseMove = (e: MouseEvent) => {
      if (lastX === 0) {
        lastX = e.clientX
        return
      }
      const delta = e.clientX - lastX
      lastX = e.clientX
      onResize(delta)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    // Prevent text selection while dragging
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isDragging, onResize])

  return (
    <div
      className={cn(
        'group relative flex w-4 shrink-0 items-center justify-center',
        'cursor-col-resize touch-none select-none',
        className
      )}
      onMouseDown={handleMouseDown}
    >
      {/* Visual handle */}
      <div
        className={cn(
          'flex h-12 w-4 items-center justify-center rounded-md',
          'transition-colors duration-150',
          'bg-transparent hover:bg-muted',
          isDragging && 'bg-muted'
        )}
      >
        <GripVertical
          className={cn(
            'h-4 w-4 text-muted-foreground/50',
            'transition-colors duration-150',
            'group-hover:text-muted-foreground',
            isDragging && 'text-muted-foreground'
          )}
        />
      </div>

      {/* Extended hit area */}
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  )
}
