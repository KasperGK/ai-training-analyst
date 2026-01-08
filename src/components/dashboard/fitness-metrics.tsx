'use client'

import { MetricCard } from './metric-card'
import type { CurrentFitness } from '@/types'

interface FitnessMetricsProps {
  fitness: CurrentFitness
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

export function FitnessMetrics({ fitness }: FitnessMetricsProps) {
  const tsbStatus = getTSBStatus(fitness.tsb)
  const ctlStatus = getCTLStatus(fitness.ctl_trend)

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Fitness (CTL)"
        value={Math.round(fitness.ctl)}
        description="42-day training load"
        trend={fitness.ctl_trend}
        trendValue={fitness.ctl_trend === 'up' ? '+3 this week' : fitness.ctl_trend === 'down' ? '-2 this week' : 'Stable'}
        status={ctlStatus}
      />
      <MetricCard
        title="Fatigue (ATL)"
        value={Math.round(fitness.atl)}
        description="7-day training load"
        status="neutral"
      />
      <MetricCard
        title="Form (TSB)"
        value={fitness.tsb > 0 ? `+${Math.round(fitness.tsb)}` : Math.round(fitness.tsb)}
        description={getTSBDescription(fitness.tsb)}
        status={tsbStatus}
      />
      {fitness.days_until_event !== undefined && (
        <MetricCard
          title="Next Event"
          value={`${fitness.days_until_event}d`}
          description={fitness.event_name}
          status={fitness.days_until_event < 14 ? 'warning' : 'neutral'}
        />
      )}
    </div>
  )
}
