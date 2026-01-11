'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import type { Session } from '@/types'

interface SessionsTableProps {
  sessions: Session[]
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

function formatDateTime(dateStr: string): { date: string; time: string } {
  const date = new Date(dateStr)
  return {
    date: date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }),
    time: date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
  }
}

function getWorkoutTypeBadge(type?: string) {
  if (!type) return null

  return (
    <Badge variant="secondary" className="bg-muted text-muted-foreground hover:bg-muted">
      {type}
    </Badge>
  )
}

export function SessionsTable({ sessions }: SessionsTableProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<'training' | 'all'>('training')

  // Filter to only show cycling/training activities (exclude walks, hikes, etc.)
  const filteredSessions = filter === 'training'
    ? sessions.filter(s =>
        s.sport === 'cycling' ||
        (s.normalized_power && s.normalized_power > 0)
      )
    : sessions

  if (sessions.length === 0) {
    return (
      <Card className="group h-full flex flex-col relative">
        <DragHandle />
        <CardHeader>
          <CardTitle>Recent Sessions</CardTitle>
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
              <CardTitle>Recent Sessions</CardTitle>
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
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Sessions</CardTitle>
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
      <CardContent className="px-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Date</TableHead>
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
              return (
                <TableRow
                  key={session.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => router.push(`/workouts/${session.id}`)}
                >
                  <TableCell className="font-medium py-2">
                    <div className="text-sm">{date}</div>
                    <div className="text-xs text-muted-foreground">{time}</div>
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
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
