/**
 * Pattern Detector
 *
 * Analyzes training data to detect patterns, trends, and notable events
 * that can be turned into proactive insights.
 */

import { createClient } from '@/lib/supabase/server'

export interface DetectedPattern {
  type: 'trend' | 'warning' | 'achievement' | 'suggestion' | 'pattern' | 'event_prep'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  title: string
  description: string
  data: Record<string, unknown>
}

interface FitnessData {
  date: string
  ctl: number
  atl: number
  tsb: number
}

interface SessionData {
  id: string
  date: string
  sport: string
  tss: number | null
  duration_seconds: number
  avg_power: number | null
  normalized_power: number | null
  intensity_factor: number | null
  workout_type: string | null
}

interface EventData {
  id: string
  name: string
  date: string
  priority: string
}

/**
 * Detect all patterns for an athlete
 */
export async function detectPatterns(athleteId: string): Promise<DetectedPattern[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const patterns: DetectedPattern[] = []

  // Fetch data in parallel
  const [fitnessResult, sessionsResult, eventsResult] = await Promise.all([
    // Last 90 days of fitness data
    supabase
      .from('fitness_history')
      .select('date, ctl, atl, tsb')
      .eq('athlete_id', athleteId)
      .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: false }),

    // Last 30 days of sessions
    supabase
      .from('sessions')
      .select('id, date, sport, tss, duration_seconds, avg_power, normalized_power, intensity_factor, workout_type')
      .eq('athlete_id', athleteId)
      .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: false }),

    // Upcoming events
    supabase
      .from('events')
      .select('id, name, date, priority')
      .eq('athlete_id', athleteId)
      .gte('date', new Date().toISOString().split('T')[0])
      .order('date', { ascending: true })
      .limit(5),
  ])

  const fitness = (fitnessResult.data || []) as FitnessData[]
  const sessions = (sessionsResult.data || []) as SessionData[]
  const events = (eventsResult.data || []) as EventData[]

  // Run all pattern detectors
  patterns.push(...detectFitnessTrends(fitness))
  patterns.push(...detectFatigueWarnings(fitness))
  patterns.push(...detectAchievements(sessions))
  patterns.push(...detectTrainingPatterns(sessions))
  patterns.push(...detectEventPrep(events, fitness))
  patterns.push(...detectFormSuggestions(fitness))

  return patterns
}

/**
 * Detect fitness trends (CTL changes)
 */
