/**
 * Widget Registry
 *
 * Maps widget types to their metadata.
 * The actual components are rendered in the canvas component.
 */

import type { WidgetType } from './types'

export interface WidgetDefinition {
  type: WidgetType
  name: string
  description: string
  keywords: string[] // For AI to match user requests
}

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  {
    type: 'fitness',
    name: 'Fitness Metrics',
    description: 'Current CTL (fitness), ATL (fatigue), and TSB (form) values with trends',
    keywords: ['fitness', 'ctl', 'atl', 'tsb', 'form', 'fatigue', 'freshness', 'training load']
  },
  {
    type: 'pmc-chart',
    name: 'PMC Chart',
    description: 'Performance Management Chart showing fitness, fatigue, and form over time',
    keywords: ['pmc', 'performance', 'chart', 'fitness history', 'training history', 'ctl chart', 'form chart']
  },
  {
    type: 'sessions',
    name: 'Recent Sessions',
    description: 'Table of recent training sessions with TSS, duration, and intensity',
    keywords: ['sessions', 'workouts', 'activities', 'rides', 'training', 'recent', 'history']
  },
  {
    type: 'sleep',
    name: 'Sleep Metrics',
    description: 'Sleep duration, quality score, and recent sleep trends',
    keywords: ['sleep', 'recovery', 'rest', 'sleep score', 'hours slept']
  },
  {
    type: 'power-curve',
    name: 'Power Curve',
    description: 'Power duration curve showing best power outputs across time durations',
    keywords: ['power', 'power curve', 'ftp', 'watts', 'peak power', 'power profile', 'mmp']
  }
]

/**
 * Find widgets matching a user query
 */
export function findMatchingWidgets(query: string): WidgetDefinition[] {
  const lowerQuery = query.toLowerCase()

  return WIDGET_REGISTRY.filter(widget =>
    widget.keywords.some(kw => lowerQuery.includes(kw)) ||
    widget.name.toLowerCase().includes(lowerQuery) ||
    widget.description.toLowerCase().includes(lowerQuery)
  )
}
