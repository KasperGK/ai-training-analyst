'use client'

import { MetricCard } from './metric-card'
import type { CurrentFitness } from '@/types'

interface FitnessMetricsProps {
  fitness: CurrentFitness | null | undefined
}

function getTSBStatus(tsb: number): 'good' | 'warning' | 'bad' | 'neutral' {
  if (tsb > 25) return 'warning'
  if (tsb >= 5) return 'good'
  if (tsb >= -10) return 'neutral'
  if (tsb >= -25) return 'warning'
  return 'bad'
}

function getTSBDescription(tsb: number): string {
  if (tsb > 25) return 'Very fresh - may be detraining'
  if (tsb >= 5) return 'Fresh and ready to perform'
  if (tsb >= -10) return 'Optimal training zone'
  if (tsb >= -25) return 'Accumulated fatigue'
  return 'Risk of overtraining'
}

function getCTLStatus(trend: 'up' | 'down' | 'stable'): 'good' | 'warning' | 'bad' | 'neutral' {
  if (trend === 'up') return 'good'
  if (trend === 'down') return 'warning'
  return 'neutral'
}

/**
 * Individual Fitness Card (CTL)
 */
export function FitnessCard({ fitness }: FitnessMetricsProps) {
  if (!fitness) {
    return (
      <MetricCard
        title="Fitness (CTL)"
        value="—"
        description="Connect to see data"
        status="neutral"
        href="/athlete?tab=history"
      />
    )
  }

  const ctlStatus = getCTLStatus(fitness.ctl_trend)

  const ctlChange = fitness.ctl_change ?? 0
  const trendValue = ctlChange > 0 ? `+${ctlChange}` : ctlChange.toString()

  return (
    <MetricCard
      title="Fitness (CTL)"
      value={Math.round(fitness.ctl)}
      description="42-day training load"
      trend={fitness.ctl_trend}
      trendValue={trendValue}
      status={ctlStatus}
      href="/athlete?tab=history"
    />
  )
}

/**
 * Individual Fatigue Card (ATL)
 */
export function FatigueCard({ fitness }: FitnessMetricsProps) {
  if (!fitness) {
    return (
      <MetricCard
        title="Fatigue (ATL)"
        value="—"
        description="Connect to see data"
        status="neutral"
        href="/athlete?tab=history"
      />
    )
  }

  return (
    <MetricCard
      title="Fatigue (ATL)"
      value={Math.round(fitness.atl)}
      description="7-day training load"
      status="neutral"
      href="/athlete?tab=history"
    />
  )
}

/**
 * Individual Form Card (TSB)
 */
export function FormCard({ fitness }: FitnessMetricsProps) {
  if (!fitness) {
    return (
      <MetricCard
        title="Form (TSB)"
        value="—"
        description="Connect to see data"
        status="neutral"
        href="/athlete?tab=history"
      />
    )
  }

  const tsbStatus = getTSBStatus(fitness.tsb)

  return (
    <MetricCard
      title="Form (TSB)"
      value={fitness.tsb > 0 ? `+${Math.round(fitness.tsb)}` : Math.round(fitness.tsb)}
      description={getTSBDescription(fitness.tsb)}
      status={tsbStatus}
      href="/athlete?tab=history"
    />
  )
}

/**
 * Combined Fitness Metrics (renders all 3 cards as fragment)
 * @deprecated Use individual card exports (FitnessCard, FatigueCard, FormCard) for grid layout
 */
export function FitnessMetrics({ fitness }: FitnessMetricsProps) {
  return (
    <>
      <FitnessCard fitness={fitness} />
      <FatigueCard fitness={fitness} />
      <FormCard fitness={fitness} />
    </>
  )
}
