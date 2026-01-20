'use client'

/**
 * Workout Card Widget
 *
 * Displays a workout recommendation with:
 * - Workout name, category badge, duration, target TSS
 * - Description and purpose
 * - Personalized intervals with power targets (calculated from FTP)
 */

import { Badge } from '@/components/ui/badge'
import { Clock, Target, Zap, Info, AlertCircle } from 'lucide-react'
import type { WorkoutTemplate, WorkoutInterval } from '@/lib/workouts/library'

interface WorkoutCardWidgetProps {
  workout: WorkoutTemplate
  ftp: number
}

const categoryColors: Record<string, string> = {
  recovery: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  endurance: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  tempo: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  sweetspot: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  threshold: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  vo2max: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  anaerobic: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  sprint: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  mixed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (secs === 0) return `${mins}min`
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function calculatePowerTarget(ftp: number, intensityMin: number, intensityMax: number): string {
  const minWatts = Math.round(ftp * intensityMin / 100)
  const maxWatts = Math.round(ftp * intensityMax / 100)
  if (minWatts === maxWatts) return `${minWatts}W`
  return `${minWatts}-${maxWatts}W`
}

function IntervalRow({ interval, ftp, index }: { interval: WorkoutInterval; ftp: number; index: number }) {
  const powerTarget = calculatePowerTarget(ftp, interval.intensity_min, interval.intensity_max)

  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-muted-foreground w-6">#{index + 1}</span>
        <div>
          <div className="text-sm font-medium">
            {interval.sets}x {formatDuration(interval.duration_seconds)}
          </div>
          {interval.notes && (
            <div className="text-xs text-muted-foreground">{interval.notes}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span className="font-mono text-primary">{powerTarget}</span>
        <span className="text-muted-foreground">
          {formatDuration(interval.rest_seconds)} rest
        </span>
      </div>
    </div>
  )
}

export function WorkoutCardWidget({ workout, ftp }: WorkoutCardWidgetProps) {
  const avgTss = Math.round((workout.target_tss_range[0] + workout.target_tss_range[1]) / 2)
  const avgIf = ((workout.intensity_factor_range[0] + workout.intensity_factor_range[1]) / 2).toFixed(2)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-lg">{workout.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className={categoryColors[workout.category] || categoryColors.mixed}>
              {workout.category}
            </Badge>
            {workout.energy_systems.map(system => (
              <Badge key={system} variant="outline" className="text-xs">
                {system}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{workout.duration_minutes} min</span>
        </div>
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">~{avgTss} TSS</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">IF {avgIf}</span>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{workout.description}</p>
        <div className="flex items-start gap-2 text-sm bg-muted/50 rounded-lg p-3">
          <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-muted-foreground">{workout.purpose}</p>
        </div>
      </div>

      {/* Intervals */}
      {workout.intervals && workout.intervals.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            Intervals
            <span className="text-xs text-muted-foreground font-normal">
              (based on {ftp}W FTP)
            </span>
          </h4>
          <div className="bg-muted/30 rounded-lg p-3">
            {workout.intervals.map((interval, idx) => (
              <IntervalRow key={idx} interval={interval} ftp={ftp} index={idx} />
            ))}
          </div>
        </div>
      )}

      {/* Structure Overview */}
      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
        <div className="bg-muted/30 rounded p-2 text-center">
          <div className="font-medium">{workout.warmup_minutes} min</div>
          <div>Warmup</div>
        </div>
        <div className="bg-primary/10 rounded p-2 text-center text-primary">
          <div className="font-medium">
            {workout.duration_minutes - workout.warmup_minutes - workout.cooldown_minutes} min
          </div>
          <div>Main Set</div>
        </div>
        <div className="bg-muted/30 rounded p-2 text-center">
          <div className="font-medium">{workout.cooldown_minutes} min</div>
          <div>Cooldown</div>
        </div>
      </div>

      {/* Tips */}
      {workout.execution_tips.length > 0 && (
        <div className="text-xs space-y-1">
          <h5 className="font-medium text-muted-foreground">Tips</h5>
          <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
            {workout.execution_tips.slice(0, 3).map((tip, idx) => (
              <li key={idx}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Common Mistakes Warning */}
      {workout.common_mistakes.length > 0 && (
        <div className="flex items-start gap-2 text-xs bg-yellow-50 dark:bg-yellow-950/30 rounded-lg p-2">
          <AlertCircle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-500 mt-0.5 shrink-0" />
          <div>
            <span className="font-medium text-yellow-700 dark:text-yellow-400">Watch out: </span>
            <span className="text-yellow-600 dark:text-yellow-500">{workout.common_mistakes[0]}</span>
          </div>
        </div>
      )}
    </div>
  )
}
