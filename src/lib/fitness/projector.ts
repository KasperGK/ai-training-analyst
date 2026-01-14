import type { PlanDay } from '@/types'

// CTL and ATL time constants (days)
const CTL_TIME_CONSTANT = 42
const ATL_TIME_CONSTANT = 7

export interface ProjectedFitness {
  date: string
  projectedCtl: number
  projectedAtl: number
  projectedTsb: number
  plannedTss: number
  isEventDay: boolean
  eventName?: string
  eventPriority?: string
  isCompleted: boolean
  isSkipped: boolean
}

export interface FitnessProjectionInput {
  currentCtl: number
  currentAtl: number
  currentDate: string
  plannedDays: PlanDay[]
  events: Array<{ date: string; name: string; priority: string }>
}

/**
 * Project fitness (CTL/ATL/TSB) based on current fitness and planned workouts
 *
 * Uses exponential weighted moving average:
 * - CTL = yesterday_CTL + (today_TSS - yesterday_CTL) / 42
 * - ATL = yesterday_ATL + (today_TSS - yesterday_ATL) / 7
 * - TSB = CTL - ATL
 */
export function projectFitness(input: FitnessProjectionInput): ProjectedFitness[] {
  const { currentCtl, currentAtl, currentDate, plannedDays, events } = input

  if (plannedDays.length === 0) {
    return []
  }

  // Create a map of dates to planned TSS
  const daysByDate = new Map<string, PlanDay>()
  plannedDays.forEach(day => {
    daysByDate.set(day.date, day)
  })

  // Create a map of event dates
  const eventsByDate = new Map<string, { name: string; priority: string }>()
  events.forEach(event => {
    eventsByDate.set(event.date, { name: event.name, priority: event.priority })
  })

  // Find date range
  const dates = plannedDays.map(d => d.date).sort()
  const startDate = dates[0]
  const endDate = dates[dates.length - 1]

  // Generate projection for each day
  const projections: ProjectedFitness[] = []
  let ctl = currentCtl
  let atl = currentAtl

  // Start from current date or plan start, whichever is earlier
  const iterationStart = new Date(Math.min(
    new Date(currentDate).getTime(),
    new Date(startDate).getTime()
  ))
  const iterationEnd = new Date(endDate)

  const currentDateObj = new Date(currentDate)
  const current = new Date(iterationStart)

  while (current <= iterationEnd) {
    const dateStr = current.toISOString().split('T')[0]
    const day = daysByDate.get(dateStr)
    const event = eventsByDate.get(dateStr)

    // Determine TSS for this day
    let tss = 0
    let isCompleted = false
    let isSkipped = false

    if (day) {
      isCompleted = day.completed
      isSkipped = day.skipped || false

      if (isCompleted && day.actual_tss) {
        // Use actual TSS if completed
        tss = day.actual_tss
      } else if (isSkipped) {
        // Skipped day = 0 TSS
        tss = 0
      } else if (current > currentDateObj) {
        // Future day: use target TSS
        tss = day.target_tss || 0
      }
    }

    // Calculate new fitness values using exponential decay
    ctl = ctl + (tss - ctl) / CTL_TIME_CONSTANT
    atl = atl + (tss - atl) / ATL_TIME_CONSTANT
    const tsb = ctl - atl

    projections.push({
      date: dateStr,
      projectedCtl: Math.round(ctl * 10) / 10,
      projectedAtl: Math.round(atl * 10) / 10,
      projectedTsb: Math.round(tsb * 10) / 10,
      plannedTss: tss,
      isEventDay: !!event,
      eventName: event?.name,
      eventPriority: event?.priority,
      isCompleted,
      isSkipped,
    })

    current.setDate(current.getDate() + 1)
  }

  return projections
}

/**
 * Get projected fitness on a specific date
 */
export function getProjectedFitnessOnDate(
  projections: ProjectedFitness[],
  date: string
): ProjectedFitness | null {
  return projections.find(p => p.date === date) || null
}

/**
 * Get projected fitness on event days
 */
export function getEventDayProjections(
  projections: ProjectedFitness[]
): ProjectedFitness[] {
  return projections.filter(p => p.isEventDay)
}

/**
 * Check if TSB on race day is in optimal range (typically 5-25 for peak performance)
 */
export function isOptimalTsbForRace(tsb: number): 'optimal' | 'low' | 'high' {
  if (tsb >= 5 && tsb <= 25) {
    return 'optimal'
  } else if (tsb < 5) {
    return 'low' // Too fatigued
  } else {
    return 'high' // May have lost some fitness
  }
}

/**
 * Calculate summary statistics for a projection
 */
export function getProjectionSummary(projections: ProjectedFitness[]): {
  peakCtl: number
  peakCtlDate: string
  endCtl: number
  averageTss: number
  totalTss: number
  eventSummaries: Array<{
    date: string
    name: string
    tsb: number
    status: 'optimal' | 'low' | 'high'
  }>
} {
  if (projections.length === 0) {
    return {
      peakCtl: 0,
      peakCtlDate: '',
      endCtl: 0,
      averageTss: 0,
      totalTss: 0,
      eventSummaries: [],
    }
  }

  let peakCtl = 0
  let peakCtlDate = ''
  let totalTss = 0

  const eventSummaries: Array<{
    date: string
    name: string
    tsb: number
    status: 'optimal' | 'low' | 'high'
  }> = []

  projections.forEach(p => {
    if (p.projectedCtl > peakCtl) {
      peakCtl = p.projectedCtl
      peakCtlDate = p.date
    }
    totalTss += p.plannedTss

    if (p.isEventDay && p.eventName) {
      eventSummaries.push({
        date: p.date,
        name: p.eventName,
        tsb: p.projectedTsb,
        status: isOptimalTsbForRace(p.projectedTsb),
      })
    }
  })

  return {
    peakCtl,
    peakCtlDate,
    endCtl: projections[projections.length - 1].projectedCtl,
    averageTss: Math.round(totalTss / projections.length),
    totalTss,
    eventSummaries,
  }
}