function detectFitnessTrends(fitness: FitnessData[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = []

  if (fitness.length < 14) return patterns

  const current = fitness[0]
  const twoWeeksAgo = fitness.find((f, i) => i >= 13) || fitness[fitness.length - 1]
  const fourWeeksAgo = fitness.find((f, i) => i >= 27)

  if (!current || !twoWeeksAgo) return patterns

  // CTL change over 2 weeks
  const ctlChange2w = current.ctl - twoWeeksAgo.ctl
  const ctlChangePercent2w = twoWeeksAgo.ctl > 0 ? (ctlChange2w / twoWeeksAgo.ctl) * 100 : 0

  if (ctlChangePercent2w >= 10) {
    patterns.push({
      type: 'trend',
      priority: 'medium',
      title: 'Fitness Building Nicely',
      description: `Your CTL has increased ${Math.round(ctlChangePercent2w)}% over the last 2 weeks (${Math.round(twoWeeksAgo.ctl)} → ${Math.round(current.ctl)}). Great progress!`,
      data: { ctlChange: ctlChange2w, ctlChangePercent: ctlChangePercent2w, period: '2 weeks' },
    })
  } else if (ctlChangePercent2w <= -10) {
    patterns.push({
      type: 'trend',
      priority: 'medium',
      title: 'Fitness Declining',
      description: `Your CTL has dropped ${Math.round(Math.abs(ctlChangePercent2w))}% over the last 2 weeks. Consider whether this is intentional (rest/taper) or if you need to increase training load.`,
      data: { ctlChange: ctlChange2w, ctlChangePercent: ctlChangePercent2w, period: '2 weeks' },
    })
  }

  // 4-week trend if available
  if (fourWeeksAgo) {
    const ctlChange4w = current.ctl - fourWeeksAgo.ctl
    const ctlChangePercent4w = fourWeeksAgo.ctl > 0 ? (ctlChange4w / fourWeeksAgo.ctl) * 100 : 0

    if (ctlChangePercent4w >= 20) {
      patterns.push({
        type: 'achievement',
        priority: 'low',
        title: 'Monthly Fitness Milestone',
        description: `Your fitness (CTL) is up ${Math.round(ctlChangePercent4w)}% over the past month. Consistent work is paying off!`,
        data: { ctlChange: ctlChange4w, ctlChangePercent: ctlChangePercent4w, period: '4 weeks' },
      })
    }
  }

  return patterns
}

/**
 * Detect fatigue warnings
 */
function detectFatigueWarnings(fitness: FitnessData[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = []

  if (fitness.length === 0) return patterns

  const current = fitness[0]

  // Very negative TSB (deep fatigue)
  if (current.tsb < -30) {
    patterns.push({
      type: 'warning',
      priority: 'urgent',
      title: 'High Fatigue Alert',
      description: `Your form (TSB) is at ${Math.round(current.tsb)}, indicating significant fatigue. Consider a rest day or easy recovery ride to avoid overtraining.`,
      data: { tsb: current.tsb, atl: current.atl, ctl: current.ctl },
    })
  } else if (current.tsb < -20) {
    patterns.push({
      type: 'warning',
      priority: 'high',
      title: 'Elevated Fatigue',
      description: `Your form (TSB) is at ${Math.round(current.tsb)}. You're carrying fatigue - a lighter day might help you absorb recent training.`,
      data: { tsb: current.tsb, atl: current.atl, ctl: current.ctl },
    })
  }

  // ATL spiking (acute training load too high)
  if (current.atl > current.ctl * 1.5 && current.atl > 80) {
    patterns.push({
      type: 'warning',
      priority: 'high',
      title: 'Training Load Spike',
      description: `Your acute load (ATL: ${Math.round(current.atl)}) is significantly higher than your chronic load (CTL: ${Math.round(current.ctl)}). Be careful not to overreach.`,
      data: { atl: current.atl, ctl: current.ctl, ratio: current.atl / current.ctl },
    })
  }

  return patterns
}

/**
 * Detect achievements (PRs, milestones)
 */
function detectAchievements(sessions: SessionData[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = []

  if (sessions.length < 2) return patterns

  // Check for power PRs in recent sessions
  const recentWithPower = sessions.filter(s => s.normalized_power && s.duration_seconds >= 1200) // 20+ min
  if (recentWithPower.length > 0) {
    const maxNP = Math.max(...recentWithPower.map(s => s.normalized_power!))
    const maxNPSession = recentWithPower.find(s => s.normalized_power === maxNP)

    // Check if this is the best in the dataset (simple PR detection)
    const isRecent = maxNPSession && new Date(maxNPSession.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    if (isRecent && maxNP > 200) { // Only notable if NP is meaningful
      patterns.push({
        type: 'achievement',
        priority: 'medium',
        title: 'Strong Power Output',
        description: `Your recent ride hit ${Math.round(maxNP)}W normalized power - one of your best efforts in the past month!`,
        data: { normalizedPower: maxNP, sessionId: maxNPSession?.id, date: maxNPSession?.date },
      })
    }
  }

  // Training consistency
  const daysWithTraining = new Set(sessions.map(s => s.date)).size
  if (daysWithTraining >= 20) {
    patterns.push({
      type: 'achievement',
      priority: 'low',
      title: 'Training Consistency',
      description: `You've trained ${daysWithTraining} days in the last month. Consistency is key to improvement!`,
      data: { trainingDays: daysWithTraining },
    })
  }

  // Volume milestone
  const totalHours = sessions.reduce((sum, s) => sum + s.duration_seconds, 0) / 3600
  if (totalHours >= 40) {
    patterns.push({
      type: 'achievement',
      priority: 'low',
      title: 'High Training Volume',
      description: `You've logged ${Math.round(totalHours)} hours of training in the past month. Solid volume!`,
      data: { totalHours },
    })
  }

  return patterns
}

/**
 * Detect training patterns
 */
function detectTrainingPatterns(sessions: SessionData[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = []

  if (sessions.length < 7) return patterns

  // Check for too many high intensity days in a row
  const highIntensitySessions = sessions.filter(s => (s.intensity_factor || 0) > 0.85)
  const recentHighIntensity = highIntensitySessions.filter(s =>
    new Date(s.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  )

  if (recentHighIntensity.length >= 4) {
    patterns.push({
      type: 'pattern',
      priority: 'medium',
      title: 'Heavy Intensity Week',
      description: `You've done ${recentHighIntensity.length} high-intensity sessions in the past week. Consider adding more recovery rides to balance the load.`,
      data: { highIntensityCount: recentHighIntensity.length },
    })
  }

  // Check for lack of variety
  const workoutTypes = sessions.map(s => s.workout_type).filter(Boolean)
  const uniqueTypes = new Set(workoutTypes)
  if (sessions.length >= 10 && uniqueTypes.size <= 2) {
    patterns.push({
      type: 'suggestion',
      priority: 'low',
      title: 'Add Training Variety',
      description: `Your recent training has been mostly the same type. Consider mixing in different workout styles to target different energy systems.`,
      data: { workoutTypes: Array.from(uniqueTypes) },
    })
  }

  return patterns
}

/**
 * Detect event preparation needs
 */
function detectEventPrep(events: EventData[], fitness: FitnessData[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = []

  if (events.length === 0) return patterns

  const now = new Date()
  const priorityEvents = events.filter(e => e.priority === 'A' || e.priority === 'B')

  for (const event of priorityEvents) {
    const eventDate = new Date(event.date)
    const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))

    if (daysUntil <= 21 && daysUntil > 14) {
      patterns.push({
        type: 'event_prep',
        priority: 'high',
        title: `3 Weeks to ${event.name}`,
        description: `Your ${event.priority}-priority event is in ${daysUntil} days. This is typically when you'd start reducing volume while maintaining intensity.`,
        data: { eventId: event.id, eventName: event.name, daysUntil },
      })
    } else if (daysUntil <= 14 && daysUntil > 7) {
      patterns.push({
        type: 'event_prep',
        priority: 'high',
        title: `2 Weeks to ${event.name}`,
        description: `${event.name} is in ${daysUntil} days. Time to start your taper - reduce volume by 30-40% while keeping some intensity.`,
        data: { eventId: event.id, eventName: event.name, daysUntil },
      })
    } else if (daysUntil <= 7 && daysUntil > 3) {
      patterns.push({
        type: 'event_prep',
        priority: 'urgent',
        title: `Race Week: ${event.name}`,
        description: `${event.name} is in ${daysUntil} days! Keep rides short and easy, maybe one opener workout. Focus on rest, nutrition, and mental prep.`,
        data: { eventId: event.id, eventName: event.name, daysUntil },
      })
    }
  }

  return patterns
}

/**
 * Detect form-based suggestions
 */
function detectFormSuggestions(fitness: FitnessData[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = []

  if (fitness.length === 0) return patterns

  const current = fitness[0]

  // Good form for hard workout
  if (current.tsb >= 5 && current.tsb <= 25 && current.ctl >= 40) {
    patterns.push({
      type: 'suggestion',
      priority: 'medium',
      title: 'Good Day for Intensity',
      description: `Your form (TSB: ${Math.round(current.tsb)}) is in the sweet spot. You're fresh enough for a quality workout but fit enough to handle it.`,
      data: { tsb: current.tsb, ctl: current.ctl },
    })
  }

  // Very fresh - might be losing fitness
  if (current.tsb > 30) {
    patterns.push({
      type: 'suggestion',
      priority: 'low',
      title: 'Time to Train',
      description: `Your form (TSB: ${Math.round(current.tsb)}) is very high. Unless you're tapering, you might be losing fitness. Consider getting back to training.`,
      data: { tsb: current.tsb },
    })
  }

  return patterns
}
