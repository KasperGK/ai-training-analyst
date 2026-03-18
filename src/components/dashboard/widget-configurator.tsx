'use client'

import { Plus, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Card } from '@/components/ui/card'
import { DragHandle } from '@/components/ui/drag-handle'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { WIDGET_REGISTRY } from '@/lib/dashboard/widget-registry'

/** Widget IDs shown in the toggle list (exclude ai-coach and customize) */
const TOGGLE_WIDGET_IDS = Object.keys(WIDGET_REGISTRY).filter(
  id => id !== 'ai-coach' && id !== 'customize'
)

interface WidgetConfiguratorProps {
  visibleWidgets: Set<string>
  onToggleWidget: (id: string) => void
  onReset: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WidgetConfigurator({ visibleWidgets, onToggleWidget, onReset, open, onOpenChange }: WidgetConfiguratorProps) {
  return (
    <Card className="group relative h-full border-dashed border-muted-foreground/25">
      <DragHandle />
      <Sheet modal={true} open={open} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>
          <button className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            <Plus className="h-6 w-6" />
            <span className="text-sm font-medium">Add Widget</span>
          </button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Dashboard Widgets</SheetTitle>
            <SheetDescription>
              Toggle widgets to show or hide them on your dashboard.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4">
            <div className="space-y-4">
              {TOGGLE_WIDGET_IDS.map(id => {
                const widget = WIDGET_REGISTRY[id]
                if (!widget) return null
                return (
                  <div key={id} className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{widget.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{widget.description}</p>
                    </div>
                    <Switch
                      checked={visibleWidgets.has(id)}
                      onCheckedChange={() => onToggleWidget(id)}
                    />
                  </div>
                )
              })}
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" size="sm" onClick={onReset} className="w-full gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to Default
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </Card>
  )
}
