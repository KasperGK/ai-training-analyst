'use client'

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  CheckCircle2,
  XCircle,
  Calendar,
  Clock,
  Zap,
  Target,
  MessageSquare,
} from 'lucide-react'
import type { PlanDay } from '@/types'

interface WorkoutDayDetailProps {
  day: PlanDay | null
  open: boolean
  onClose: () => void
  onMarkComplete: (dayId: string, actualTss?: number, actualDuration?: number) => Promise<void>
  onSkip: (dayId: string) => Promise<void>
  onReschedule: (dayId: string, newDate: string) => Promise<void>
  onUpdateNotes: (dayId: string, notes: string) => Promise<void>
}

export function WorkoutDayDetail({
  day,
  open,
  onClose,
  onMarkComplete,
  onSkip,
  onReschedule,
  onUpdateNotes,
}: WorkoutDayDetailProps) {
  const [actualTss, setActualTss] = useState('')
  const [actualDuration, setActualDuration] = useState('')
  const [notes, setNotes] = useState('')
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [loading, setLoading] = useState(false)

  if (!day) return null

  const isCompleted = day.completed
  const isSkipped = day.skipped

  const handleComplete = async () => {
    setLoading(true)
    try {
      await onMarkComplete(
        day.id,
        actualTss ? parseInt(actualTss) : undefined,
        actualDuration ? parseInt(actualDuration) : undefined
      )
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = async () => {
    setLoading(true)
    try {
      await onSkip(day.id)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const handleReschedule = async () => {
    if (!rescheduleDate) return
    setLoading(true)
    try {
      await onReschedule(day.id, rescheduleDate)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const handleSaveNotes = async () => {
    if (!notes.trim()) return
    setLoading(true)
    try {
      await onUpdateNotes(day.id, notes)
    } finally {
      setLoading(false)
    }
  }

  // Parse intervals if available
  const intervals = day.intervals_json as Array<{
    name: string
    duration: number
    power_min?: number
    power_max?: number
    rest?: number
  }> | null

  return (
    <Sheet open={open} onOpenChange={() => onClose()}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            {isCompleted && <CheckCircle2 className="h-5 w-5 text-green-500" />}
            {isSkipped && <XCircle className="h-5 w-5 text-yellow-500" />}
            <SheetTitle>{day.workout_name || 'Rest Day'}</SheetTitle>
          </div>
          <SheetDescription>
            {new Date(day.date).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Workout type and targets */}
          {day.workout_type && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{day.workout_type}</Badge>
              {day.target_tss && (
                <Badge variant="outline">
                  <Zap className="h-3 w-3 mr-1" />
                  {day.target_tss} TSS
                </Badge>
              )}
              {day.target_duration_minutes && (
                <Badge variant="outline">
                  <Clock className="h-3 w-3 mr-1" />
                  {day.target_duration_minutes} min
                </Badge>
              )}
              {day.target_if && (
                <Badge variant="outline">
                  <Target className="h-3 w-3 mr-1" />
                  IF {day.target_if}
                </Badge>
              )}
            </div>
          )}

          {/* Description */}
          {day.custom_description && (
            <div>
              <div className="text-sm font-medium mb-1">Description</div>
              <p className="text-sm text-muted-foreground">{day.custom_description}</p>
            </div>
          )}

          {/* Intervals */}
          {intervals && intervals.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">Intervals</div>
              <div className="space-y-2">
                {intervals.map((interval, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                  >
                    <span>{interval.name}</span>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>{Math.floor(interval.duration / 60)}:{(interval.duration % 60).toString().padStart(2, '0')}</span>
                      {interval.power_min && interval.power_max && (
                        <span className="text-xs">
                          {interval.power_min}-{interval.power_max}W
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Completion tracking */}
          {isCompleted ? (
            <div className="space-y-3">
              <div className="text-sm font-medium text-green-600">Workout Completed</div>
              {day.actual_tss && (
                <div className="text-sm">
                  Actual TSS: {day.actual_tss}
                  {day.target_tss && (
                    <span className="text-muted-foreground">
                      {' '}/ {day.target_tss} target ({Math.round((day.actual_tss / day.target_tss) * 100)}%)
                    </span>
                  )}
                </div>
              )}
              {day.compliance_score && (
                <div className="text-sm">
                  Compliance: {Math.round(day.compliance_score * 100)}%
                </div>
              )}
            </div>
          ) : isSkipped ? (
            <div className="text-sm text-yellow-600">
              This workout was skipped
              {day.rescheduled_to && (
                <span> and rescheduled to {new Date(day.rescheduled_to).toLocaleDateString()}</span>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm font-medium">Mark Complete</div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="actualTss" className="text-xs">Actual TSS</Label>
                  <Input
                    id="actualTss"
                    type="number"
                    placeholder={day.target_tss?.toString() || '0'}
                    value={actualTss}
                    onChange={(e) => setActualTss(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="actualDuration" className="text-xs">Duration (min)</Label>
                  <Input
                    id="actualDuration"
                    type="number"
                    placeholder={day.target_duration_minutes?.toString() || '0'}
                    value={actualDuration}
                    onChange={(e) => setActualDuration(e.target.value)}
                  />
                </div>
              </div>

              <Button
                onClick={handleComplete}
                disabled={loading}
                className="w-full"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark Complete
              </Button>

              <Separator />

              <div className="space-y-3">
                <Button
                  variant="outline"
                  onClick={handleSkip}
                  disabled={loading}
                  className="w-full"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Skip Workout
                </Button>

                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <Button
                    variant="outline"
                    onClick={handleReschedule}
                    disabled={loading || !rescheduleDate}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Reschedule
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Notes
            </Label>
            <Textarea
              id="notes"
              placeholder="Add notes about this workout..."
              value={notes || day.athlete_notes || ''}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveNotes}
              disabled={loading || !notes.trim()}
            >
              Save Notes
            </Button>
          </div>

          {day.coach_notes && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                Coach Notes
              </div>
              <p className="text-sm">{day.coach_notes}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
