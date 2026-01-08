'use client'

import { Skeleton } from '@/components/ui/skeleton'
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

export function MetricCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-16 mt-1" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  )
}

export function FitnessMetricsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCardSkeleton />
      <MetricCardSkeleton />
      <MetricCardSkeleton />
      <MetricCardSkeleton />
    </div>
  )
}

export function PMCChartSkeleton() {
  // Fixed heights to avoid hydration mismatch (no Math.random())
  const barHeights = [120, 95, 140, 110, 130, 85, 150]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Management</CardTitle>
        <CardDescription>
          Fitness, fatigue, and form over the last 6 weeks
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] w-full flex items-end gap-2 px-4">
          {/* Simulated bar chart skeleton */}
          {barHeights.map((height, i) => (
            <div key={i} className="flex-1 flex flex-col gap-1 items-center">
              <Skeleton
                className="w-full rounded"
                style={{ height: `${height}px` }}
              />
              <Skeleton className="h-3 w-8 mt-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function SessionsTableSkeleton({ rows = 4 }: { rows?: number }) {
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
            {Array.from({ length: rows }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="h-4 w-12 ml-auto" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="h-4 w-8 ml-auto" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="h-4 w-12 ml-auto" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="h-4 w-10 ml-auto" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function FileUploadSkeleton() {
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col items-center justify-center p-6">
        <Skeleton className="h-10 w-10 rounded-full mb-3" />
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-3 w-24" />
      </CardContent>
    </Card>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <FitnessMetricsSkeleton />
        <FileUploadSkeleton />
      </div>
      <PMCChartSkeleton />
      <SessionsTableSkeleton />
    </div>
  )
}
