'use client'

import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CalendarDays, List } from 'lucide-react'
import { CalendarGrid } from './calendar-grid'
import { WorkoutList } from './workout-list'
import type { PlanDay } from '@/types'

type ViewMode = '3day' | 'week' | 'month'
type DisplayMode = 'calendar' | 'list'

interface ScheduleViewProps {
  days: PlanDay[]
  events?: Array<{ date: string; name: string; priority: string }>
  selectedDate: string | null
  onSelectDay: (day: PlanDay) => void
}

export function ScheduleView({
  days,
  events = [],
  selectedDate,
  onSelectDay,
}: ScheduleViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('calendar')

  // Filter days based on view mode
  const getFilteredDays = (): PlanDay[] => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (viewMode === '3day') {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      return days.filter(d => {
        const date = new Date(d.date)
        return date >= yesterday && date <= tomorrow
      })
    }

    if (viewMode === 'week') {
      const weekStart = new Date(today)
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)) // Monday
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)

      return days.filter(d => {
        const date = new Date(d.date)
        return date >= weekStart && date <= weekEnd
      })
    }

    // Month view - show current month
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)

    return days.filter(d => {
      const date = new Date(d.date)
      return date >= monthStart && date <= monthEnd
    })
  }

  const filteredDays = getFilteredDays()

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        {/* View mode toggle */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <TabsList>
            <TabsTrigger value="3day">3 Day</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Display mode toggle */}
        <ToggleGroup
          type="single"
          value={displayMode}
          onValueChange={(v) => v && setDisplayMode(v as DisplayMode)}
        >
          <ToggleGroupItem value="calendar" aria-label="Calendar view">
            <CalendarDays className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List view">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* View content */}
      {displayMode === 'calendar' ? (
        <CalendarGrid
          days={filteredDays}
          viewMode={viewMode}
          selectedDate={selectedDate}
          onSelectDay={onSelectDay}
          events={events}
        />
      ) : (
        <WorkoutList
          days={filteredDays}
          selectedDate={selectedDate}
          onSelectDay={onSelectDay}
        />
      )}
    </div>
  )
}
