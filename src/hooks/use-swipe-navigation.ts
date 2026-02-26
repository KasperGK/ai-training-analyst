'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'

// All main pages in order. The carousel handles swiping between these 5,
// so this hook only handles pages outside the carousel.
const PAGE_ORDER = ['/', '/coach', '/training', '/athlete', '/learn']

// All carousel pages — swipe hook skips these entirely
const CAROUSEL_PAGES = new Set(['/', '/coach', '/training', '/athlete', '/learn'])

const SWIPE_THRESHOLD = 60
const MAX_VERTICAL_RATIO = 0.75

function getPageIndex(path: string): number {
  const index = PAGE_ORDER.indexOf(path)
  return index >= 0 ? index : -1
}

/**
 * Detects horizontal swipe/drag gestures and navigates between main pages.
 * Skips all carousel pages since the carousel's CSS scroll-snap handles those.
 */
export function useSwipeNavigation() {
  const router = useRouter()
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const lastRef = useRef<{ x: number; y: number } | null>(null)
  const navigatingRef = useRef(false)

  useEffect(() => {
    pathnameRef.current = pathname
    navigatingRef.current = false
  }, [pathname])

  useEffect(() => {
    function tryNavigate() {
      if (!startRef.current || !lastRef.current || navigatingRef.current) return

      const dx = lastRef.current.x - startRef.current.x
      const dy = lastRef.current.y - startRef.current.y

      startRef.current = null
      lastRef.current = null

      if (Math.abs(dx) < SWIPE_THRESHOLD) return
      if (Math.abs(dy) > Math.abs(dx) * MAX_VERTICAL_RATIO) return

      const current = pathnameRef.current
      if (CAROUSEL_PAGES.has(current)) return

      const currentIndex = getPageIndex(current)
      if (currentIndex < 0) return

      if (dx < 0 && currentIndex < PAGE_ORDER.length - 1) {
        navigatingRef.current = true
        router.push(PAGE_ORDER[currentIndex + 1])
      } else if (dx > 0 && currentIndex > 0) {
        navigatingRef.current = true
        router.push(PAGE_ORDER[currentIndex - 1])
      }
    }

    // --- Touch events (mobile) ---
    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0]
      startRef.current = { x: t.clientX, y: t.clientY }
      lastRef.current = { x: t.clientX, y: t.clientY }
    }

    function onTouchMove(e: TouchEvent) {
      if (!startRef.current) return
      const t = e.touches[0]
      lastRef.current = { x: t.clientX, y: t.clientY }
    }

    function onTouchEndOrCancel() {
      tryNavigate()
    }

    // --- Pointer events (desktop mouse/trackpad) ---
    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return
      if (e.pointerType === 'touch') return // handled by touch events
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, button, a, [role="button"], [data-no-swipe]')) return
      startRef.current = { x: e.clientX, y: e.clientY }
      lastRef.current = { x: e.clientX, y: e.clientY }
    }

    function onPointerMove(e: PointerEvent) {
      if (!startRef.current || e.pointerType === 'touch') return
      lastRef.current = { x: e.clientX, y: e.clientY }
    }

    function onPointerUp(e: PointerEvent) {
      if (e.pointerType === 'touch') return
      tryNavigate()
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEndOrCancel, { passive: true })
    document.addEventListener('touchcancel', onTouchEndOrCancel, { passive: true })
    document.addEventListener('pointerdown', onPointerDown, { passive: true })
    document.addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('pointerup', onPointerUp, { passive: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEndOrCancel)
      document.removeEventListener('touchcancel', onTouchEndOrCancel)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
    }
  }, [router])
}
