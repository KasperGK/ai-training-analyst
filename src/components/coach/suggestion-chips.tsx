'use client'

/**
 * Suggestion Chips Component
 *
 * Renders smart + custom suggestions as clickable chips.
 * Features:
 * - Smart suggestions (context-aware)
 * - Custom suggestions with remove button on hover
 * - "+" button to add custom suggestion via dialog
 * - Animated appear/disappear
 */

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { CustomSuggestion } from '@/hooks/use-custom-suggestions'

interface SmartSuggestion {
  label: string
  prompt: string
}

interface SuggestionChipsProps {
  smartSuggestions: SmartSuggestion[]
  customSuggestions: CustomSuggestion[]
  onSelect: (prompt: string) => void
  onAddCustom: (label: string, prompt: string) => void
  onRemoveCustom: (id: string) => void
  canAddMore: boolean
  className?: string
}

export function SuggestionChips({
  smartSuggestions,
  customSuggestions,
  onSelect,
  onAddCustom,
  onRemoveCustom,
  canAddMore,
  className,
}: SuggestionChipsProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newPrompt, setNewPrompt] = useState('')

  const handleAddCustom = () => {
    if (newLabel.trim() && newPrompt.trim()) {
      onAddCustom(newLabel.trim(), newPrompt.trim())
      setNewLabel('')
      setNewPrompt('')
      setDialogOpen(false)
    }
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {/* Smart suggestions */}
      {smartSuggestions.map((suggestion, idx) => (
        <button
          key={`smart-${idx}`}
          type="button"
          onClick={() => onSelect(suggestion.prompt)}
          className="rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px] transition-all hover:bg-muted hover:text-foreground animate-in fade-in slide-in-from-bottom-1 duration-200"
          style={{ animationDelay: `${idx * 50}ms` }}
        >
          {suggestion.label}
        </button>
      ))}

      {/* Custom suggestions */}
      {customSuggestions.map((suggestion, idx) => (
        <div
          key={suggestion.id}
          className="group relative animate-in fade-in slide-in-from-bottom-1 duration-200"
          style={{ animationDelay: `${(smartSuggestions.length + idx) * 50}ms` }}
        >
          <button
            type="button"
            onClick={() => onSelect(suggestion.prompt)}
            className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 pr-7 text-xs text-primary whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px] transition-all hover:bg-primary/10"
          >
            {suggestion.label}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRemoveCustom(suggestion.id)
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-primary/20"
          >
            <X className="h-3 w-3 text-primary" />
          </button>
        </div>
      ))}

      {/* Add custom suggestion button */}
      {canAddMore && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-muted-foreground/30 text-muted-foreground transition-all hover:border-foreground hover:text-foreground animate-in fade-in duration-200"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Custom Suggestion</DialogTitle>
              <DialogDescription>
                Create a quick action for frequently used prompts.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="label" className="text-sm font-medium">
                  Button Label
                </label>
                <Input
                  id="label"
                  placeholder="e.g., Weekly summary"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  maxLength={30}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="prompt" className="text-sm font-medium">
                  Prompt
                </label>
                <Input
                  id="prompt"
                  placeholder="e.g., Give me a summary of my training this week"
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleAddCustom}
                disabled={!newLabel.trim() || !newPrompt.trim()}
              >
                Add Suggestion
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
