'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Trophy, Flag, Calendar } from 'lucide-react'
import type { Event } from '@/types'

interface EventWithWeeks extends Event {
  weeksUntil: number
  suggestedTemplate: string
}

interface TargetEventSelectorProps {
  open: boolean
  onClose: () => void
  events: EventWithWeeks[]
  onGenerate: (primaryEventId: string, secondaryEventIds: string[]) => void
}

export function TargetEventSelector({
  open,
  onClose,
  events,
  onGenerate,
}: TargetEventSelectorProps) {
  const [primaryEventId, setPrimaryEventId] = useState<string>(
    events.find(e => e.priority === 'A')?.id || events[0]?.id || ''
  )
  const [secondaryEventIds, setSecondaryEventIds] = useState<string[]>([])

  const handleSecondaryToggle = (eventId: string) => {
    if (eventId === primaryEventId) return // Can't be both primary and secondary

    setSecondaryEventIds(prev =>
      prev.includes(eventId)
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    )
  }

  const handlePrimaryChange = (eventId: string) => {
    setPrimaryEventId(eventId)
    // Remove from secondary if it was there
    setSecondaryEventIds(prev => prev.filter(id => id !== eventId))
  }

  const handleGenerate = () => {
    onGenerate(primaryEventId, secondaryEventIds)
    onClose()
  }

  const primaryEvent = events.find(e => e.id === primaryEventId)

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Target Events</DialogTitle>
          <DialogDescription>
            Choose which event(s) to optimize your training plan for.
            Your primary target will get full peak/taper optimization.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Primary event selection */}
          <div>
            <Label className="text-sm font-medium">Primary Target (Peak For)</Label>
            <RadioGroup
              value={primaryEventId}
              onValueChange={handlePrimaryChange}
              className="mt-2 space-y-2"
            >
              {events.map(event => {
                const PriorityIcon = event.priority === 'A' ? Trophy : Flag

                return (
                  <div
                    key={event.id}
                    className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent cursor-pointer"
                    onClick={() => handlePrimaryChange(event.id)}
                  >
                    <RadioGroupItem value={event.id} id={`primary-${event.id}`} />
                    <PriorityIcon className={`h-4 w-4 ${
                      event.priority === 'A' ? 'text-amber-500' : 'text-gray-400'
                    }`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{event.name}</span>
                        <Badge variant={event.priority === 'A' ? 'default' : 'secondary'} className="text-xs">
                          {event.priority}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <Calendar className="h-3 w-3" />
                        {new Date(event.date).toLocaleDateString()} ({event.weeksUntil} weeks)
                      </div>
                    </div>
                  </div>
                )
              })}
            </RadioGroup>
          </div>

          {/* Secondary events */}
          {events.length > 1 && (
            <div>
              <Label className="text-sm font-medium">Secondary Events (Maintain Form)</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                Plan will try to keep you in decent form for these events too
              </p>
              <div className="space-y-2">
                {events
                  .filter(e => e.id !== primaryEventId)
                  .map(event => {
                    const PriorityIcon = event.priority === 'A' ? Trophy : Flag
                    const isSelected = secondaryEventIds.includes(event.id)

                    return (
                      <div
                        key={event.id}
                        className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent cursor-pointer"
                        onClick={() => handleSecondaryToggle(event.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleSecondaryToggle(event.id)}
                        />
                        <PriorityIcon className={`h-4 w-4 ${
                          event.priority === 'A' ? 'text-amber-500' : 'text-gray-400'
                        }`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{event.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {event.priority}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(event.date).toLocaleDateString()} ({event.weeksUntil} weeks)
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {/* Summary */}
          {primaryEvent && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm font-medium">Plan Summary</div>
              <div className="text-xs text-muted-foreground mt-1">
                <p>Primary peak: {primaryEvent.name} in {primaryEvent.weeksUntil} weeks</p>
                <p>Suggested template: {primaryEvent.suggestedTemplate.replace(/([A-Z])/g, ' $1').trim()}</p>
                {secondaryEventIds.length > 0 && (
                  <p>Also maintaining form for {secondaryEventIds.length} other event(s)</p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={!primaryEventId}>
            Generate Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
