'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DragHandle } from '@/components/ui/drag-handle'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SessionScoreGauge } from '@/components/dashboard/session-score-gauge'
import { cn } from '@/lib/utils'
import type { Session } from '@/types'
import type { SessionReport } from '@/lib/reports/types'

interface SessionsTableProps {
  sessions: Session[]
  sessionReports?: Map<string, SessionReport>
  unreadCount?: number
  onMarkRead?: (sessionId: string) => void
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

function formatDateTime(dateStr: string): { date: string; time: string | null } {
  const hasTime = dateStr.includes('T') && !dateStr.endsWith('T00:00:00')

  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number)
  const dateOnly = new Date(year, month - 1, day)

  const formattedDate = dateOnly.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  if (hasTime) {
    const timePart = dateStr.split('T')[1]?.substring(0, 5)
    if (timePart) {
      const [hours, minutes] = timePart.split(':').map(Number)
      const timeDate = new Date(2000, 0, 1, hours, minutes)
      const formattedTime = timeDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      return { date: formattedDate, time: formattedTime }
    }
  }

  return { date: formattedDate, time: null }
}

function getWorkoutTypeBadge(type?: string) {
  if (!type) return null

  return (
    <Badge variant="secondary" className="bg-muted text-muted-foreground hover:bg-muted">
      {type}
    </Badge>
  )
}

function DeepAnalysisSection({ report }: { report: SessionReport }) {
  const { deep_analysis } = report

  return (
    <div className="space-y-3 text-sm">
      <div>
        <h4 className="font-semibold text-foreground mb-1">{report.headline}</h4>
        <p className="text-muted-foreground">{report.quick_take}</p>
      </div>

      {report.tags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {report.tags.map(tag => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 pt-1">
        <div className="rounded-md border p-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">Execution</span>
            <span className="text-xs font-bold tabular-nums">{deep_analysis.execution.score}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{deep_analysis.execution.summary}</p>
        </div>
        <div className="rounded-md border p-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">Training Value</span>
            <span className="text-xs font-bold tabular-nums">{deep_analysis.training_value.score}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{deep_analysis.training_value.summary}</p>
        </div>
        <div className="rounded-md border p-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">Recovery</span>
            <span className="text-xs font-bold tabular-nums">{deep_analysis.recovery.score}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{deep_analysis.recovery.summary}</p>
        </div>
      </div>

      {deep_analysis.key_observations.length > 0 && (
        <div>
          <span className="text-xs font-medium text-muted-foreground">Key Observations</span>
          <ul className="mt-1 space-y-0.5">
            {deep_analysis.key_observations.map((obs, i) => (
              <li key={i} className="text-xs text-muted-foreground pl-3 relative before:content-['·'] before:absolute before:left-0">
                {obs}
              </li>
            ))}
          </ul>
        </div>
      )}

      {deep_analysis.areas_for_improvement.length > 0 && (
        <div>
          <span className="text-xs font-medium text-muted-foreground">Areas for Improvement</span>
          <ul className="mt-1 space-y-0.5">
            {deep_analysis.areas_for_improvement.map((area, i) => (
              <li key={i} className="text-xs text-muted-foreground pl-3 relative before:content-['·'] before:absolute before:left-0">
                {area}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function SessionsTable({ sessions, sessionReports, unreadCount = 0, onMarkRead }: SessionsTableProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<'training' | 'all'>('training')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filteredSessions = filter === 'training'
    ? sessions.filter(s =>
        s.sport === 'cycling' ||
        (s.normalized_power && s.normalized_power > 0)
      )
    : sessions

  const handleRowClick = (session: Session) => {
    const report = sessionReports?.get(session.id)
    if (report) {
      if (expandedId === session.id) {
        setExpandedId(null)
      } else {
        setExpandedId(session.id)
        if (!report.is_read) {
          onMarkRead?.(session.id)
        }
      }
    } else {
      router.push(`/workouts/${session.id}`)
    }
  }

  const titleContent = (
    <span className="flex items-center gap-2">
      Recent Sessions
      {unreadCount > 0 && (
        <span className="h-2 w-2 rounded-full bg-blue-500" />
      )}
    </span>
  )

  if (sessions.length === 0) {
    return (
      <Card className="group h-full flex flex-col relative">
        <DragHandle />
        <CardHeader>
          <CardTitle>{titleContent}</CardTitle>
          <CardDescription>Your latest training activities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">No sessions yet</p>
              <p className="text-xs text-muted-foreground">
                Connect intervals.icu or upload a FIT file
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (filteredSessions.length === 0) {
    return (
      <Card className="group h-full flex flex-col relative">
        <DragHandle />
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{titleContent}</CardTitle>
              <CardDescription>Your latest training activities</CardDescription>
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as 'training' | 'all')}>
              <SelectTrigger className="w-[120px] h-8 text-xs shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="shadow-none">
                <SelectItem value="training">Training</SelectItem>
                <SelectItem value="all">All Activities</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">No training sessions</p>
              <p className="text-xs text-muted-foreground">
                Select &quot;All Activities&quot; to see more
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="group h-full flex flex-col overflow-hidden relative">
      <DragHandle />
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{titleContent}</CardTitle>
            <CardDescription>Your latest training activities</CardDescription>
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as 'training' | 'all')}>
            <SelectTrigger className="w-[120px] h-8 text-xs shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="shadow-none">
              <SelectItem value="training">Training</SelectItem>
              <SelectItem value="all">All Activities</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto min-h-0 px-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Date</TableHead>
              <TableHead className="w-[40px]">Score</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right w-[70px]">Time</TableHead>
              <TableHead className="text-right w-[50px]">TSS</TableHead>
              <TableHead className="text-right w-[60px]">NP</TableHead>
              <TableHead className="text-right w-[50px]">IF</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSessions.map((session) => {
              const { date, time } = formatDateTime(session.date)
              const report = sessionReports?.get(session.id)
              const isExpanded = expandedId === session.id
              const hasReport = !!report
              const isUnread = report && !report.is_read

              return (
                <TableRow
                  key={session.id}
                  className={cn(
                    'cursor-pointer hover:bg-muted/50 transition-colors',
                    isExpanded && 'bg-muted/30'
                  )}
                  onClick={() => handleRowClick(session)}
                >
                  <TableCell className="font-medium py-2" colSpan={isExpanded ? 7 : undefined}>
                    {isExpanded && report ? (
                      <div className="py-1">
                        <div className="flex items-center gap-2 mb-3">
                          <SessionScoreGauge score={report.score} size="md" />
                          <div>
                            <div className="text-sm font-medium">{date}</div>
                            {time && <div className="text-xs text-muted-foreground">{time}</div>}
                          </div>
                          <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
                        </div>
                        <DeepAnalysisSection report={report} />
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-1">
                          <div className="text-sm">{date}</div>
                          {isUnread && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
                        </div>
                        {time && <div className="text-xs text-muted-foreground">{time}</div>}
                      </>
                    )}
                  </TableCell>
                  {!isExpanded && (
                    <>
                      <TableCell className="py-2">
                        <SessionScoreGauge score={hasReport ? report.score : null} />
                      </TableCell>
                      <TableCell className="py-2">{getWorkoutTypeBadge(session.workout_type)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm py-2">
                        {formatDuration(session.duration_seconds)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm py-2">
                        {session.tss ?? '-'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm py-2">
                        {session.normalized_power ?? '-'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm py-2">
                        {session.intensity_factor?.toFixed(2) ?? '-'}
                      </TableCell>
                    </>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
