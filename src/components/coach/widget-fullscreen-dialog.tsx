'use client'

/**
 * WidgetFullscreenDialog Component
 *
 * Dialog component for expanded widget viewing.
 * Renders widget content at 90vw × 90vh for better chart analysis on mobile.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { WidgetConfig } from '@/lib/widgets/types'

interface WidgetFullscreenDialogProps {
  widget: WidgetConfig | null
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export function WidgetFullscreenDialog({
  widget,
  open,
  onOpenChange,
  children,
}: WidgetFullscreenDialogProps) {
  if (!widget) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[90vw] max-h-[90vh] w-full h-[90vh] flex flex-col"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{widget.title}</DialogTitle>
          {widget.context?.insightSummary && (
            <DialogDescription>
              {widget.context.insightSummary}
            </DialogDescription>
          )}
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
          <div className="py-4">{children}</div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
