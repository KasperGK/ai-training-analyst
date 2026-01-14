'use client'

import { useState, useEffect, useCallback } from 'react'
import type { TrainingPlan, PlanDay, Event } from '@/types'

interface EventWithWeeks extends Event {
  weeksUntil: number
  suggestedTemplate: string
}

interface CurrentFitness {
  ctl: number
  atl: number
  tsb: number
}

interface UseTrainingPlanReturn {
  plan: TrainingPlan | null
  days: PlanDay[]
  events: Array<{ date: string; name: string; priority: string }>
  upcomingEvents: EventWithWeeks[]
  currentFitness: CurrentFitness | null
  loading: boolean
  error: Error | null
  markComplete: (dayId: string, actual: { tss?: number; duration?: number }) => Promise<void>
  skipDay: (dayId: string) => Promise<void>
  rescheduleDay: (dayId: string, newDate: string) => Promise<void>
  updateNotes: (dayId: string, notes: string) => Promise<void>
  refresh: () => Promise<void>
}

export function useTrainingPlan(): UseTrainingPlanReturn {
  const [plan, setPlan] = useState<TrainingPlan | null>(null)
  const [days, setDays] = useState<PlanDay[]>([])
  const [events, setEvents] = useState<Array<{ date: string; name: string; priority: string }>>([])
  const [upcomingEvents, setUpcomingEvents] = useState<EventWithWeeks[]>([])
  const [currentFitness, setCurrentFitness] = useState<CurrentFitness | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch active plan with days
      const planRes = await fetch('/api/training-plans')
      if (!planRes.ok) throw new Error('Failed to fetch training plan')
      const planData = await planRes.json()

      setPlan(planData.plan)
      setDays(planData.days || [])
      setEvents(planData.events || [])

      // Fetch suggestions (upcoming events, fitness)
      const suggestRes = await fetch('/api/training-plans?suggest=true')
      if (suggestRes.ok) {
        const suggestData = await suggestRes.json()
        setUpcomingEvents(suggestData.upcomingEvents || [])
        setCurrentFitness(suggestData.currentFitness)
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const markComplete = useCallback(async (
    dayId: string,
    actual: { tss?: number; duration?: number }
  ) => {
    if (!plan) return

    const res = await fetch(`/api/training-plans/${plan.id}/days/${dayId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        completed: true,
        actualTss: actual.tss,
        actualDuration: actual.duration,
      }),
    })

    if (!res.ok) throw new Error('Failed to mark workout complete')

    const { day: updatedDay, planProgress } = await res.json()

    // Update local state
    setDays(prev => prev.map(d => d.id === dayId ? updatedDay : d))
    setPlan(prev => prev ? { ...prev, progress_percent: planProgress } : null)
  }, [plan])

  const skipDay = useCallback(async (dayId: string) => {
    if (!plan) return

    const res = await fetch(`/api/training-plans/${plan.id}/days/${dayId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'skip' }),
    })

    if (!res.ok) throw new Error('Failed to skip workout')

    const { day: updatedDay } = await res.json()
    setDays(prev => prev.map(d => d.id === dayId ? updatedDay : d))
  }, [plan])

  const rescheduleDay = useCallback(async (dayId: string, newDate: string) => {
    if (!plan) return

    const res = await fetch(`/api/training-plans/${plan.id}/days/${dayId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reschedule',
        rescheduledTo: newDate,
      }),
    })

    if (!res.ok) throw new Error('Failed to reschedule workout')

    // Refresh to get updated days including the new rescheduled day
    await fetchData()
  }, [plan, fetchData])

  const updateNotes = useCallback(async (dayId: string, notes: string) => {
    if (!plan) return

    const res = await fetch(`/api/training-plans/${plan.id}/days/${dayId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })

    if (!res.ok) throw new Error('Failed to update notes')

    const { day: updatedDay } = await res.json()
    setDays(prev => prev.map(d => d.id === dayId ? updatedDay : d))
  }, [plan])

  return {
    plan,
    days,
    events,
    upcomingEvents,
    currentFitness,
    loading,
    error,
    markComplete,
    skipDay,
    rescheduleDay,
    updateNotes,
    refresh: fetchData,
  }
}
