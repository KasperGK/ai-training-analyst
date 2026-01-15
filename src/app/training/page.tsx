'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PlanOverviewCard } from '@/components/training/plan-overview-card'
import { ScheduleView } from '@/components/training/schedule-view'
import { WorkoutDayDetail } from '@/components/training/workout-day-detail'
import { FitnessProjectionChart } from '@/components/training/fitness-projection-chart'
import { EventBanner } from '@/components/training/event-banner'
import { TargetEventSelector } from '@/components/training/target-event-selector'
import { useTrainingPlan } from '@/hooks/use-training-plan'
import { projectFitness } from '@/lib/fitness/projector'
import type { PlanDay } from '@/types'

export default function TrainingPage() {
  const router = useRouter()
  const {
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
    refresh,
  } = useTrainingPlan()

  const [selectedDay, setSelectedDay] = useState<PlanDay | null>(null)
  const [showEventSelector, setShowEventSelector] = useState(false)

  // Calculate fitness projections
  const projections = useMemo(() => {
    if (!plan || days.length === 0 || !currentFitness) return []

    return projectFitness({
      currentCtl: currentFitness.ctl,
      currentAtl: currentFitness.atl,
      currentDate: new Date().toISOString().split('T')[0],
      plannedDays: days,
      events: events,
    })
  }, [plan, days, events, currentFitness])

  const handleGeneratePlan = (primaryEventId: string, secondaryEventIds: string[]) => {
    // Navigate to chat with plan generation request
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
      <main className="flex-1 overflow-auto bg-background">
        <div className="container px-4 py-6">
          <div className="space-y-4 animate-pulse">
            <div className="h-32 bg-muted rounded-lg" />
            <div className="h-64 bg-muted rounded-lg" />
            <div className="h-96 bg-muted rounded-lg" />
          </div>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex-1 overflow-auto bg-background">
        <div className="container px-4 py-6">
          <div className="text-center py-12">
            <p className="text-destructive">Error loading training plan</p>
            <Button onClick={refresh} className="mt-4">Try Again</Button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 overflow-auto bg-background">
      <div className="container px-4 py-6 space-y-6">
        {plan ? (
          <>
            {/* Plan overview */}
            <PlanOverviewCard plan={plan} days={days} />

            {/* Fitness projection */}
            {projections.length > 0 && (
              <FitnessProjectionChart projections={projections} />
            )}

            {/* Schedule view */}
            <ScheduleView
              days={days}
              events={events}
              selectedDate={selectedDay?.date || null}
              onSelectDay={setSelectedDay}
            />
          </>
        ) : (
          <>
            {/* No plan state */}
            {upcomingEvents.length > 0 ? (
              <EventBanner
                events={upcomingEvents}
                onGeneratePlan={() => setShowEventSelector(true)}
              />
            ) : null}

            <div className="text-center py-12 space-y-4">
              <div className="text-muted-foreground">
                {upcomingEvents.length > 0 ? (
                  <p>Select your target events above to generate an optimized training plan.</p>
                ) : (
                  <>
                    <p>No active training plan.</p>
                    <p className="text-sm">
                      Add events on the <Link href="/events" className="underline">Events page</Link>,
                      or ask the AI coach to create a plan.
                    </p>
                  </>
                )}
              </div>
              <Button asChild>
                <Link href="/">Go to AI Coach</Link>
              </Button>
            </div>
          </>
        )}
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
    </main>
  )
}
