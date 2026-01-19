'use client'

/**
 * AI Coach Canvas
 *
 * Displays widgets selected by the AI. Each widget type maps to
 * an existing dashboard component. When AI provides context via
 * the showOnCanvas tool, widgets are wrapped in InsightCard for
 * insight-first display.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FitnessCard, FatigueCard, FormCard } from '@/components/dashboard/fitness-metrics'
import { PMCChart } from '@/components/dashboard/pmc-chart'
import { SessionsTable } from '@/components/dashboard/sessions-table'
import { SleepCard } from '@/components/dashboard/sleep-card'
import { PowerCurveChart } from '@/components/power/power-curve-chart'
import { InsightCard } from '@/components/coach/insight-card'
import { useIntervalsData } from '@/hooks/use-intervals-data'
import { usePowerCurve } from '@/hooks/use-power-curve'
import type { WidgetConfig, CanvasState } from '@/lib/widgets/types'
import { Sparkles, LayoutGrid } from 'lucide-react'

interface CanvasProps {
  state: CanvasState
  className?: string
}

export function Canvas({ state, className }: CanvasProps) {
  const {
    currentFitness,
    sessions,
    pmcData,
    ctlTrend,
    athlete,
    loading: dataLoading
  } = useIntervalsData()

  const {
    powerCurve,
    loading: powerLoading
  } = usePowerCurve()

  if (state.widgets.length === 0) {
    return (
      <div className={className}>
        <Card className="h-full flex flex-col items-center justify-center text-center p-8">
          <Sparkles className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="font-medium text-lg mb-2">Ask the AI Coach</h3>
          <p className="text-muted-foreground text-sm max-w-md">
            Ask me to show your fitness data, power curve, recent sessions, or any other metrics.
            I&apos;ll display them here for you.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            <SuggestedQuery text="Show my fitness" />
            <SuggestedQuery text="Show power curve" />
            <SuggestedQuery text="Show recent workouts" />
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
        <LayoutGrid className="h-4 w-4" />
        <span>Showing {state.widgets.length} widget{state.widgets.length !== 1 ? 's' : ''}</span>
      </div>

      <div className={
        state.layout === 'grid'
          ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
          : 'space-y-4'
      }>
        {state.widgets.map((widget) => (
          <WidgetRenderer
            key={widget.id}
            widget={widget}
            data={{
              fitness: currentFitness,
              sessions,
              pmcData,
              ctlTrend,
              athlete,
              powerCurve,
              loading: dataLoading || powerLoading
            }}
          />
        ))}
      </div>
    </div>
  )
}

interface WidgetRendererProps {
  widget: WidgetConfig
  data: {
    fitness: ReturnType<typeof useIntervalsData>['currentFitness']
    sessions: ReturnType<typeof useIntervalsData>['sessions']
    pmcData: ReturnType<typeof useIntervalsData>['pmcData']
    ctlTrend: number
    athlete: ReturnType<typeof useIntervalsData>['athlete']
    powerCurve: ReturnType<typeof usePowerCurve>['powerCurve']
    loading: boolean
  }
}

/**
 * Renders the inner content of a widget (without wrapper card)
 */
function WidgetContent({ widget, data }: WidgetRendererProps) {
  switch (widget.type) {
    case 'fitness':
      return (
        <div className="grid grid-cols-3 gap-4">
          <FitnessCard fitness={data.fitness} />
          <FatigueCard fitness={data.fitness} />
          <FormCard fitness={data.fitness} />
        </div>
      )

    case 'pmc-chart':
      // PMCChart has its own card, return inner content
      return <PMCChart data={data.pmcData} ctlTrend={data.ctlTrend} />

    case 'sessions':
      // SessionsTable has its own card
      return <SessionsTable sessions={data.sessions} />

    case 'sleep':
      return (
        <SleepCard
          sleepSeconds={data.fitness?.sleep_seconds}
          sleepScore={data.fitness?.sleep_score}
        />
      )

    case 'power-curve':
      return (
        <PowerCurveChart
          powerCurve={data.powerCurve}
          weightKg={data.athlete?.weight_kg ?? null}
          ftp={data.athlete?.ftp ?? null}
        />
      )

    case 'workout-card':
      // TODO: Implement workout card widget
      return (
        <p className="text-muted-foreground text-sm">Workout details coming soon</p>
      )

    case 'chart':
      // TODO: Implement custom chart widget
      return (
        <p className="text-muted-foreground text-sm">Custom chart coming soon</p>
      )

    default:
      return (
        <p className="text-muted-foreground">Unknown widget type: {widget.type}</p>
      )
  }
}

function WidgetRenderer({ widget, data }: WidgetRendererProps) {
  if (data.loading) {
    return (
      <Card className="h-[300px] animate-pulse">
        <CardHeader>
          <CardTitle className="h-6 w-32 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-[200px] bg-muted rounded" />
        </CardContent>
      </Card>
    )
  }

  // Widgets that have their own card wrapper (don't wrap again)
  const selfWrappedWidgets = ['pmc-chart', 'sessions', 'sleep', 'power-curve']

  // If widget has AI context, use InsightCard wrapper
  if (widget.context?.insightSummary) {
    // For self-wrapped widgets, InsightCard wraps the whole thing
    if (selfWrappedWidgets.includes(widget.type)) {
      return (
        <InsightCard widget={widget}>
          <WidgetContent widget={widget} data={data} />
        </InsightCard>
      )
    }

    // For other widgets, InsightCard provides the card
    return (
      <InsightCard widget={widget}>
        <WidgetContent widget={widget} data={data} />
      </InsightCard>
    )
  }

  // No AI context - render with basic card wrapper
  if (selfWrappedWidgets.includes(widget.type)) {
    return <WidgetContent widget={widget} data={data} />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{widget.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <WidgetContent widget={widget} data={data} />
      </CardContent>
    </Card>
  )
}

function SuggestedQuery({ text }: { text: string }) {
  return (
    <span className="px-3 py-1.5 bg-muted rounded-full text-xs text-muted-foreground">
      &ldquo;{text}&rdquo;
    </span>
  )
}
