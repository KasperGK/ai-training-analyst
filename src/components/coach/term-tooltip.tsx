'use client'

/**
 * Term Tooltip Component
 *
 * Wraps cycling terms with an interactive tooltip showing their definition.
 * Desktop: hover to show tooltip
 * Mobile: tap to show tooltip
 */

import { getTermDefinition } from '@/lib/cycling-terms'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface TermTooltipProps {
  term: string
  children?: React.ReactNode
}

export function TermTooltip({ term, children }: TermTooltipProps) {
  const definition = getTermDefinition(term)

  if (!definition) {
    return <>{children || term}</>
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help border-b border-dotted border-muted-foreground/50 hover:border-foreground transition-colors">
          {children || term}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-semibold mb-1">{definition.term}</p>
        <p className="text-xs opacity-90">{definition.definition}</p>
        {definition.unit && (
          <p className="text-xs opacity-70 mt-1">Unit: {definition.unit}</p>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
