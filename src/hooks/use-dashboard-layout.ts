'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import type { Layout, ResponsiveLayouts } from 'react-grid-layout/legacy'
import { DEFAULT_LAYOUTS } from '@/lib/dashboard/default-layouts'
import { WIDGET_REGISTRY } from '@/lib/dashboard/widget-registry'
import { logger } from '@/lib/logger'

const STORAGE_KEY = 'dashboard-layout-v13'
const VISIBILITY_KEY = 'dashboard-visible-widgets-v1'

/** All widget IDs that can appear on the dashboard (excludes ai-coach and customize) */
const ALL_DASHBOARD_IDS = Object.keys(WIDGET_REGISTRY).filter(id => id !== 'ai-coach' && id !== 'customize')

/**
 * Hook for managing dashboard grid layout with localStorage persistence
 *
 * Features:
 * - Loads saved layouts from localStorage on mount
 * - Saves layouts on change
 * - Provides reset to default functionality
 * - Widget visibility toggle (show/hide widgets)
 * - Handles SSR safely with mounted state
 */
export function useDashboardLayout() {
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(DEFAULT_LAYOUTS)
  const [mounted, setMounted] = useState(false)
  const [visibleWidgets, setVisibleWidgets] = useState<Set<string>>(new Set(ALL_DASHBOARD_IDS))

  // Load from localStorage on mount
  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as ResponsiveLayouts
        if (parsed.lg && parsed.md && parsed.sm) {
          setLayouts(parsed)
        }
      }
    } catch (e) {
      logger.warn('Failed to load dashboard layout:', e)
    }

    try {
      const savedVisibility = localStorage.getItem(VISIBILITY_KEY)
      if (savedVisibility) {
        const parsed = JSON.parse(savedVisibility) as string[]
        if (Array.isArray(parsed)) {
          setVisibleWidgets(new Set(parsed))
        }
      }
    } catch (e) {
      logger.warn('Failed to load widget visibility:', e)
    }
  }, [])

  // Save to localStorage
  const saveLayouts = useCallback((newLayouts: ResponsiveLayouts) => {
    setLayouts(newLayouts)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayouts))
    } catch (e) {
      logger.warn('Failed to save dashboard layout:', e)
    }
  }, [])

  // Save visibility
  const saveVisibility = useCallback((widgets: Set<string>) => {
    setVisibleWidgets(widgets)
    try {
      localStorage.setItem(VISIBILITY_KEY, JSON.stringify([...widgets]))
    } catch (e) {
      logger.warn('Failed to save widget visibility:', e)
    }
  }, [])

  // Handle layout change from react-grid-layout
  const onLayoutChange = useCallback(
    (_currentLayout: Layout, allLayouts: ResponsiveLayouts) => {
      saveLayouts(allLayouts)
    },
    [saveLayouts]
  )

  // Toggle a widget's visibility
  const toggleWidget = useCallback((id: string) => {
    setVisibleWidgets(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      saveVisibility(next)
      return next
    })
  }, [saveVisibility])

  // Filter layouts to only include visible widget IDs (customize is always visible)
  const filteredLayouts = useMemo(() => {
    const result: ResponsiveLayouts = {}
    for (const [breakpoint, layout] of Object.entries(layouts)) {
      result[breakpoint] = (layout as Layout).filter(
        (item) => item.i === 'customize' || visibleWidgets.has(item.i)
      )
    }
    return result
  }, [layouts, visibleWidgets])

  // Reset to default layouts and visibility
  const resetLayout = useCallback(() => {
    saveLayouts(DEFAULT_LAYOUTS)
    saveVisibility(new Set(ALL_DASHBOARD_IDS))
  }, [saveLayouts, saveVisibility])

  return {
    layouts: filteredLayouts,
    mounted,
    onLayoutChange,
    resetLayout,
    visibleWidgets,
    toggleWidget,
  }
}
