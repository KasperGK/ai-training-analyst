'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { DashboardContent } from '@/components/pages/dashboard-content'
import { CoachContent } from '@/components/pages/coach-content'

const EDGE_PEEK_WIDTH = 48 // pixels of adjacent page visible

interface MainCarouselProps {
  className?: string
}

/**
 * Main carousel component that renders Dashboard and Coach side-by-side
 * with iOS-like scroll-snap navigation. Shows edge peek of actual adjacent page content.
 */
export function MainCarousel({ className }: MainCarouselProps) {
  const pathname = usePathname()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isScrollingProgrammatically = useRef(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [mounted, setMounted] = useState(false)
  const currentPageRef = useRef(pathname === '/coach' ? 1 : 0)

  // Track which page should be active based on URL
  const targetPage = pathname === '/coach' ? 1 : 0

  // Mount check for hydration safety
  useEffect(() => {
    setMounted(true)
  }, [])

  // Calculate scroll position for a given page
  const getScrollPositionForPage = useCallback((page: number) => {
    if (!scrollContainerRef.current) return 0
    const containerWidth = scrollContainerRef.current.offsetWidth
    // Each page takes containerWidth - EDGE_PEEK_WIDTH
    // Page 0: scroll = 0
    // Page 1: scroll = containerWidth - EDGE_PEEK_WIDTH
    return page * (containerWidth - EDGE_PEEK_WIDTH)
  }, [])

  // Scroll to correct page when URL changes (e.g., navbar click)
  useEffect(() => {
    if (!mounted || !scrollContainerRef.current) return

    const container = scrollContainerRef.current
    const targetScroll = getScrollPositionForPage(targetPage)
    const currentScroll = container.scrollLeft

    // Only scroll if we're not already at the target and page actually changed
    if (Math.abs(currentScroll - targetScroll) > 10 && currentPageRef.current !== targetPage) {
      isScrollingProgrammatically.current = true
      currentPageRef.current = targetPage
      container.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      })

      // Reset flag after scroll completes
      setTimeout(() => {
        isScrollingProgrammatically.current = false
      }, 400)
    }
  }, [targetPage, mounted, getScrollPositionForPage])

  // Handle scroll end and update URL using history API (no React re-render)
  const handleScroll = useCallback(() => {
    if (isScrollingProgrammatically.current) return

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }

    // Debounce - wait for scroll to settle
    scrollTimeoutRef.current = setTimeout(() => {
      if (!scrollContainerRef.current) return

      const container = scrollContainerRef.current
      const containerWidth = container.offsetWidth
      const pageWidth = containerWidth - EDGE_PEEK_WIDTH
      const scrollPosition = container.scrollLeft

      // Determine which page we're on based on scroll position
      const currentPage = scrollPosition > pageWidth / 2 ? 1 : 0

      // Update URL without triggering React navigation (avoids re-render)
      const newPath = currentPage === 0 ? '/' : '/coach'
      if (window.location.pathname !== newPath) {
        currentPageRef.current = currentPage
        window.history.replaceState(null, '', newPath)
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
    // Render placeholder during SSR to avoid hydration mismatch
    return <div className={cn('flex-1', className)} />
  }

  return (
    <div className={cn('relative flex-1 overflow-hidden', className)}>
      {/* Scrollable container with snap */}
      <div
        ref={scrollContainerRef}
        className="h-full flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x',
          overscrollBehaviorX: 'contain',
        }}
        onScroll={handleScroll}
      >
        {/* Dashboard Page */}
        <div
          className="relative h-full flex-shrink-0 snap-start"
          style={{ width: `calc(100% - ${EDGE_PEEK_WIDTH}px)` }}
        >
          <DashboardContent />
          {/* Edge label - visible when peeking from Coach */}
          <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
            <span className="text-[10px] font-medium text-muted-foreground/40 uppercase tracking-widest [writing-mode:vertical-lr] rotate-180">
              Dashboard
            </span>
          </div>
        </div>

        {/* Coach Page - full width so it extends to right edge */}
        <div
          className="relative h-full flex-shrink-0 snap-start"
          style={{ width: '100%' }}
        >
          {/* Edge label - visible when peeking from Dashboard */}
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <span className="text-[10px] font-medium text-muted-foreground/40 uppercase tracking-widest [writing-mode:vertical-lr] rotate-180">
              AI Coach
            </span>
          </div>
          <CoachContent />
        </div>
      </div>
    </div>
  )
}
