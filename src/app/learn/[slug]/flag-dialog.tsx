'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import type { FlagType } from '@/lib/db/knowledge-flags'

interface FlagArticleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  articleSlug: string
  articleTitle: string
}

const FLAG_TYPES: { value: FlagType; label: string; description: string }[] = [
  {
    value: 'inaccurate',
    label: 'Inaccurate Information',
    description: 'The content contains factual errors',
  },
  {
    value: 'outdated',
    label: 'Outdated Information',
    description: 'The information is no longer current',
  },
  {
    value: 'misleading',
    label: 'Misleading Content',
    description: 'The content could be misinterpreted',
  },
  {
    value: 'needs_source',
    label: 'Needs Better Sources',
    description: 'Claims need additional citations',
  },
]

export function FlagArticleDialog({
  open,
  onOpenChange,
  articleSlug,
  articleTitle,
}: FlagArticleDialogProps) {
  const [flagType, setFlagType] = useState<FlagType | ''>('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async () => {
    if (!flagType || description.trim().length < 10) return

    setStatus('loading')
    setErrorMessage('')

    try {
      const response = await fetch('/api/knowledge/flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleSlug,
          flagType,
          description: description.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit flag')
      }

      setStatus('success')
      // Reset after delay
      setTimeout(() => {
        onOpenChange(false)
        setStatus('idle')
        setFlagType('')
        setDescription('')
      }, 2000)
    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong')
    }
  }

  const handleClose = () => {
    if (status !== 'loading') {
      onOpenChange(false)
      setStatus('idle')
      setFlagType('')
      setDescription('')
      setErrorMessage('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report an Issue</DialogTitle>
          <DialogDescription>
            Help us improve by reporting issues with &quot;{articleTitle}&quot;
          </DialogDescription>
        </DialogHeader>

        {status === 'success' ? (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 mb-3" />
            <p className="font-medium">Thank you for your feedback!</p>
            <p className="text-sm text-muted-foreground">We&apos;ll review this content.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="flag-type">Issue Type</Label>
                <Select value={flagType} onValueChange={(v) => setFlagType(v as FlagType)}>
                  <SelectTrigger id="flag-type">
                    <SelectValue placeholder="Select an issue type" />
                  </SelectTrigger>
                  <SelectContent>
                    {FLAG_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div>
                          <div className="font-medium">{type.label}</div>
                          <div className="text-xs text-muted-foreground">{type.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Please describe the issue in detail (minimum 10 characters)..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  {description.length}/10 characters minimum
                </p>
              </div>

              {status === 'error' && (
                <div className="flex items-center gap-2 rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-200">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {errorMessage}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={status === 'loading'}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!flagType || description.trim().length < 10 || status === 'loading'}
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Report'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
