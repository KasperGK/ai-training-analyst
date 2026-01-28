'use client'

/**
 * Pill Input Component
 *
 * A pill-shaped input with integrated send button.
 * Features:
 * - Auto-resize textarea (1-4 lines)
 * - Arrow send button inside on right
 * - Submit on Enter (Shift+Enter for newline)
 */

import { useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PillInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  placeholder?: string
  disabled?: boolean
  onFocus?: () => void
  onBlur?: () => void
  className?: string
}

export function PillInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Ask about your training...',
  disabled = false,
  onFocus,
  onBlur,
  className,
}: PillInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Reset height to calculate scrollHeight
    textarea.style.height = 'auto'

    // Calculate new height (min 20px single line, max 100px for ~4 lines)
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 20), 100)
    textarea.style.height = `${newHeight}px`
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [value, adjustHeight])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (value.trim() && !disabled) {
        onSubmit()
      }
    }
  }

  const handleSubmit = () => {
    if (value.trim() && !disabled) {
      onSubmit()
    }
  }

  return (
    <div
      className={cn(
        'relative flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 transition-colors focus-within:border-ring/50',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className={cn(
          'flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed',
          'min-h-[20px] max-h-[100px] leading-5 pr-2'
        )}
        style={{ height: '20px' }}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all',
          value.trim() && !disabled
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'bg-muted text-muted-foreground'
        )}
      >
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
