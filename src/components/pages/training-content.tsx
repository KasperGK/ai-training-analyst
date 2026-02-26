'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CalendarToolbar } from '@/components/training/calendar-toolbar'
import { WeekCalendarGrid } from '@/components/training/month-calendar-grid'
import { WeekStatsCard } from '@/components/training/week-stats-card'
import type { WeekStats } from '@/components/training/week-stats-card'
import { WorkoutDayDetail } from '@/components/training/workout-day-detail'
import { EventBanner } from '@/components/training/event-banner'
import { TargetEventSelector } from '@/components/training/target-event-selector'
import { useCalendarData } from '@/hooks/use-calendar-data'
import { useTrainingPlan } from '@/hooks/use-training-plan'
import type { PlanDay } from '@/types'

export function TrainingContent() {
  const router = useRouter()
  const {
    weekStartDate,
    weekDates,
    today,
    dayMap,
    plan,
    days,
    events,
    sessions,
    goals,
    goToNextWeek,
    goToPrevWeek,
    goToToday,
    markComplete,
    skipDay,
    rescheduleDay,
    updateNotes,
    refresh,
    loading,
    error,
  } = useCalendarData()

  const { upcomingEvents } = useTrainingPlan()

  const [selectedDay, setSelectedDay] = useState<PlanDay | null>(null)
  const [showEventSelector, setShowEventSelector] = useState(false)

  const planProgress = useMemo(() => {
    if (!plan || days.length === 0) return 0
    const total = days.filter(d => d.workout_type !== 'rest').length
    if (total === 0) return 0
    const completed = days.filter(d => d.completed).length
    return Math.round((completed / total) * 100)
  }, [plan, days])

  const weekStats = useMemo<WeekStats>(() => {
    let plannedCount = 0
    let completedCount = 0
    let totalTss = 0
    let totalDuration = 0

    for (const date of weekDates) {
      const data = dayMap.get(date)
      if (data?.planDay && data.planDay.workout_type !== 'rest') {
        plannedCount++
        if (data.planDay.completed) completedCount++
      }
      if (data?.sessions) {
        for (const s of data.sessions) {
          if (s.tss) totalTss += s.tss
          totalDuration += s.duration_seconds
        }
      }
    }

    const hours = Math.floor(totalDuration / 3600)
    const minutes = Math.floor((totalDuration % 3600) / 60)

    return { completedCount, plannedCount, totalTss, hours, minutes }
  }, [weekDates, dayMap])

  const handleGeneratePlan = (primaryEventId: string, secondaryEventIds: string[]) => {
    const primaryEvent = upcomingEvents.find(e => e.id === primaryEventId)
    if (!primaryEvent) return

    const message = encodeURIComponent(
      `Generate a training plan for my ${primaryEvent.name} event on ${primaryEvent.date}. ` +
      `It's ${primaryEvent.weeksUntil} weeks away and it's my primary target (${primaryEvent.priority} priority).` +
      (secondaryEventIds.length > 0
        ? ` I also want to maintain form for ${secondaryEventIds.length} other events.`
        : '')
    )

    router.push(`/?chat=${message}`)
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col overflow-hidden bg-muted/40">
        <div className="flex flex-col flex-1 min-h-0 px-6 pt-[88px] pb-3">
          <div className="space-y-4 animate-pulse">
            <div className="h-10 bg-muted rounded-lg w-64" />
            <div className="flex-1 h-[600px] bg-muted rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex flex-col overflow-hidden bg-muted/40">
        <div className="flex flex-col flex-1 min-h-0 px-6 pt-[88px] pb-3">
          <div className="text-center py-12">
            <p className="text-destructive">Error loading training data</p>
            <Button onClick={refresh} className="mt-4">Try Again</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-muted/40">
      <div className="flex flex-col flex-1 min-h-0 px-6 pt-[88px] pb-3">
        {/* No plan banner */}
        {!plan && upcomingEvents.length > 0 && (
          <div className="mb-3 shrink-0">
            <EventBanner
              events={upcomingEvents}
              onGeneratePlan={() => setShowEventSelector(true)}
            />
          </div>
        )}

        {!plan && upcomingEvents.length === 0 && sessions.length === 0 && (
          <div className="text-center py-12 space-y-4 mb-4 shrink-0">
            <div className="text-muted-foreground">
              <p>No active training plan.</p>
              <p className="text-sm">
                Add events on the <Link href="/events" className="underline">Events page</Link>,
                or ask the AI coach to create a plan.
              </p>
            </div>
            <Button asChild>
              <Link href="/">Go to AI Coach</Link>
            </Button>
          </div>
        )}

        {/* Calendar card with toolbar inside */}
        <Card className="flex-1 min-h-0 p-4 flex flex-col">
          <div className="shrink-0 mb-3">
            <CalendarToolbar
              weekStartDate={weekStartDate}
              onPrevWeek={goToPrevWeek}
              onNextWeek={goToNextWeek}
              onToday={goToToday}
              events={events}
              today={today}
            />
          </div>
          <WeekCalendarGrid
            weekStartDate={weekStartDate}
            weekDates={weekDates}
            today={today}
            dayMap={dayMap}
            onSelectDay={setSelectedDay}
            className="h-full"
          />
        </Card>

        {/* This Week stats — horizontal bar below calendar */}
        <div className="shrink-0 mt-3">
          <WeekStatsCard
            weekStats={weekStats}
            goals={goals}
            plan={plan}
            planProgress={planProgress}
            events={events}
            today={today}
          />
        </div>
      </div>

      {/* Workout detail sheet */}
      <WorkoutDayDetail
        day={selectedDay}
        open={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        onMarkComplete={async (dayId, actualTss, actualDuration) => {
          await markComplete(dayId, { tss: actualTss, duration: actualDuration })
          await refresh()
        }}
        onSkip={async (dayId) => {
          await skipDay(dayId)
          await refresh()
        }}
        onReschedule={async (dayId, newDate) => {
          await rescheduleDay(dayId, newDate)
          await refresh()
        }}
        onUpdateNotes={async (dayId, notes) => {
          await updateNotes(dayId, notes)
        }}
      />

      {/* Event selector modal */}
      <TargetEventSelector
        open={showEventSelector}
        onClose={() => setShowEventSelector(false)}
        events={upcomingEvents}
        onGenerate={handleGeneratePlan}
      />
    </div>
  )
}
