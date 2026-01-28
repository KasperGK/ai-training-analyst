'use client'

/**
 * Chat Input Area Component
 *
 * Container managing compact/expanded states for the chat input.
 * Features:
 * - Tracks scroll state from parent
 * - Expands on focus or hover
 * - Smooth height transitions
 * - Composes PillInput + SuggestionChips
 */

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { PillInput } from './pill-input'
import { SuggestionChips } from './suggestion-chips'
import type { CustomSuggestion } from '@/hooks/use-custom-suggestions'

interface SmartSuggestion {
  label: string
  prompt: string
}

interface ChatInputAreaProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  smartSuggestions: SmartSuggestion[]
  customSuggestions: CustomSuggestion[]
  onAddCustomSuggestion: (label: string, prompt: string) => void
  onRemoveCustomSuggestion: (id: string) => void
  canAddMoreSuggestions: boolean
  isScrolled: boolean
  disabled?: boolean
  className?: string
}

export function ChatInputArea({
  value,
  onChange,
  onSubmit,
  smartSuggestions,
  customSuggestions,
  onAddCustomSuggestion,
  onRemoveCustomSuggestion,
  canAddMoreSuggestions,
  isScrolled,
  disabled = false,
  className,
}: ChatInputAreaProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  // Show suggestions when not scrolled, or when focused/hovered
  const showSuggestions = !isScrolled || isFocused || isHovered

  const handleFocus = useCallback(() => {
    setIsFocused(true)
  }, [])

  const handleBlur = useCallback(() => {
    // Small delay to allow click events on suggestions
    setTimeout(() => {
      setIsFocused(false)
    }, 150)
  }, [])

  const handleSelectSuggestion = useCallback(
    (prompt: string) => {
      onChange(prompt)
    },
    [onChange]
  )

  return (
    <div
      className={cn('space-y-3 transition-all duration-300', className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <PillInput
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        disabled={disabled}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />

      {/* Suggestions with smooth height transition */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-300 ease-in-out',
          showSuggestions
            ? 'max-h-32 opacity-100'
            : 'max-h-0 opacity-0'
        )}
      >
        <SuggestionChips
          smartSuggestions={smartSuggestions}
          customSuggestions={customSuggestions}
          onSelect={handleSelectSuggestion}
          onAddCustom={onAddCustomSuggestion}
          onRemoveCustom={onRemoveCustomSuggestion}
          canAddMore={canAddMoreSuggestions}
        />
      </div>
    </div>
  )
}
