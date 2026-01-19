'use client'

/**
 * InsightCard Component
 *
 * Wraps widgets in an insight-first display where the AI-provided context
 * is prominently shown. Widget content can be collapsed/expanded.
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import type { WidgetConfig } from '@/lib/widgets/types'
import { ChevronDown, ChevronUp, BookOpen, Sparkles } from 'lucide-react'

interface InsightCardProps {
  widget: WidgetConfig
  children: React.ReactNode
  className?: string
  /** Callback when user wants to drill down or ask about this widget */
  onAnalyze?: () => void
}

/**
 * Source badge component for wiki article citations
 */
function SourceBadge({ slug }: { slug: string }) {
  return (
    <a
      href={`/learn/${slug}`}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      <BookOpen className="h-3 w-3" />
      <span>Learn more</span>
    </a>
  )
}

export function InsightCard({
  widget,
  children,
  className,
  onAnalyze,
}: InsightCardProps) {
  const [isExpanded, setIsExpanded] = useState(!widget.context?.expandable)
  const hasContext = !!widget.context?.insightSummary

  // If no context is provided, render the widget directly without collapsible behavior
  if (!hasContext) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{widget.title}</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    )
  }

  // Error state
  if (widget.error) {
    return (
      <Card className={cn('overflow-hidden border-destructive/50', className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-destructive">
            {widget.title}
          </CardTitle>
          <p className="text-sm text-destructive/80">{widget.error}</p>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{widget.title}</CardTitle>
                {widget.context?.expandable && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    AI insight
                  </Badge>
                )}
              </div>

              {/* AI insight summary - always visible */}
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                {widget.context?.insightSummary}
              </p>
            </div>

            {/* Expand/collapse button */}
            {widget.context?.expandable && (
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0"
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  <span className="sr-only">
                    {isExpanded ? 'Collapse' : 'Expand'}
                  </span>
                </Button>
              </CollapsibleTrigger>
            )}
          </div>

          {/* Source reference and analyze button */}
          <div className="flex items-center justify-between mt-2">
            {widget.context?.sourceReference ? (
              <SourceBadge slug={widget.context.sourceReference} />
            ) : (
              <div />
            )}

            {onAnalyze && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={onAnalyze}
              >
                <Sparkles className="h-3 w-3" />
                Analyze
              </Button>
            )}
          </div>
        </CardHeader>

        {/* Expandable widget content */}
        <CollapsibleContent>
          <CardContent className="pt-2">{children}</CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

/**
 * Simplified insight card for non-expandable widgets
 * Just shows the insight with the widget always visible
 */
export function SimpleInsightCard({
  widget,
  children,
  className,
}: Omit<InsightCardProps, 'onAnalyze'>) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{widget.title}</CardTitle>
        {widget.context?.insightSummary && (
          <p className="text-sm text-muted-foreground mt-1">
            {widget.context.insightSummary}
          </p>
        )}
        {widget.context?.sourceReference && (
          <div className="mt-2">
            <SourceBadge slug={widget.context.sourceReference} />
          </div>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
