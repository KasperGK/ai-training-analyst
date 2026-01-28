'use client'

/**
 * Chapter Menu Panel
 *
 * Full-width overlay with vertical carousel navigation.
 * The center item (determined by scroll position) is the active chapter.
 * Scrolling the carousel auto-scrolls the message stream to match.
 * Uses scroll-snap for smooth navigation.
 */

import { useRef, useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { Chapter } from '@/lib/chat/chapters'

interface ChapterMenuPanelProps {
  open: boolean
  chapters: Chapter[]
  currentChapterIndex: number
  onChapterClick: (chapter: Chapter) => void
  onCenterChange?: (chapter: Chapter) => void
  onMouseLeave?: () => void
}

export function ChapterMenuPanel({
  open,
  chapters,
  currentChapterIndex,
  onChapterClick,
  onCenterChange,
  onMouseLeave,
}: ChapterMenuPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map())
  const [centerIndex, setCenterIndex] = useState(0)
  const lastCenterIndex = useRef<number>(-1)
  const isInitialized = useRef(false)

  // Calculate which item is in the center based on scroll position
  const updateCenterIndex = useCallback(() => {
    if (!containerRef.current || chapters.length === 0) return

    const container = containerRef.current
    const containerRect = container.getBoundingClientRect()
    const containerCenter = containerRect.top + containerRect.height / 2

    let closestIndex = 0
    let closestDistance = Infinity

    itemRefs.current.forEach((element, index) => {
      const rect = element.getBoundingClientRect()
      const itemCenter = rect.top + rect.height / 2
      const distance = Math.abs(itemCenter - containerCenter)

      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = index
      }
    })

    setCenterIndex(closestIndex)

    // Notify parent of center change
    if (closestIndex !== lastCenterIndex.current && onCenterChange && isInitialized.current) {
      lastCenterIndex.current = closestIndex
      onCenterChange(chapters[closestIndex])
    }
  }, [chapters, onCenterChange])

  // Handle scroll events
  const handleScroll = useCallback(() => {
    if (!containerRef.current || chapters.length === 0) return
    updateCenterIndex()
  }, [chapters.length, updateCenterIndex])

  // Initialize scroll position to center on current chapter
  useEffect(() => {
    if (open && containerRef.current && chapters.length > 0) {
      const targetItem = itemRefs.current.get(currentChapterIndex)

      if (targetItem) {
        const container = containerRef.current
        const containerHeight = container.clientHeight
        const itemTop = targetItem.offsetTop
        const itemHeight = targetItem.offsetHeight

        const scrollTo = itemTop - (containerHeight / 2) + (itemHeight / 2)
        container.scrollTo({ top: scrollTo, behavior: 'instant' })
        setCenterIndex(currentChapterIndex)
        lastCenterIndex.current = currentChapterIndex

        // Mark as initialized after a short delay to prevent immediate onCenterChange
        setTimeout(() => {
          isInitialized.current = true
        }, 100)
      }
    }

    if (!open) {
      isInitialized.current = false
    }
  }, [open, currentChapterIndex, chapters.length])

  // Listen to scroll events
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  if (chapters.length === 0) {
    if (!open) return null
    return (
      <div
        className={cn(
          'absolute inset-0',
          'transition-opacity duration-300 ease-out',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onMouseLeave={onMouseLeave}
      >
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground/60">
          No chapters yet
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'absolute inset-0',
        'transition-opacity duration-300 ease-out',
        open ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
      onMouseLeave={onMouseLeave}
    >
      {/* Vertical carousel container with scroll-snap */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto scrollbar-none snap-y snap-mandatory scroll-smooth"
      >
        {/* Top spacer - allows first item to reach center */}
        <div className="h-[50%]" />

        {chapters.map((chapter, index) => {
          const distance = Math.abs(index - centerIndex)
          const isCenter = index === centerIndex

          // Scale and opacity based on distance from center
          // More gentle falloff for better readability
          const scale = isCenter ? 1 : Math.max(0.8, 1 - distance * 0.08)
          const opacity = isCenter ? 1 : Math.max(0.4, 1 - distance * 0.2)

          return (
            <button
              key={chapter.id}
              ref={(el) => {
                if (el) itemRefs.current.set(index, el)
              }}
              onClick={() => onChapterClick(chapter)}
              className={cn(
                'w-full py-3 px-4 snap-center',
                'transition-all duration-200 ease-out',
                'hover:opacity-100'
              )}
              style={{
                transform: `scale(${scale})`,
                opacity,
              }}
            >
              <span className={cn(
                'block text-left leading-snug line-clamp-3',
                isCenter
                  ? 'text-foreground font-medium text-lg'
                  : 'text-muted-foreground text-base'
              )}>
                {chapter.title}
              </span>
            </button>
          )
        })}

        {/* Bottom spacer - allows last item to reach center */}
        <div className="h-[50%]" />
      </div>
    </div>
  )
}
