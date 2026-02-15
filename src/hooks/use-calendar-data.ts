'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTrainingPlan } from '@/hooks/use-training-plan'
import type { PlanDay, Session, Event, Goal } from '@/types'

export interface CalendarDayData {
  planDay?: PlanDay
  sessions: Session[]
  event?: { date: string; name: string; priority: string }
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getMondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function getWeekRange(weekStart: Date): { start: string; end: string } {
  const end = new Date(weekStart)
  end.setDate(weekStart.getDate() + 6)
  return {
    start: toLocalDateStr(weekStart),
    end: toLocalDateStr(end),
  }
}

function getWeekDates(weekStart: Date): string[] {
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    dates.push(toLocalDateStr(d))
  }
  return dates
}

interface UseCalendarDataReturn {
  // Calendar state
  weekStartDate: Date
  weekDates: string[] // 7 date strings (Mon-Sun)
  today: string // YYYY-MM-DD

  // Data
  dayMap: Map<string, CalendarDayData>
  plan: ReturnType<typeof useTrainingPlan>['plan']
  days: PlanDay[]
  events: Array<{ date: string; name: string; priority: string }>
  sessions: Session[]
  goals: Goal[]
  allEvents: Array<{ date: string; name: string; priority: string }>

  // Navigation
  goToNextWeek: () => void
  goToPrevWeek: () => void
  goToToday: () => void

  // Plan actions
  markComplete: (dayId: string, actual: { tss?: number; duration?: number }) => Promise<void>
  skipDay: (dayId: string) => Promise<void>
  rescheduleDay: (dayId: string, newDate: string) => Promise<void>
  updateNotes: (dayId: string, notes: string) => Promise<void>
  refresh: () => Promise<void>

  // Loading
  loading: boolean
  error: Error | null
}

export function useCalendarData(): UseCalendarDataReturn {
  const [weekStartDate, setWeekStartDate] = useState(() => getMondayOf(new Date()))
  const [sessions, setSessions] = useState<Session[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)

  const today = useMemo(() => {
    return toLocalDateStr(new Date())
  }, [])

  const weekDates = useMemo(() => getWeekDates(weekStartDate), [weekStartDate])

  const trainingPlan = useTrainingPlan()
  const { plan, days, events, loading: planLoading, error, markComplete, skipDay, rescheduleDay, updateNotes, refresh } = trainingPlan

  // Fetch sessions for the visible week range
  const { start, end } = useMemo(() => getWeekRange(weekStartDate), [weekStartDate])

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true)
    try {
      const res = await fetch(`/api/sessions?start=${start}&end=${end}&limit=200`)
      if (res.ok) {
        const data = await res.json()
        setSessions(data)
      }
    } catch {
      // Sessions are supplementary, don't break the page
    } finally {
      setSessionsLoading(false)
    }
  }, [start, end])

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch('/api/goals?status=active')
      if (res.ok) {
        const data = await res.json()
        setGoals(data)
      }
    } catch {
      // Goals are supplementary
    }
  }, [])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  useEffect(() => {
    fetchGoals()
  }, [fetchGoals])

  // Merge plan days, sessions, and events into a map keyed by date
  const dayMap = useMemo(() => {
    const map = new Map<string, CalendarDayData>()

    // Add plan days
    for (const day of days) {
      const existing = map.get(day.date) || { sessions: [] }
      existing.planDay = day
      map.set(day.date, existing)
    }

    // Add sessions
    for (const session of sessions) {
      const dateKey = session.date.split('T')[0]
      const existing = map.get(dateKey) || { sessions: [] }
      existing.sessions.push(session)
      map.set(dateKey, existing)
    }

    // Add events
    for (const event of events) {
      const existing = map.get(event.date) || { sessions: [] }
      existing.event = event
      map.set(event.date, existing)
    }

    return map
  }, [days, sessions, events])

  // Navigation
  const goToNextWeek = useCallback(() => {
    setWeekStartDate(prev => {
      const next = new Date(prev)
      next.setDate(prev.getDate() + 7)
      return next
    })
  }, [])

  const goToPrevWeek = useCallback(() => {
    setWeekStartDate(prev => {
      const next = new Date(prev)
      next.setDate(prev.getDate() - 7)
      return next
    })
  }, [])

  const goToToday = useCallback(() => {
    setWeekStartDate(getMondayOf(new Date()))
  }, [])

  return {
    weekStartDate,
    weekDates,
    today,
    dayMap,
    plan,
    days,
    events,
    sessions,
    goals,
    allEvents: events,
    goToNextWeek,
    goToPrevWeek,
    goToToday,
    markComplete,
    skipDay,
    rescheduleDay,
    updateNotes,
    refresh,
    loading: planLoading || sessionsLoading,
    error,
  }
}
