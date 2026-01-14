'use client'

/**
 * Insights Dropdown Component
 *
 * Nav bar button that opens a slide-in sheet with the InsightFeed.
 * Shows unread count badge on the bell icon.
 */

import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { InsightFeed } from '@/components/insights/insight-feed'

export function InsightsDropdown() {
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch('/api/insights?countsOnly=true')
        if (res.ok) {
          const data = await res.json()
          setUnreadCount(data.total || 0)
        }
      } catch {
        // Ignore errors for badge
      }
    }

    fetchCount()
    // Refresh every 5 minutes
    const interval = setInterval(fetchCount, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Refresh count when sheet closes (user may have read/dismissed insights)
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      // Refetch count after closing
      fetch('/api/insights?countsOnly=true')
        .then(res => res.ok ? res.json() : null)
        .then(data => data && setUnreadCount(data.total || 0))
        .catch(() => {})
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-xs text-primary-foreground flex items-center justify-center font-medium">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <span className="sr-only">
            {unreadCount > 0 ? `${unreadCount} unread insights` : 'Insights'}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[480px] flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>Insights</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-hidden -mx-6 px-6">
          <InsightFeed showHeader={false} maxItems={20} className="h-full border-none shadow-none" />
        </div>
      </SheetContent>
    </Sheet>
  )
}
