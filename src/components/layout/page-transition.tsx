'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

type TransitionDirection = 'left' | 'right' | 'none'

interface TransitionContextValue {
  direction: TransitionDirection
  setDirection: (dir: TransitionDirection) => void
  isTransitioning: boolean
}

const TransitionContext = createContext<TransitionContextValue>({
  direction: 'none',
  setDirection: () => {},
  isTransitioning: false,
})

export function usePageTransition() {
  return useContext(TransitionContext)
}

// Define page order for determining slide direction
const PAGE_ORDER = ['/', '/coach', '/training', '/athlete', '/learn', '/settings']

function getPageIndex(path: string): number {
  const index = PAGE_ORDER.indexOf(path)
  return index >= 0 ? index : 999
}

export function PageTransitionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [direction, setDirection] = useState<TransitionDirection>('none')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const prevPathRef = useRef(pathname)

  // Auto-detect direction based on page order
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      const prevIndex = getPageIndex(prevPathRef.current)
      const newIndex = getPageIndex(pathname)

      if (prevIndex < newIndex) {
        setDirection('left') // Moving forward, slide left
      } else if (prevIndex > newIndex) {
        setDirection('right') // Moving backward, slide right
      }

      setIsTransitioning(true)
      const timer = setTimeout(() => {
        setIsTransitioning(false)
        setDirection('none')
      }, 300)

      prevPathRef.current = pathname
      return () => clearTimeout(timer)
    }
  }, [pathname])

  return (
    <TransitionContext.Provider value={{ direction, setDirection, isTransitioning }}>
      {children}
    </TransitionContext.Provider>
  )
}

interface PageTransitionProps {
  children: React.ReactNode
  className?: string
}

export function PageTransition({ children, className }: PageTransitionProps) {
  const { direction, isTransitioning } = usePageTransition()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div
      className={cn(
        'w-full h-full flex flex-col',
        mounted && 'animate-in',
        direction === 'left' && 'slide-in-from-right',
        direction === 'right' && 'slide-in-from-left',
        direction === 'none' && 'fade-in',
        'duration-300',
        className
      )}
    >
      {children}
    </div>
  )
}
