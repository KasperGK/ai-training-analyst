'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DragHandle } from '@/components/ui/drag-handle'
import { Badge } from '@/components/ui/badge'
import { SessionScoreGauge } from '@/components/dashboard/session-score-gauge'
import { cn } from '@/lib/utils'
import type { SessionReport } from '@/lib/reports/types'
import type { Session } from '@/types'

interface LatestSessionReportProps {
  report: SessionReport | null
  session: Session | null
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function LatestSessionReport({ report, session }: LatestSessionReportProps) {
  const [activeSlide, setActiveSlide] = useState(0)

  if (!report || !session) {
    return (
      <Card className="group h-full flex flex-col relative">
        <DragHandle />
        <CardHeader>
          <CardTitle>Latest Session</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">No session reports yet</p>
        </CardContent>
      </Card>
    )
  }

  const { deep_analysis } = report

  const slides = [
    { label: 'Overview', score: null as number | null, summary: report.quick_take },
    { label: 'Execution', score: deep_analysis.execution.score, summary: deep_analysis.execution.summary },
    { label: 'Training', score: deep_analysis.training_value.score, summary: deep_analysis.training_value.summary },
    { label: 'Recovery', score: deep_analysis.recovery.score, summary: deep_analysis.recovery.summary },
  ]

  const prev = () => setActiveSlide(i => (i - 1 + slides.length) % slides.length)
  const next = () => setActiveSlide(i => (i + 1) % slides.length)

  return (
    <Card className="group h-full flex flex-col overflow-hidden relative">
      <DragHandle />
      <CardHeader className="flex-shrink-0 pb-2">
        <div className="flex items-center gap-3">
          <SessionScoreGauge score={report.score} size="md" />
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm truncate">{report.headline}</CardTitle>
            <p className="text-xs text-muted-foreground">{formatDate(session.date)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 space-y-3 pt-0">
        {/* Pill navigation */}
        <div className="flex gap-1.5 flex-wrap">
          {slides.map((slide, i) => (
            <Badge
              key={slide.label}
              variant={i === activeSlide ? 'default' : 'outline'}
              className="text-xs cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setActiveSlide(i) }}
            >
              {slide.label}
            </Badge>
          ))}
        </div>

        {/* Carousel content */}
        <div className="flex-1 flex items-start gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); prev() }}
            className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-md hover:bg-muted transition-colors mt-0.5"
          >
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            {slides[activeSlide].score != null && (
              <p className="text-xs font-medium mb-1">
                Score: <span className="font-bold tabular-nums">{slides[activeSlide].score}</span>
                <span className="text-muted-foreground font-normal">/100</span>
              </p>
            )}
            <p className="text-xs text-muted-foreground leading-relaxed">{slides[activeSlide].summary}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); next() }}
            className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-md hover:bg-muted transition-colors mt-0.5"
          >
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
