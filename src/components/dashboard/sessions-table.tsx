'use client'

import { useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
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

  const colors: Record<string, string> = {
    endurance: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
    tempo: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100',
    sweetspot: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
    threshold: 'bg-red-100 text-red-700 hover:bg-red-100',
    vo2max: 'bg-purple-100 text-purple-700 hover:bg-purple-100',
    recovery: 'bg-green-100 text-green-700 hover:bg-green-100',
    race: 'bg-zinc-900 text-white hover:bg-zinc-900',
  }

  return (
    <Badge variant="secondary" className={colors[type] || ''}>
      {type}
    </Badge>
  )
}

export function SessionsTable({ sessions }: SessionsTableProps) {
  const router = useRouter()

  if (sessions.length === 0) {
    return (
      <Card>
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Sessions</CardTitle>
        <CardDescription>Your latest training activities</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead className="text-right">TSS</TableHead>
              <TableHead className="text-right">NP</TableHead>
              <TableHead className="text-right">IF</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session) => {
              const { date, time } = formatDateTime(session.date)
              return (
                <TableRow
                  key={session.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => router.push(`/workouts/${session.id}`)}
                >
                  <TableCell className="font-medium">
                    <div>{date}</div>
                    <div className="text-xs text-muted-foreground">{time}</div>
                  </TableCell>
                  <TableCell>{getWorkoutTypeBadge(session.workout_type)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatDuration(session.duration_seconds)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {session.tss ?? '-'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {session.normalized_power ? `${session.normalized_power}W` : '-'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
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
