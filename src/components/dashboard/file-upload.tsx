'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, FileCheck, AlertCircle, Loader2 } from 'lucide-react'
import type { Session } from '@/types'

interface FileUploadProps {
  onSessionUploaded: (session: Session) => void
  ftp?: number
  compact?: boolean
}

export function FileUpload({ onSessionUploaded, ftp = 250, compact = false }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.fit')) {
      setMessage({ type: 'error', text: 'Please upload a .FIT file' })
      return
    }

    setIsUploading(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('ftp', ftp.toString())

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setMessage({ type: 'success', text: data.message })
      onSessionUploaded(data.session)
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Upload failed',
      })
    } finally {
      setIsUploading(false)
    }
  }, [ftp, onSessionUploaded])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const getDropzoneClasses = () => {
    let classes = 'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors '
    if (isDragging) {
      classes += 'border-primary bg-primary/5 '
    } else {
      classes += 'border-muted-foreground/25 '
    }
    if (isUploading) {
      classes += 'pointer-events-none opacity-50'
    } else {
      classes += 'cursor-pointer hover:border-primary/50'
    }
    return classes
  }

  // Compact square version matching MetricCard style
  if (compact) {
    return (
      <Card
        className="aspect-square flex flex-col p-5 cursor-pointer hover:border-primary/50 transition-colors relative"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          accept=".fit"
          onChange={handleInputChange}
          className="absolute inset-0 cursor-pointer opacity-0"
          disabled={isUploading}
        />
        <div className="flex items-start justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Upload
          </span>
          <Upload className="h-4 w-4 text-muted-foreground/50" />
        </div>

        <div className="flex-1 flex items-center justify-center">
          {isUploading ? (
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          ) : message?.type === 'success' ? (
            <FileCheck className="h-10 w-10 text-green-600" />
          ) : message?.type === 'error' ? (
            <AlertCircle className="h-10 w-10 text-red-500" />
          ) : (
            <Upload className={`h-10 w-10 ${isDragging ? 'text-primary' : 'text-muted-foreground/30'}`} />
          )}
        </div>

        <div className="h-10 text-center">
          <p className="text-xs text-muted-foreground line-clamp-2">
            {isUploading ? 'Processing...' : message?.text || 'Drop .FIT file'}
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Upload Activity</CardTitle>
        <CardDescription>
          Drop a .FIT file to import your ride data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={getDropzoneClasses()}
        >
          <input
            type="file"
            accept=".fit"
            onChange={handleInputChange}
            className="absolute inset-0 cursor-pointer opacity-0"
            disabled={isUploading}
          />
          {isUploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="h-8 w-8 text-muted-foreground" />
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            {isUploading ? 'Processing...' : 'Drag & drop or click to upload'}
          </p>
        </div>

        {message && (
          <div
            className={
              message.type === 'success'
                ? 'mt-3 flex items-center gap-2 rounded-md bg-green-50 p-2 text-sm text-green-700'
                : 'mt-3 flex items-center gap-2 rounded-md bg-red-50 p-2 text-sm text-red-700'
            }
          >
            {message.type === 'success' ? (
              <FileCheck className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {message.text}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
