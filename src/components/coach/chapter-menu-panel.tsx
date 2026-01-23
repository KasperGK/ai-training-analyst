'use client'

/**
 * Chapter Menu Panel
 *
 * Full-width overlay with infinite vertical carousel navigation.
 * The center item (determined by scroll position) is the active chapter.
 * Scrolling the carousel auto-scrolls the message stream to match.
 * Chapters loop infinitely with no beginning or end.
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

// How many times to repeat chapters for infinite scroll illusion
const REPEAT_COUNT = 5

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
  const [centerVirtualIndex, setCenterVirtualIndex] = useState(0)
  const lastCenterRealIndex = useRef<number>(-1)
  const isInitialized = useRef(false)

  // Create virtual list by repeating chapters
  const virtualChapters = chapters.length > 0
    ? Array.from({ length: REPEAT_COUNT }, () => chapters).flat()
    : []

  // Middle set starts at this index
  const middleSetStart = Math.floor(REPEAT_COUNT / 2) * chapters.length

  // Convert virtual index to real chapter index
  const getRealIndex = (virtualIndex: number) => {
    if (chapters.length === 0) return 0
    return ((virtualIndex % chapters.length) + chapters.length) % chapters.length
  }

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

    setCenterVirtualIndex(closestIndex)

    // Notify parent of center change (debounced by checking if real index changed)
    const realIndex = getRealIndex(closestIndex)
    if (realIndex !== lastCenterRealIndex.current && onCenterChange && isInitialized.current) {
      lastCenterRealIndex.current = realIndex
      onCenterChange(chapters[realIndex])
    }
  }, [chapters, onCenterChange])

  // Handle infinite scroll - jump to middle when near edges
  const handleScroll = useCallback(() => {
    if (!containerRef.current || chapters.length === 0) return

    const container = containerRef.current
    const scrollTop = container.scrollTop
    const scrollHeight = container.scrollHeight
    const clientHeight = container.clientHeight

    // Calculate boundaries for jump
    const itemHeight = scrollHeight / virtualChapters.length
    const jumpThreshold = chapters.length * itemHeight

    // If scrolled too far up, jump down to middle
    if (scrollTop < jumpThreshold) {
      const newScrollTop = scrollTop + (chapters.length * 2 * itemHeight)
      container.scrollTop = newScrollTop
    }
    // If scrolled too far down, jump up to middle
    else if (scrollTop > scrollHeight - clientHeight - jumpThreshold) {
      const newScrollTop = scrollTop - (chapters.length * 2 * itemHeight)
      container.scrollTop = newScrollTop
    }

    updateCenterIndex()
  }, [chapters.length, virtualChapters.length, updateCenterIndex])

  // Initialize scroll position to middle set, centered on current chapter
  useEffect(() => {
    if (open && containerRef.current && chapters.length > 0) {
      const targetVirtualIndex = middleSetStart + currentChapterIndex
      const targetItem = itemRefs.current.get(targetVirtualIndex)

      if (targetItem) {
        const container = containerRef.current
        const containerHeight = container.clientHeight
        const itemTop = targetItem.offsetTop
        const itemHeight = targetItem.offsetHeight

        const scrollTo = itemTop - (containerHeight / 2) + (itemHeight / 2)
        container.scrollTo({ top: scrollTo, behavior: 'instant' })
        setCenterVirtualIndex(targetVirtualIndex)
        lastCenterRealIndex.current = currentChapterIndex

        // Mark as initialized after a short delay to prevent immediate onCenterChange
        setTimeout(() => {
          isInitialized.current = true
        }, 100)
      }
    }

    if (!open) {
      isInitialized.current = false
    }
  }, [open, currentChapterIndex, chapters.length, middleSetStart])

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
      {/* Vertical carousel container */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto scrollbar-none"
      >
        {/* Top spacer - allows first item to reach center */}
        <div className="h-[50%]" />

        {virtualChapters.map((chapter, virtualIndex) => {
          const distance = Math.abs(virtualIndex - centerVirtualIndex)
          const isCenter = virtualIndex === centerVirtualIndex
          const realIndex = getRealIndex(virtualIndex)

          // Scale and opacity based on distance from center
          const scale = isCenter ? 1 : Math.max(0.65, 1 - distance * 0.15)
          const opacity = isCenter ? 1 : Math.max(0.25, 1 - distance * 0.3)

          return (
            <button
              key={`${chapter.id}-${virtualIndex}`}
              ref={(el) => {
                if (el) itemRefs.current.set(virtualIndex, el)
              }}
              onClick={() => onChapterClick(chapter)}
              className={cn(
                'w-full py-3 px-8',
                'transition-all duration-150 ease-out',
                'hover:opacity-100'
              )}
              style={{
                transform: `scale(${scale})`,
                opacity,
              }}
            >
              <span className={cn(
                'block text-center leading-snug transition-all duration-150',
                isCenter
                  ? 'text-foreground font-medium text-lg'
                  : 'text-muted-foreground text-sm'
              )}>
                {realIndex + 1}. {chapter.title}
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
