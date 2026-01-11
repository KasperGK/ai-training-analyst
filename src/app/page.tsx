'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { FitnessMetrics } from '@/components/dashboard/fitness-metrics'
import { SessionsTable } from '@/components/dashboard/sessions-table'
import { PMCChart } from '@/components/dashboard/pmc-chart'
import { AICoachPanel } from '@/components/dashboard/ai-coach-panel'
import { FileUpload } from '@/components/dashboard/file-upload'
import {
  FitnessMetricsSkeleton,
  PMCChartSkeleton,
  SessionsTableSkeleton,
  FileUploadSkeletonCompact,
} from '@/components/dashboard/skeletons'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useIntervalsData } from '@/hooks/use-intervals-data'
import { useUser } from '@/hooks/use-user'
import { useSync } from '@/hooks/use-sync'
import { Settings, Calendar, GripVertical, GripHorizontal, BookOpen, Check, Link2 } from 'lucide-react'
import Link from 'next/link'
import { Logo } from '@/components/ui/logo'
import type { Session } from '@/types'

const STORAGE_KEY = 'dashboard-order-v2'
const CHAT_HEIGHT_KEY = 'ai-coach-height'
const DEFAULT_CHAT_HEIGHT = 700

const defaultLeftOrder = ['top-row', 'chart', 'sessions']
const defaultRightOrder = ['ai']

interface SortableCardProps {
  id: string
  children: React.ReactNode
}

function SortableCard({ id, children }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div
        {...attributes}
        {...listeners}
        className="absolute top-3 right-3 z-10 cursor-grab active:cursor-grabbing p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      {children}
    </div>
  )
}

