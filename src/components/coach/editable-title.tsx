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
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setValue(defaultTitle)
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
    } else {
      setValue(defaultTitle)
    }
    setEditing(false)
  }, [value, defaultTitle, conversationId, onSave])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      save()
    } else if (e.key === 'Escape') {
      setValue(defaultTitle)
      setEditing(false)
    }
  }, [save, defaultTitle])

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
      <span className="truncate max-w-[200px]">{defaultTitle}</span>
      {conversationId && (
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      )}
    </button>
  )
}
