'use client'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, Trophy, Flag } from 'lucide-react'
import type { Event } from '@/types'

interface EventWithWeeks extends Event {
  weeksUntil: number
  suggestedTemplate: string
}

interface EventBannerProps {
  events: EventWithWeeks[]
  onGeneratePlan: () => void
}

export function EventBanner({ events, onGeneratePlan }: EventBannerProps) {
  if (events.length === 0) return null

  // Get the nearest A race, or nearest B race, or any nearest event
  const aRaces = events.filter(e => e.priority === 'A')
  const bRaces = events.filter(e => e.priority === 'B')

  const primaryEvent = aRaces[0] || bRaces[0] || events[0]

  const PriorityIcon = primaryEvent.priority === 'A' ? Trophy : Flag

  return (
    <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
      <Calendar className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        <span>Upcoming Race</span>
        <Badge variant={primaryEvent.priority === 'A' ? 'default' : 'secondary'}>
          <PriorityIcon className="h-3 w-3 mr-1" />
          {primaryEvent.priority} Priority
        </Badge>
      </AlertTitle>
      <AlertDescription className="mt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="font-medium">{primaryEvent.name}</div>
            <div className="text-sm text-muted-foreground">
              {new Date(primaryEvent.date).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
              {' '}&middot;{' '}
              <span className="font-medium">{primaryEvent.weeksUntil} weeks away</span>
            </div>
            {events.length > 1 && (
              <div className="text-xs text-muted-foreground mt-1">
                +{events.length - 1} more event{events.length > 2 ? 's' : ''} scheduled
              </div>
            )}
          </div>
          <Button onClick={onGeneratePlan} size="sm">
            Generate Optimized Plan
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