export default function Dashboard() {
  const { user, signOut } = useUser()
  const {
    connected,
    loading,
    athlete,
    currentFitness,
    sessions,
    pmcData,
    ctlTrend,
    connect,
  } = useIntervalsData()

  // Auto-sync data to Supabase when needed
  useSync({ autoSync: true })

  const [uploadedSessions, setUploadedSessions] = useState<Session[]>([])
  const [mounted, setMounted] = useState(false)
  const [chatHeight, setChatHeight] = useState(DEFAULT_CHAT_HEIGHT)
  const chatCardRef = useRef<HTMLDivElement>(null)
  const leftColumnRef = useRef<HTMLDivElement>(null)

  // Calculate snap points based on left column card heights
  const getSnapPoints = useCallback(() => {
    if (!leftColumnRef.current) return [400, 550, 800] // fallbacks

    const children = leftColumnRef.current.children
    const gap = 16 // space-y-4
    const snapPoints: number[] = []
    let cumulative = 0

    for (let i = 0; i < children.length; i++) {
      cumulative += children[i].getBoundingClientRect().height
      if (i > 0) cumulative += gap
      snapPoints.push(Math.round(cumulative))
    }

    return snapPoints
  }, [])

  // Snap to nearest point if within threshold
  const snapToNearest = useCallback((height: number, points: number[]) => {
    const SNAP_THRESHOLD = 30 // px

    for (const point of points) {
      if (Math.abs(height - point) <= SNAP_THRESHOLD) {
        return point
      }
    }
    return height
  }, [])

  // Custom resize handler with snapping
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = chatHeight
    let currentHeight = startHeight

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY
      const newHeight = Math.max(400, startHeight + deltaY)
      const snapPoints = getSnapPoints()
      const snappedHeight = snapToNearest(newHeight, snapPoints)
      currentHeight = snappedHeight
      setChatHeight(snappedHeight)
    }

    const handleMouseUp = () => {
      localStorage.setItem(CHAT_HEIGHT_KEY, currentHeight.toString())
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [chatHeight, getSnapPoints, snapToNearest])

  useEffect(() => {
    setMounted(true)
    // Load chat height from localStorage
    const savedHeight = localStorage.getItem(CHAT_HEIGHT_KEY)
    if (savedHeight) {
      setChatHeight(parseInt(savedHeight, 10))
    }
  }, [])

  
  const [leftOrder, setLeftOrder] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          return parsed.left || defaultLeftOrder
        } catch {
          return defaultLeftOrder
        }
      }
    }
    return defaultLeftOrder
  })

  const [rightOrder, setRightOrder] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          return parsed.right || defaultRightOrder
        } catch {
          return defaultRightOrder
        }
      }
    }
    return defaultRightOrder
  })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const saveOrder = useCallback((left: string[], right: string[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ left, right }))
    }
  }, [])

  const handleLeftDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setLeftOrder((items) => {
        const oldIndex = items.indexOf(active.id as string)
        const newIndex = items.indexOf(over.id as string)
        const newOrder = arrayMove(items, oldIndex, newIndex)
        saveOrder(newOrder, rightOrder)
        return newOrder
      })
    }
  }, [rightOrder, saveOrder])

  const handleRightDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setRightOrder((items) => {
        const oldIndex = items.indexOf(active.id as string)
        const newIndex = items.indexOf(over.id as string)
        const newOrder = arrayMove(items, oldIndex, newIndex)
        saveOrder(leftOrder, newOrder)
        return newOrder
      })
    }
  }, [leftOrder, saveOrder])

  const handleSessionUploaded = useCallback((session: Session) => {
    setUploadedSessions(prev => [session, ...prev])
  }, [])

  const allSessions = useMemo(() =>
    [...uploadedSessions, ...sessions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [uploadedSessions, sessions]
  )

  const displayFitness = currentFitness
  const displaySessions = allSessions
  const displayPmcData = pmcData
  const displayCtlTrend = ctlTrend
  const athleteFtp = athlete?.ftp || 250

  const athleteContextString = useMemo(() => JSON.stringify(
    {
      athlete: athlete || {
        ftp: 250,
        weight_kg: 75,
        weekly_hours: 8,
      },
      currentFitness: displayFitness,
      recentSessions: displaySessions,
    },
    null,
    2
  ), [athlete, displayFitness, displaySessions])

  const leftCards: Record<string, React.ReactNode> = {
    'top-row': (
      <div className="grid grid-cols-4 gap-4">
        {loading ? (
          <>
            <FitnessMetricsSkeleton />
            <FileUploadSkeletonCompact />
          </>
        ) : (
          <>
            <FitnessMetrics fitness={displayFitness} />
            <FileUpload onSessionUploaded={handleSessionUploaded} ftp={athleteFtp} compact />
          </>
        )}
      </div>
    ),
    chart: loading ? <PMCChartSkeleton /> : <PMCChart data={displayPmcData} ctlTrend={displayCtlTrend} />,
    sessions: loading ? <SessionsTableSkeleton /> : <SessionsTable sessions={displaySessions} />,
  }

  const rightCards: Record<string, React.ReactNode> = {
    ai: (
      <Card
        ref={chatCardRef}
        className="min-h-[400px] max-h-[90vh] flex flex-col overflow-hidden relative py-5"
        style={{ height: chatHeight }}
      >
        <CardContent className="flex-1 p-0 overflow-hidden">
          <AICoachPanel
            athleteContext={athleteContextString}
            athleteId={user?.id}
            className="h-full rounded-none border-0 shadow-none"
          />
        </CardContent>
        {/* Custom resize handle */}
        <div
          onMouseDown={handleResizeStart}
          className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center hover:bg-muted/50 transition-colors"
        >
          <GripHorizontal className="h-3 w-3 text-muted-foreground" />
        </div>
      </Card>
    ),
  }

  return (
    <div className="flex h-screen flex-col bg-muted/40">
      {/* Header */}
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo className="h-8 w-8" />
            <h1 className="text-xl font-semibold tracking-tight">Conundrum.</h1>
          </div>
          <div className="flex items-center gap-1">
            {connected ? (
              <Button variant="ghost" size="icon" className="relative" title="Connected to intervals.icu">
                <div className="h-5 w-5 rounded-full bg-green-600 flex items-center justify-center">
                  <Check className="h-1.5 w-1.5 text-white" strokeWidth={3} />
                </div>
              </Button>
            ) : (
              <Button variant="ghost" size="icon" onClick={connect} disabled={loading} title="Connect intervals.icu">
                <Link2 className="h-5 w-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" asChild>
              <Link href="/learn">
                <BookOpen className="h-5 w-5" />
                <span className="sr-only">Learn</span>
              </Link>
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <Link href="/events">
                <Calendar className="h-5 w-5" />
                <span className="sr-only">Events & Goals</span>
              </Link>
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <Link href="/settings">
                <Settings className="h-5 w-5" />
                <span className="sr-only">Settings</span>
              </Link>
            </Button>
            {user && (
              <Button variant="ghost" size="sm" onClick={signOut}>
                Sign out
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-7xl">
          {/* Connect prompt when not connected */}
          {!connected && !loading && (
            <div className="mb-6 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <strong>Connect your data:</strong> Link your intervals.icu account to see your training data, or upload .FIT files directly.
            </div>
          )}

          {/* Dashboard Grid */}
          <div className="grid grid-cols-12 gap-4">
            {/* Left Column */}
            <div className="col-span-12 lg:col-span-8">
              {mounted ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleLeftDragEnd}
                >
                  <SortableContext items={leftOrder} strategy={verticalListSortingStrategy}>
                    <div ref={leftColumnRef} className="space-y-4">
                      {leftOrder.map((id) => (
                        <SortableCard key={id} id={id}>
                          {leftCards[id]}
                        </SortableCard>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="space-y-4">
                  {leftOrder.map((id) => (
                    <div key={id}>{leftCards[id]}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="col-span-12 lg:col-span-4">
              {mounted ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleRightDragEnd}
                >
                  <SortableContext items={rightOrder} strategy={verticalListSortingStrategy}>
                    <div className="space-y-4">
                      {rightOrder.map((id) => (
                        <SortableCard key={id} id={id}>
                          {rightCards[id]}
                        </SortableCard>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="space-y-4">
                  {rightOrder.map((id) => (
                    <div key={id}>{rightCards[id]}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
