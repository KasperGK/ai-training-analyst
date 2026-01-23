'use client'

/**
 * Canvas Tab Bar Component
 *
 * Tab bar for switching between viewing all widgets (grid) or a single widget.
 *
 * - "All" tab: Shows all widgets in grid layout
 * - Widget tabs: Click to show only that widget full-width
 * - Active tab has highlighted styling
 * - Pinned widgets show pin indicator
 */

import { cn } from '@/lib/utils'
import type { WidgetConfig, WidgetType } from '@/lib/widgets/types'
import {
  Activity,
  BarChart3,
  Table,
  Zap,
  Moon,
  Dumbbell,
  Pin,
  LayoutGrid,
} from 'lucide-react'

interface CanvasTabBarProps {
  widgets: WidgetConfig[]
  pinnedWidgetIds: Set<string>
  selectedTabId: string | null
  onSelectTab: (widgetId: string | null) => void
  className?: string
}

/** Get icon component for widget type */
function WidgetIcon({ type, className }: { type: WidgetType; className?: string }) {
  const iconClass = cn('h-3 w-3', className)

  switch (type) {
    case 'fitness':
      return <Activity className={iconClass} />
    case 'pmc-chart':
      return <BarChart3 className={iconClass} />
    case 'sessions':
      return <Table className={iconClass} />
    case 'power-curve':
      return <Zap className={iconClass} />
    case 'sleep':
      return <Moon className={iconClass} />
    case 'workout-card':
      return <Dumbbell className={iconClass} />
    case 'chart':
      return <BarChart3 className={iconClass} />
    default:
      return <BarChart3 className={iconClass} />
  }
}

export function CanvasTabBar({
  widgets,
  pinnedWidgetIds,
  selectedTabId,
  onSelectTab,
  className,
}: CanvasTabBarProps) {
  if (widgets.length === 0) {
    return null
  }

  const isAllSelected = selectedTabId === null

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {/* "All" tab */}
      <button
        onClick={() => onSelectTab(null)}
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
          'transition-colors cursor-pointer',
          isAllSelected
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground border border-transparent hover:bg-muted/80 hover:border-border'
        )}
        title="Show all widgets"
      >
        <LayoutGrid className="h-3 w-3" />
        <span>All</span>
      </button>

      {/* Widget tabs */}
      {widgets.map((widget) => {
        const isPinned = pinnedWidgetIds.has(widget.id)
        const hasError = !!widget.error
        const isSelected = selectedTabId === widget.id

        return (
          <TabBadge
            key={widget.id}
            widget={widget}
            isPinned={isPinned}
            hasError={hasError}
            isSelected={isSelected}
            onSelect={() => onSelectTab(widget.id)}
          />
        )
      })}
    </div>
  )
}

interface TabBadgeProps {
  widget: WidgetConfig
  isPinned: boolean
  hasError: boolean
  isSelected: boolean
  onSelect: () => void
}

function TabBadge({
  widget,
  isPinned,
  hasError,
  isSelected,
  onSelect,
}: TabBadgeProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
        'transition-colors cursor-pointer',
        hasError
          ? 'bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20'
          : isSelected
            ? 'bg-primary text-primary-foreground'
            : isPinned
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 hover:bg-blue-200 dark:hover:bg-blue-900/50'
              : 'bg-muted text-muted-foreground border border-transparent hover:bg-muted/80 hover:border-border'
      )}
      title={widget.title}
    >
      {/* Widget type icon */}
      <WidgetIcon type={widget.type} />

      {/* Title - truncated */}
      <span className="max-w-[100px] truncate">{widget.title}</span>

      {/* Pinned indicator */}
      {isPinned && (
        <Pin className={cn(
          'h-2.5 w-2.5 fill-current',
          isSelected && 'text-primary-foreground'
        )} />
      )}
    </button>
  )
}

// Keep the old export name for backwards compatibility during transition
export { CanvasTabBar as CanvasStatusBar }
