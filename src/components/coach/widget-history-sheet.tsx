'use client'

/**
 * WidgetHistorySheet Component
 *
 * Right-side Sheet showing dismissed widgets for restoration.
 * Shows a list with title, truncated insight, and restore button.
 */

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RotateCcw, Trash2 } from 'lucide-react'
import type { WidgetConfig } from '@/lib/widgets/types'

interface WidgetHistorySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dismissedWidgets: WidgetConfig[]
  onRestore: (widget: WidgetConfig) => void
  onClearHistory: () => void
}

/**
 * Widget type to icon/color mapping
 */
function getWidgetTypeLabel(type: WidgetConfig['type']): string {
  const labels: Record<WidgetConfig['type'], string> = {
    fitness: 'Fitness',
    'pmc-chart': 'PMC Chart',
    sessions: 'Sessions',
    sleep: 'Sleep',
    'power-curve': 'Power Curve',
    'workout-card': 'Workout',
    chart: 'Chart',
    'race-history': 'Race History',
    'competitor-analysis': 'Competitors',
  }
  return labels[type] || type
}

export function WidgetHistorySheet({
  open,
  onOpenChange,
  dismissedWidgets,
  onRestore,
  onClearHistory,
}: WidgetHistorySheetProps) {
  const hasWidgets = dismissedWidgets.length > 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Dismissed Widgets</SheetTitle>
          <SheetDescription>
            {hasWidgets
              ? 'Click restore to bring back a widget'
              : 'No dismissed widgets yet'}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-4 px-4">
          {hasWidgets ? (
            <div className="space-y-2 py-2">
              {dismissedWidgets.map((widget) => (
                <div
                  key={widget.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {widget.title}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                        {getWidgetTypeLabel(widget.type)}
                      </span>
                    </div>
                    {widget.context?.insightSummary && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {widget.context.insightSummary}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 shrink-0"
                    onClick={() => {
                      onRestore(widget)
                      // Close sheet after restore
                      onOpenChange(false)
                    }}
                    title="Restore widget"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span className="sr-only">Restore</span>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <RotateCcw className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Dismissed widgets will appear here
              </p>
            </div>
          )}
        </ScrollArea>

        {hasWidgets && (
          <SheetFooter>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => {
                onClearHistory()
                onOpenChange(false)
              }}
            >
              <Trash2 className="h-4 w-4" />
              Clear History
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
