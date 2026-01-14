'use client'

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
import { Trophy } from 'lucide-react'
import type { PowerCurvePoint } from '@/app/api/power-curve/route'

interface PowerBestsTableProps {
  powerCurve: PowerCurvePoint[]
}

export function PowerBestsTable({ powerCurve }: PowerBestsTableProps) {
  if (powerCurve.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Personal Bests
          </CardTitle>
          <CardDescription>
            Your best power outputs at key durations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            No power bests recorded yet.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4" />
          Personal Bests
        </CardTitle>
        <CardDescription>
          Your best power outputs at key durations
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Duration</TableHead>
              <TableHead className="text-right">Power</TableHead>
              <TableHead className="text-right">W/kg</TableHead>
              <TableHead className="text-right pr-4">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {powerCurve.map((point) => (
              <TableRow key={point.duration}>
                <TableCell className="pl-4 font-medium">
                  {point.durationLabel}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {point.watts}W
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {point.wattsPerKg !== null
                    ? `${point.wattsPerKg.toFixed(2)}`
                    : '-'}
                </TableCell>
                <TableCell className="text-right pr-4 text-muted-foreground text-xs">
                  {new Date(point.date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
