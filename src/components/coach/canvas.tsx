'use client'

/**
 * AI Coach Canvas
 *
 * Displays widgets selected by the AI. Each widget type maps to
 * an existing dashboard component. When AI provides context via
 * the showOnCanvas tool, widgets are wrapped in InsightCard for
 * insight-first display.
 */

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FitnessCard, FatigueCard, FormCard } from '@/components/dashboard/fitness-metrics'
import { PMCChart } from '@/components/dashboard/pmc-chart'
import { SessionsTable } from '@/components/dashboard/sessions-table'
import { SleepCard } from '@/components/dashboard/sleep-card'
import { PowerCurveChart } from '@/components/power/power-curve-chart'
import { ChartWidget } from '@/components/coach/chart-widget'
import { InsightCard } from '@/components/coach/insight-card'
import { WorkoutCardWidget } from '@/components/coach/workout-card-widget'
import type { WorkoutTemplate } from '@/lib/workouts/library'
import { WidgetFullscreenDialog } from '@/components/coach/widget-fullscreen-dialog'
import { WidgetHistorySheet } from '@/components/coach/widget-history-sheet'
import { useIntervalsData } from '@/hooks/use-intervals-data'
import { usePowerCurve } from '@/hooks/use-power-curve'
import type { WidgetConfig, CanvasState, ChartConfig } from '@/lib/widgets/types'
import { Sparkles, LayoutGrid, History } from 'lucide-react'

interface CanvasProps {
  state: CanvasState
  className?: string
  /** Callback when user dismisses a widget */
  onDismissWidget?: (widgetId: string) => void
  /** Callback when user pins a widget */
  onPinWidget?: (widgetId: string) => void
  /** Callback when user unpins a widget */
  onUnpinWidget?: (widgetId: string) => void
  /** Callback when user restores a dismissed widget */
  onRestoreWidget?: (widget: WidgetConfig) => void
  /** Callback to clear dismissed widget history */
  onClearHistory?: () => void
  /** Callback when user clicks analyze on a widget */
  onAnalyzeWidget?: (widget: WidgetConfig) => void
}

