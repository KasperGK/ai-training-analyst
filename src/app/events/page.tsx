'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useUser } from '@/hooks/use-user'
import {
  Plus,
  Calendar,
  Target,
  Trash2,
  Edit,
  Loader2,
  Trophy,
  Flag,
} from 'lucide-react'
import type { Event, Goal } from '@/types'

const EVENT_TYPES = [
  { value: 'road_race', label: 'Road Race' },
  { value: 'gran_fondo', label: 'Gran Fondo' },
  { value: 'crit', label: 'Criterium' },
  { value: 'tt', label: 'Time Trial' },
  { value: 'mtb', label: 'Mountain Bike' },
  { value: 'gravel', label: 'Gravel' },
  { value: 'other', label: 'Other' },
]

const GOAL_TYPES = [
  { value: 'ftp', label: 'Increase FTP', unit: 'watts' },
  { value: 'weight', label: 'Target Weight', unit: 'kg' },
  { value: 'ctl', label: 'Build Fitness (CTL)', unit: 'TSS/day' },
  { value: 'weekly_hours', label: 'Weekly Hours', unit: 'hours' },
  { value: 'event_finish', label: 'Complete Event', unit: null },
]

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function daysUntil(dateStr: string) {
  const date = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)
  const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return diff
}

export default function EventsPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [events, setEvents] = useState<Event[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Event dialog state
  const [eventDialogOpen, setEventDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [eventForm, setEventForm] = useState({
    name: '',
    date: '',
    priority: 'B' as 'A' | 'B' | 'C',
    event_type: '',
    distance_km: '',
    elevation_m: '',
  })

  // Goal dialog state
  const [goalDialogOpen, setGoalDialogOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [goalForm, setGoalForm] = useState({
    title: '',
    target_type: 'ftp',
    target_value: '',
    current_value: '',
    deadline: '',
    event_id: '',
  })

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      const [eventsRes, goalsRes] = await Promise.all([
        fetch('/api/events'),
        fetch('/api/goals'),
      ])

      if (eventsRes.ok) {
        setEvents(await eventsRes.json())
      }
      if (goalsRes.ok) {
        setGoals(await goalsRes.json())
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!userLoading) {
      loadData()
    }
  }, [user, userLoading, loadData])

  // Event handlers
  const openEventDialog = (event?: Event) => {
    if (event) {
      setEditingEvent(event)
      setEventForm({
        name: event.name,
        date: event.date,
        priority: event.priority,
        event_type: event.event_type || '',
        distance_km: event.distance_km?.toString() || '',
        elevation_m: event.elevation_m?.toString() || '',
      })
    } else {
      setEditingEvent(null)
      setEventForm({
        name: '',
        date: '',
        priority: 'B',
        event_type: '',
        distance_km: '',
        elevation_m: '',
      })
    }
    setEventDialogOpen(true)
  }

  const saveEvent = async () => {
    setSaving(true)
    try {
      const body = {
        ...(editingEvent ? { id: editingEvent.id } : {}),
        name: eventForm.name,
        date: eventForm.date,
        priority: eventForm.priority,
        event_type: eventForm.event_type || null,
        distance_km: eventForm.distance_km ? parseFloat(eventForm.distance_km) : null,
        elevation_m: eventForm.elevation_m ? parseFloat(eventForm.elevation_m) : null,
      }

      const res = await fetch('/api/events', {
        method: editingEvent ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        setEventDialogOpen(false)
        loadData()
      }
    } catch (error) {
      console.error('Failed to save event:', error)
    } finally {
      setSaving(false)
    }
  }

  const deleteEvent = async (id: string) => {
    if (!confirm('Delete this event?')) return

    try {
      const res = await fetch(`/api/events?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        loadData()
      }
    } catch (error) {
      console.error('Failed to delete event:', error)
    }
  }

  // Goal handlers
  const openGoalDialog = (goal?: Goal) => {
    if (goal) {
      setEditingGoal(goal)
      setGoalForm({
        title: goal.title,
        target_type: goal.target_type,
        target_value: goal.target_value?.toString() || '',
        current_value: goal.current_value?.toString() || '',
        deadline: goal.deadline || '',
        event_id: goal.event_id || '',
      })
    } else {
      setEditingGoal(null)
      setGoalForm({
        title: '',
        target_type: 'ftp',
        target_value: '',
        current_value: '',
        deadline: '',
        event_id: '',
      })
    }
    setGoalDialogOpen(true)
  }

  const saveGoal = async () => {
    setSaving(true)
    try {
      const body = {
        ...(editingGoal ? { id: editingGoal.id } : {}),
        title: goalForm.title,
        target_type: goalForm.target_type,
        target_value: goalForm.target_value ? parseFloat(goalForm.target_value) : null,
        current_value: goalForm.current_value ? parseFloat(goalForm.current_value) : null,
        deadline: goalForm.deadline || null,
        event_id: goalForm.event_id || null,
      }

      const res = await fetch('/api/goals', {
        method: editingGoal ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        setGoalDialogOpen(false)
        loadData()
      }
    } catch (error) {
      console.error('Failed to save goal:', error)
    } finally {
      setSaving(false)
    }
  }

  const deleteGoal = async (id: string) => {
    if (!confirm('Delete this goal?')) return

    try {
      const res = await fetch(`/api/goals?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        loadData()
      }
    } catch (error) {
      console.error('Failed to delete goal:', error)
    }
  }

  const toggleGoalStatus = async (goal: Goal) => {
    const newStatus = goal.status === 'active' ? 'completed' : 'active'
    try {
      const res = await fetch('/api/goals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: goal.id, status: newStatus }),
      })
      if (res.ok) {
        loadData()
      }
    } catch (error) {
      console.error('Failed to update goal:', error)
    }
  }

  const upcomingEvents = events.filter(e => e.status === 'planned' && daysUntil(e.date) >= 0)
  const pastEvents = events.filter(e => e.status !== 'planned' || daysUntil(e.date) < 0)
  const activeGoals = goals.filter(g => g.status === 'active')
  const completedGoals = goals.filter(g => g.status === 'completed')

  return (
    <main className="flex-1 overflow-auto bg-muted/40">
      <div className="mx-auto max-w-4xl p-6">
        {!user && !userLoading ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-4">
                Sign in to track your events and goals
              </p>
              <Button onClick={() => router.push('/login')}>Sign In</Button>
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="events" className="space-y-6">
            <TabsList>
              <TabsTrigger value="events" className="gap-2">
                <Calendar className="h-4 w-4" />
                Events
              </TabsTrigger>
              <TabsTrigger value="goals" className="gap-2">
                <Target className="h-4 w-4" />
                Goals
              </TabsTrigger>
            </TabsList>

            {/* Events Tab */}
            <TabsContent value="events" className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium">Upcoming Events</h2>
                <Button onClick={() => openEventDialog()} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Event
                </Button>
              </div>

              {upcomingEvents.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No upcoming events. Add your first race or event!
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((event) => (
                    <Card key={event.id}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-muted">
                              {event.priority === 'A' ? (
                                <Trophy className="h-6 w-6 text-amber-500" />
                              ) : (
                                <Flag className="h-6 w-6 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{event.name}</span>
                                <Badge variant={event.priority === 'A' ? 'default' : 'secondary'}>
                                  {event.priority} Race
                                </Badge>
                              </div>
                              <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                                <span>{formatDate(event.date)}</span>
                                <span className="font-medium text-foreground">
                                  {daysUntil(event.date)} days
                                </span>
                                {event.distance_km && <span>{event.distance_km} km</span>}
                                {event.elevation_m && <span>{event.elevation_m}m elev</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEventDialog(event)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteEvent(event.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {pastEvents.length > 0 && (
                <>
                  <h2 className="text-lg font-medium mt-8">Past Events</h2>
                  <div className="space-y-3 opacity-60">
                    {pastEvents.slice(0, 5).map((event) => (
                      <Card key={event.id}>
                        <CardContent className="py-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium">{event.name}</span>
                              <span className="text-sm text-muted-foreground ml-4">
                                {formatDate(event.date)}
                              </span>
                            </div>
                            <Badge variant="outline">{event.status}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            {/* Goals Tab */}
            <TabsContent value="goals" className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium">Active Goals</h2>
                <Button onClick={() => openGoalDialog()} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Goal
                </Button>
              </div>

              {activeGoals.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No active goals. Set a training objective!
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {activeGoals.map((goal) => {
                    const goalType = GOAL_TYPES.find(t => t.value === goal.target_type)
                    const progress = goal.target_value && goal.current_value
                      ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100))
                      : 0

                    return (
                      <Card key={goal.id}>
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{goal.title}</span>
                                {goalType && (
                                  <Badge variant="outline">{goalType.label}</Badge>
                                )}
                              </div>
                              {goal.target_value && (
                                <div className="mt-2">
                                  <div className="flex justify-between text-sm mb-1">
                                    <span className="text-muted-foreground">
                                      {goal.current_value || 0} / {goal.target_value} {goalType?.unit}
                                    </span>
                                    <span>{progress}%</span>
                                  </div>
                                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-primary transition-all"
                                      style={{ width: `${progress}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                              {goal.deadline && (
                                <p className="text-sm text-muted-foreground mt-2">
                                  Deadline: {formatDate(goal.deadline)}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2 ml-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleGoalStatus(goal)}
                              >
                                Complete
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openGoalDialog(goal)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteGoal(goal.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}

              {completedGoals.length > 0 && (
                <>
                  <h2 className="text-lg font-medium mt-8">Completed Goals</h2>
                  <div className="space-y-3 opacity-60">
                    {completedGoals.slice(0, 5).map((goal) => (
                      <Card key={goal.id}>
                        <CardContent className="py-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium line-through">{goal.title}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleGoalStatus(goal)}
                            >
                              Reactivate
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Event Dialog */}
      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Edit Event' : 'Add Event'}</DialogTitle>
            <DialogDescription>
              Track your races and important cycling events
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="event-name">Event Name</Label>
              <Input
                id="event-name"
                value={eventForm.name}
                onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                placeholder="Gran Fondo NYC"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event-date">Date</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={eventForm.date}
                  onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-priority">Priority</Label>
                <Select
                  value={eventForm.priority}
                  onValueChange={(v) => setEventForm({ ...eventForm, priority: v as 'A' | 'B' | 'C' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A Race (Peak)</SelectItem>
                    <SelectItem value="B">B Race (Important)</SelectItem>
                    <SelectItem value="C">C Race (Training)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-type">Event Type</Label>
              <Select
                value={eventForm.event_type}
                onValueChange={(v) => setEventForm({ ...eventForm, event_type: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event-distance">Distance (km)</Label>
                <Input
                  id="event-distance"
                  type="number"
                  value={eventForm.distance_km}
                  onChange={(e) => setEventForm({ ...eventForm, distance_km: e.target.value })}
                  placeholder="100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-elevation">Elevation (m)</Label>
                <Input
                  id="event-elevation"
                  type="number"
                  value={eventForm.elevation_m}
                  onChange={(e) => setEventForm({ ...eventForm, elevation_m: e.target.value })}
                  placeholder="1500"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEvent} disabled={saving || !eventForm.name || !eventForm.date}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingEvent ? 'Save Changes' : 'Add Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Goal Dialog */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGoal ? 'Edit Goal' : 'Add Goal'}</DialogTitle>
            <DialogDescription>
              Set measurable training objectives
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="goal-title">Goal Title</Label>
              <Input
                id="goal-title"
                value={goalForm.title}
                onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                placeholder="Reach 300W FTP"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-type">Goal Type</Label>
              <Select
                value={goalForm.target_type}
                onValueChange={(v) => setGoalForm({ ...goalForm, target_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="goal-current">Current Value</Label>
                <Input
                  id="goal-current"
                  type="number"
                  value={goalForm.current_value}
                  onChange={(e) => setGoalForm({ ...goalForm, current_value: e.target.value })}
                  placeholder="250"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal-target">Target Value</Label>
                <Input
                  id="goal-target"
                  type="number"
                  value={goalForm.target_value}
                  onChange={(e) => setGoalForm({ ...goalForm, target_value: e.target.value })}
                  placeholder="300"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-deadline">Deadline (optional)</Label>
              <Input
                id="goal-deadline"
                type="date"
                value={goalForm.deadline}
                onChange={(e) => setGoalForm({ ...goalForm, deadline: e.target.value })}
              />
            </div>
            {events.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="goal-event">Link to Event (optional)</Label>
                <Select
                  value={goalForm.event_id}
                  onValueChange={(v) => setGoalForm({ ...goalForm, event_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No event</SelectItem>
                    {events.filter(e => e.status === 'planned').map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name} ({formatDate(event.date)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGoalDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveGoal} disabled={saving || !goalForm.title}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingGoal ? 'Save Changes' : 'Add Goal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
