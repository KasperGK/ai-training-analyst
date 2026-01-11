'use client'

import { useState, useCallback, useEffect } from 'react'
import type { Layout, ResponsiveLayouts } from 'react-grid-layout/legacy'
import { DEFAULT_LAYOUTS } from '@/lib/dashboard/default-layouts'

const STORAGE_KEY = 'dashboard-layout-v9'

/**
 * Hook for managing dashboard grid layout with localStorage persistence
 *
 * Features:
 * - Loads saved layouts from localStorage on mount
 * - Saves layouts on change
 * - Provides reset to default functionality
 * - Handles SSR safely with mounted state
 */
export function useDashboardLayout() {
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(DEFAULT_LAYOUTS)
  const [mounted, setMounted] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as ResponsiveLayouts
        // Validate structure has all required breakpoints
        if (parsed.lg && parsed.md && parsed.sm) {
          setLayouts(parsed)
        }
      }
    } catch (e) {
      console.warn('Failed to load dashboard layout:', e)
    }
  }, [])

  // Save to localStorage
  const saveLayouts = useCallback((newLayouts: ResponsiveLayouts) => {
    setLayouts(newLayouts)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayouts))
    } catch (e) {
      console.warn('Failed to save dashboard layout:', e)
    }
  }, [])

  // Handle layout change from react-grid-layout
  const onLayoutChange = useCallback(
    (_currentLayout: Layout, allLayouts: ResponsiveLayouts) => {
      saveLayouts(allLayouts)
    },
    [saveLayouts]
  )

  // Reset to default layouts
  const resetLayout = useCallback(() => {
    saveLayouts(DEFAULT_LAYOUTS)
  }, [saveLayouts])

  return {
    layouts,
    mounted,
    onLayoutChange,
    resetLayout,
  }
}