export function Canvas({
  state,
  className,
  onDismissWidget,
  onPinWidget,
  onUnpinWidget,
  onRestoreWidget,
  onClearHistory,
  onAnalyzeWidget,
}: CanvasProps) {
  const [expandedWidget, setExpandedWidget] = useState<WidgetConfig | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

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

  const hasHistory = state.dismissedWidgets.length > 0

  // Generate contextual suggestions based on fitness data
  const contextualSuggestions = useMemo(() => {
    const suggestions: { text: string; urgent?: boolean }[] = []

    if (currentFitness) {
      const tsb = currentFitness.tsb ?? 0
      const ctl = currentFitness.ctl ?? 0

      // TSB-based suggestions (urgent if extreme)
      if (tsb < -20) {
        suggestions.push({ text: `TSB at ${Math.round(tsb)} - check recovery?`, urgent: true })
      } else if (tsb < -10) {
        suggestions.push({ text: `Fatigue building (TSB: ${Math.round(tsb)})` })
      } else if (tsb > 15) {
        suggestions.push({ text: `Fresh legs (TSB: ${Math.round(tsb)}) - ready for intensity?` })
      }

      // CTL-based suggestions
      if (ctl > 50) {
        suggestions.push({ text: `CTL is ${Math.round(ctl)} - show trends?` })
      }
    }

    // Default suggestions if no contextual ones
    if (suggestions.length === 0) {
      suggestions.push({ text: 'Show my fitness' })
      suggestions.push({ text: 'Show power curve' })
    }

    // Always include a default
    suggestions.push({ text: 'Show recent workouts' })

    return suggestions.slice(0, 3) // Max 3 suggestions
  }, [currentFitness])

  if (state.widgets.length === 0) {
    return (
      <div className={className}>
        {hasHistory && (
          <div className="flex justify-end mb-4">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="h-4 w-4" />
              History ({state.dismissedWidgets.length})
            </Button>
          </div>
        )}
        <Card className="h-full flex flex-col items-center justify-center text-center p-8">
          <Sparkles className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="font-medium text-lg mb-2">Ask the AI Coach</h3>
          <p className="text-muted-foreground text-sm max-w-md">
            Ask me to show your fitness data, power curve, recent sessions, or any other metrics.
            I&apos;ll display them here for you.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            {contextualSuggestions.map((suggestion, idx) => (
              <SuggestedQuery key={idx} text={suggestion.text} urgent={suggestion.urgent} />
            ))}
          </div>
        </Card>

        {/* History Sheet */}
        <WidgetHistorySheet
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          dismissedWidgets={state.dismissedWidgets}
          onRestore={onRestoreWidget || (() => {})}
          onClearHistory={onClearHistory || (() => {})}
        />
      </div>
    )
  }

  const data = {
    fitness: currentFitness,
    sessions,
    pmcData,
    ctlTrend,
    athlete,
    powerCurve,
    loading: dataLoading || powerLoading
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LayoutGrid className="h-4 w-4" />
          <span>Showing {state.widgets.length} widget{state.widgets.length !== 1 ? 's' : ''}</span>
        </div>
        {hasHistory && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 h-8"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
            <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
              {state.dismissedWidgets.length}
            </span>
          </Button>
        )}
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
            data={data}
            isPinned={state.pinnedWidgetIds.has(widget.id)}
            onDismiss={onDismissWidget ? () => onDismissWidget(widget.id) : undefined}
            onPin={onPinWidget ? () => onPinWidget(widget.id) : undefined}
            onUnpin={onUnpinWidget ? () => onUnpinWidget(widget.id) : undefined}
            onExpand={() => setExpandedWidget(widget)}
            onAnalyze={onAnalyzeWidget ? () => onAnalyzeWidget(widget) : undefined}
          />
        ))}
      </div>

      {/* Fullscreen Dialog */}
      <WidgetFullscreenDialog
        widget={expandedWidget}
        open={!!expandedWidget}
        onOpenChange={(open) => !open && setExpandedWidget(null)}
      >
        {expandedWidget && (
          <WidgetContent
            widget={expandedWidget}
            data={data}
          />
        )}
      </WidgetFullscreenDialog>

      {/* History Sheet */}
      <WidgetHistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        dismissedWidgets={state.dismissedWidgets}
        onRestore={onRestoreWidget || (() => {})}
        onClearHistory={onClearHistory || (() => {})}
      />
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
  isPinned?: boolean
  onDismiss?: () => void
  onPin?: () => void
  onUnpin?: () => void
  onExpand?: () => void
  onAnalyze?: () => void
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
      const workoutData = widget.params?.workout as WorkoutTemplate | undefined
      if (!workoutData) {
        return <p className="text-muted-foreground text-sm">No workout data</p>
      }
      return <WorkoutCardWidget workout={workoutData} ftp={data.athlete?.ftp ?? 250} />

    case 'chart':
      // Chart widget with dual Y-axis support for overlays
      const chartConfig = widget.chartConfig || (widget.params as ChartConfig | undefined)
      if (!chartConfig?.sessionId) {
        return (
          <p className="text-muted-foreground text-sm">
            Chart requires a session ID to display
          </p>
        )
      }
      return <ChartWidget config={chartConfig} />

    default:
      return (
        <p className="text-muted-foreground">Unknown widget type: {widget.type}</p>
      )
  }
}

function WidgetRenderer({
  widget,
  data,
  isPinned,
  onDismiss,
  onPin,
  onUnpin,
  onExpand,
  onAnalyze,
}: WidgetRendererProps) {
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

  // Common props for InsightCard
  const insightCardProps = {
    widget,
    isPinned,
    onDismiss,
    onPin,
    onUnpin,
    onExpand,
    onAnalyze,
  }

  // If widget has AI context, use InsightCard wrapper
  if (widget.context?.insightSummary) {
    // For self-wrapped widgets, InsightCard wraps the whole thing
    if (selfWrappedWidgets.includes(widget.type)) {
      return (
        <InsightCard {...insightCardProps}>
          <WidgetContent widget={widget} data={data} />
        </InsightCard>
      )
    }

    // For other widgets, InsightCard provides the card
    return (
      <InsightCard {...insightCardProps}>
        <WidgetContent widget={widget} data={data} />
      </InsightCard>
    )
  }

  // No AI context - render with basic card wrapper but still include InsightCard for controls
  if (selfWrappedWidgets.includes(widget.type)) {
    return (
      <InsightCard {...insightCardProps}>
        <WidgetContent widget={widget} data={data} />
      </InsightCard>
    )
  }

  return (
    <InsightCard {...insightCardProps}>
      <WidgetContent widget={widget} data={data} />
    </InsightCard>
  )
}

function SuggestedQuery({ text, urgent }: { text: string; urgent?: boolean }) {
  return (
    <span className={`px-3 py-1.5 rounded-full text-xs ${
      urgent
        ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
        : 'bg-muted text-muted-foreground'
    }`}>
      &ldquo;{text}&rdquo;
    </span>
  )
}
