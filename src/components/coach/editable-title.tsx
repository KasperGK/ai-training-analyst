'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Pencil } from 'lucide-react'

interface EditableTitleProps {
  conversationId: string | null
  defaultTitle: string
  onSave: (conversationId: string, title: string) => void
}

export function EditableTitle({ conversationId, defaultTitle, onSave }: EditableTitleProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(defaultTitle)
  const [displayValue, setDisplayValue] = useState(defaultTitle)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync from parent when prop changes (e.g., conversation switch)
  useEffect(() => {
    setValue(defaultTitle)
    setDisplayValue(defaultTitle)
  }, [defaultTitle])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const save = useCallback(() => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== defaultTitle && conversationId) {
      onSave(conversationId, trimmed)
      setDisplayValue(trimmed) // Optimistic update
    } else {
      setValue(displayValue)
    }
    setEditing(false)
  }, [value, defaultTitle, displayValue, conversationId, onSave])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      save()
    } else if (e.key === 'Escape') {
      setValue(displayValue)
      setEditing(false)
    }
  }, [save, displayValue])

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
        className="text-xs font-medium text-muted-foreground uppercase tracking-wide bg-transparent border-b border-muted-foreground/30 outline-none px-0 py-0 w-48"
        maxLength={60}
      />
    )
  }

  return (
    <button
      onClick={() => conversationId && setEditing(true)}
      className={cn(
        'group flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide',
        conversationId && 'hover:text-foreground transition-colors cursor-pointer'
      )}
    >
      <span className="truncate max-w-[300px]">{displayValue}</span>
      {conversationId && (
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      )}
    </button>
  )
}
