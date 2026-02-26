'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { DashboardContent } from '@/components/pages/dashboard-content'
import { CoachContent } from '@/components/pages/coach-content'
import { TrainingContent } from '@/components/pages/training-content'
import { AthleteContent } from '@/components/pages/athlete-content'
import { LearnContent } from '@/components/pages/learn-content'

const EDGE_PEEK_WIDTH = 48 // pixels of adjacent page visible

const PAGES = [
  { path: '/', label: 'Dashboard', Component: DashboardContent },
  { path: '/coach', label: 'AI Coach', Component: CoachContent },
  { path: '/training', label: 'Training', Component: TrainingContent },
  { path: '/athlete', label: 'Athlete', Component: AthleteContent },
  { path: '/learn', label: 'Learn', Component: LearnContent },
]

interface MainCarouselProps {
  className?: string
}

/**
 * Main carousel component that renders all 5 main pages side-by-side
 * with iOS-like scroll-snap navigation. Shows edge peek of actual adjacent page content.
 */
export function MainCarousel({ className }: MainCarouselProps) {
  const pathname = usePathname()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isScrollingProgrammatically = useRef(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [mounted, setMounted] = useState(false)

  const targetPage = Math.max(0, PAGES.findIndex(p => p.path === pathname))
  const currentPageRef = useRef(targetPage)

  // Mount check for hydration safety
  useEffect(() => {
    setMounted(true)
  }, [])

  // Calculate scroll position for a given page
  const getScrollPositionForPage = useCallback((page: number) => {
    if (!scrollContainerRef.current) return 0
    const containerWidth = scrollContainerRef.current.offsetWidth
    return page * (containerWidth - EDGE_PEEK_WIDTH)
  }, [])

  // Scroll to correct page when URL changes (e.g., navbar click) or on initial mount
  useEffect(() => {
    if (!mounted || !scrollContainerRef.current) return

    const container = scrollContainerRef.current
    const targetScroll = getScrollPositionForPage(targetPage)
    const currentScroll = container.scrollLeft

    if (Math.abs(currentScroll - targetScroll) > 10) {
      isScrollingProgrammatically.current = true
      currentPageRef.current = targetPage
      container.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      })

      setTimeout(() => {
        isScrollingProgrammatically.current = false
      }, 400)
    }
  }, [targetPage, mounted, getScrollPositionForPage])

  // Handle scroll end and update URL using history API (no React re-render)
  const handleScroll = useCallback(() => {
    if (isScrollingProgrammatically.current) return

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (!scrollContainerRef.current) return

      const container = scrollContainerRef.current
      const containerWidth = container.offsetWidth
      const pageWidth = containerWidth - EDGE_PEEK_WIDTH
      const scrollPosition = container.scrollLeft

      const currentPage = Math.min(Math.round(scrollPosition / pageWidth), PAGES.length - 1)
      const newPath = PAGES[currentPage].path

      if (window.location.pathname !== newPath) {
        currentPageRef.current = currentPage
        window.history.replaceState(null, '', newPath)
        window.dispatchEvent(new CustomEvent('carousel-page-change', { detail: { path: newPath } }))
      }
    }, 100)
  }, [])

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  if (!mounted) {
    return <div className={cn('flex-1', className)} />
  }

  return (
    <div className={cn('relative flex-1 overflow-hidden', className)}>
      <div
        ref={scrollContainerRef}
        className="h-full flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain',
        }}
        onScroll={handleScroll}
      >
        {PAGES.map((page, index) => {
          const isLast = index === PAGES.length - 1
          const { Component } = page
          return (
            <div
              key={page.path}
              className="relative h-full flex-shrink-0 snap-start"
              style={{ width: isLast ? '100%' : `calc(100% - ${EDGE_PEEK_WIDTH}px)` }}
            >
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                <span className="text-[10px] font-medium text-muted-foreground/40 uppercase tracking-widest [writing-mode:vertical-lr] rotate-180">
                  {page.label}
                </span>
              </div>
              <Component />
            </div>
          )
        })}
      </div>
    </div>
  )
}
