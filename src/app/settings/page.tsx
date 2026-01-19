'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useUser } from '@/hooks/use-user'
import { useTheme } from 'next-themes'
import { Check, Loader2, Link2, Unlink, Sun, Moon, Monitor, RefreshCw, Database, Clock, Scale } from 'lucide-react'

interface AthleteProfile {
  name: string
  ftp: number
  weight_kg: number
  max_hr: number
  lthr: number
  resting_hr: number | null
  weekly_hours_available: number
}

interface SyncStatus {
  connected: boolean
  syncLog: {
    lastSyncAt: string | null
    lastActivityDate: string | null
    status: 'idle' | 'syncing' | 'error'
    errorMessage: string | null
    activitiesSynced: number
    wellnessSynced: number
  } | null
  needsSync: boolean
}

export default function SettingsPage() {
  const router = useRouter()
  const { user, signOut, loading: userLoading } = useUser()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [intervalsConnected, setIntervalsConnected] = useState(false)
  const [withingsConnected, setWithingsConnected] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [withingsDisconnecting, setWithingsDisconnecting] = useState(false)
  const [withingsSyncing, setWithingsSyncing] = useState(false)
  const [withingsSyncResult, setWithingsSyncResult] = useState<{ measurements_fetched: number; inserted: number } | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ activitiesSynced: number; wellnessSynced: number } | null>(null)

  const [profile, setProfile] = useState<AthleteProfile>({
    name: '',
    ftp: 200,
    weight_kg: 75,
    max_hr: 190,
    lthr: 165,
    resting_hr: null,
    weekly_hours_available: 10,
  })

  // Load profile from database
  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfileLoading(false)
      return
    }

    try {
      const res = await fetch('/api/athletes')
      if (res.ok) {
        const data = await res.json()
        setProfile({
          name: data.name || '',
          ftp: data.ftp || 200,
          weight_kg: data.weight_kg || 75,
          max_hr: data.max_hr || 190,
          lthr: data.lthr || 165,
          resting_hr: data.resting_hr ?? null,
          weekly_hours_available: data.weekly_hours_available || 10,
        })
      }
    } catch (error) {
      console.error('Failed to load profile:', error)
    } finally {
      setProfileLoading(false)
    }
  }, [user])

  // Handle hydration for theme
  useEffect(() => {
    setMounted(true)
  }, [])

  // Check intervals.icu connection status
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const res = await fetch('/api/intervals/data')
        const data = await res.json()
        setIntervalsConnected(!!data.athlete)
      } catch {
        setIntervalsConnected(false)
      }
    }
    checkConnection()
  }, [])

  // Check Withings connection status
  useEffect(() => {
    const checkWithingsConnection = async () => {
      if (!user) return
      try {
        // Try to sync - if it fails with "not connected", we're not connected
        const res = await fetch('/api/withings/sync', { method: 'POST' })
        const data = await res.json()
        setWithingsConnected(res.ok || data.error !== 'Withings not connected')
      } catch {
        setWithingsConnected(false)
      }
    }
    checkWithingsConnection()
  }, [user])

  // Fetch sync status
  const fetchSyncStatus = useCallback(async () => {
    if (!user) return
    try {
      const res = await fetch('/api/sync')
      if (res.ok) {
        const data = await res.json()
        setSyncStatus(data)
      }
    } catch (error) {
      console.error('Failed to fetch sync status:', error)
    }
  }, [user])

  useEffect(() => {
    if (user && intervalsConnected) {
      fetchSyncStatus()
    }
  }, [user, intervalsConnected, fetchSyncStatus])

  // Handle sync trigger
  const handleSync = async (force = false) => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      if (res.ok) {
        const data = await res.json()
        setSyncResult({
          activitiesSynced: data.activitiesSynced,
          wellnessSynced: data.wellnessSynced,
        })
        // Refresh sync status
        await fetchSyncStatus()
      }
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      setSyncing(false)
    }
  }

  // Load profile when user is available
  useEffect(() => {
    if (!userLoading) {
      loadProfile()
    }
  }, [user, userLoading, loadProfile])

  const handleSave = async () => {
    setLoading(true)
    setSaved(false)

    try {
      const res = await fetch('/api/athletes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })

      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } else {
        console.error('Failed to save profile:', await res.text())
      }
    } catch (error) {
      console.error('Failed to save profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnectIntervals = () => {
    window.location.href = '/api/auth/intervals/connect'
  }

  const handleDisconnectIntervals = async () => {
    setDisconnecting(true)
    try {
      const res = await fetch('/api/integrations/disconnect', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'intervals_icu' }),
      })

      if (res.ok) {
        setIntervalsConnected(false)
      }
    } catch (error) {
      console.error('Failed to disconnect:', error)
    } finally {
      setDisconnecting(false)
    }
  }

  const handleConnectWithings = () => {
    window.location.href = '/api/auth/withings/connect'
  }

  const handleDisconnectWithings = async () => {
    setWithingsDisconnecting(true)
    try {
      const res = await fetch('/api/integrations/disconnect', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'withings' }),
      })

      if (res.ok) {
        setWithingsConnected(false)
      }
    } catch (error) {
      console.error('Failed to disconnect Withings:', error)
    } finally {
      setWithingsDisconnecting(false)
    }
  }

  const handleWithingsSync = async () => {
    setWithingsSyncing(true)
    setWithingsSyncResult(null)
    try {
      const res = await fetch('/api/withings/sync', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setWithingsSyncResult({
          measurements_fetched: data.measurements_fetched,
          inserted: data.inserted,
        })
        // Reload profile to get updated weight
        await loadProfile()
      }
    } catch (error) {
      console.error('Withings sync failed:', error)
    } finally {
      setWithingsSyncing(false)
    }
  }

  return (
    <main className="flex-1 overflow-auto bg-muted/40">
      <div className="mx-auto max-w-3xl p-6">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Athlete Profile</CardTitle>
                <CardDescription>
                  Your personal metrics used for training calculations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {profileLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Display Name</Label>
                    <Input
                      id="name"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      placeholder="Your name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weekly_hours">Weekly Hours Available</Label>
                    <Input
                      id="weekly_hours"
                      type="number"
                      value={profile.weekly_hours_available}
                      onChange={(e) => setProfile({ ...profile, weekly_hours_available: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-sm font-medium mb-4">Power Metrics</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ftp">FTP (Functional Threshold Power)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="ftp"
                          type="number"
                          value={profile.ftp}
                          onChange={(e) => setProfile({ ...profile, ftp: parseInt(e.target.value) || 0 })}
                        />
                        <span className="text-sm text-muted-foreground">W</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="weight">Body Weight</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="weight"
                          type="number"
                          step="0.1"
                          value={profile.weight_kg}
                          onChange={(e) => setProfile({ ...profile, weight_kg: parseFloat(e.target.value) || 0 })}
                        />
                        <span className="text-sm text-muted-foreground">kg</span>
                      </div>
                    </div>
                  </div>
                  {profile.ftp > 0 && profile.weight_kg > 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      W/kg: {(profile.ftp / profile.weight_kg).toFixed(2)}
                    </p>
                  )}
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-sm font-medium mb-4">Heart Rate Zones</h3>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="max_hr">Max HR</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="max_hr"
                          type="number"
                          value={profile.max_hr}
                          onChange={(e) => setProfile({ ...profile, max_hr: parseInt(e.target.value) || 0 })}
                        />
                        <span className="text-sm text-muted-foreground">bpm</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lthr">LTHR (Threshold)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="lthr"
                          type="number"
                          value={profile.lthr}
                          onChange={(e) => setProfile({ ...profile, lthr: parseInt(e.target.value) || 0 })}
                        />
                        <span className="text-sm text-muted-foreground">bpm</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="resting_hr">Resting HR</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="resting_hr"
                          type="number"
                          value={profile.resting_hr || ''}
                          onChange={(e) => setProfile({ ...profile, resting_hr: e.target.value ? parseInt(e.target.value) : null })}
                          placeholder="Optional"
                        />
                        <span className="text-sm text-muted-foreground">bpm</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSave} disabled={loading || !user}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : saved ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Saved!
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
                {!user && (
                  <p className="text-sm text-muted-foreground text-center">
                    Sign in to save your profile
                  </p>
                )}
                </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integrations Tab */}
          <TabsContent value="integrations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>intervals.icu</CardTitle>
                <CardDescription>
                  Connect to intervals.icu to automatically sync your training data
                </CardDescription>
              </CardHeader>
              <CardContent>
                {intervalsConnected ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                        <Link2 className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium">Connected</p>
                        <p className="text-sm text-muted-foreground">
                          Your training data is syncing automatically
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" onClick={handleDisconnectIntervals} disabled={disconnecting}>
                      {disconnecting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Unlink className="mr-2 h-4 w-4" />
                      )}
                      {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <Unlink className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">Not Connected</p>
                        <p className="text-sm text-muted-foreground">
                          Connect to import your training history
                        </p>
                      </div>
                    </div>
                    <Button onClick={handleConnectIntervals}>
                      <Link2 className="mr-2 h-4 w-4" />
                      Connect
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Data Sync Card - only show when connected */}
            {intervalsConnected && user && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Data Sync
                  </CardTitle>
                  <CardDescription>
                    Sync your training data to local storage for faster AI analysis
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Sync Status */}
                  {syncStatus?.syncLog ? (
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${
                            syncStatus.syncLog.status === 'syncing' ? 'bg-yellow-500 animate-pulse' :
                            syncStatus.syncLog.status === 'error' ? 'bg-red-500' :
                            'bg-green-500'
                          }`} />
                          <span className="text-sm font-medium capitalize">{syncStatus.syncLog.status}</span>
                        </div>
                        {syncStatus.syncLog.lastSyncAt && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Last sync: {new Date(syncStatus.syncLog.lastSyncAt).toLocaleString()}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Activities synced:</span>
                          <span className="ml-2 font-medium">{syncStatus.syncLog.activitiesSynced}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Fitness records:</span>
                          <span className="ml-2 font-medium">{syncStatus.syncLog.wellnessSynced}</span>
                        </div>
                      </div>

                      {syncStatus.syncLog.errorMessage && (
                        <p className="text-sm text-red-500">{syncStatus.syncLog.errorMessage}</p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                      No sync data yet. Click &quot;Sync Now&quot; to start.
                    </div>
                  )}

                  {/* Sync Result Message */}
                  {syncResult && (
                    <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-3 text-sm text-green-700 dark:text-green-300">
                      <Check className="inline h-4 w-4 mr-1" />
                      Synced {syncResult.activitiesSynced} activities and {syncResult.wellnessSynced} fitness records
                    </div>
                  )}

                  {/* Sync Buttons */}
                  <div className="flex gap-3">
                    <Button onClick={() => handleSync(false)} disabled={syncing}>
                      {syncing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Sync Now
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={() => handleSync(true)} disabled={syncing}>
                      Full Re-sync
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Synced data is stored locally and used by the AI Coach for faster, more reliable analysis.
                    Enable FEATURE_LOCAL_DATA=true in your environment to use local data.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Withings Integration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  Withings
                </CardTitle>
                <CardDescription>
                  Connect your Withings smart scale for automatic weight and body composition tracking
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {withingsConnected ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                          <Link2 className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">Connected</p>
                          <p className="text-sm text-muted-foreground">
                            Your weight data is syncing
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" onClick={handleDisconnectWithings} disabled={withingsDisconnecting}>
                        {withingsDisconnecting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Unlink className="mr-2 h-4 w-4" />
                        )}
                        {withingsDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                      </Button>
                    </div>

                    {/* Sync Result Message */}
                    {withingsSyncResult && (
                      <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-3 text-sm text-green-700 dark:text-green-300">
                        <Check className="inline h-4 w-4 mr-1" />
                        Synced {withingsSyncResult.measurements_fetched} measurements ({withingsSyncResult.inserted} new)
                      </div>
                    )}

                    {/* Sync Button */}
                    <Button onClick={handleWithingsSync} disabled={withingsSyncing} variant="outline">
                      {withingsSyncing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Sync Weight Data
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <Scale className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">Not Connected</p>
                        <p className="text-sm text-muted-foreground">
                          Connect to track weight and body composition
                        </p>
                      </div>
                    </div>
                    <Button onClick={handleConnectWithings}>
                      <Link2 className="mr-2 h-4 w-4" />
                      Connect
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Other Integrations</CardTitle>
                <CardDescription>
                  More integrations coming soon
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm text-muted-foreground">
                  <p>Planned integrations:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Strava</li>
                    <li>TrainingPeaks</li>
                    <li>Garmin Connect</li>
                    <li>Wahoo Cloud</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Theme</CardTitle>
                <CardDescription>
                  Choose how Conundrum looks to you
                </CardDescription>
              </CardHeader>
              <CardContent>
                {mounted ? (
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => setTheme('light')}
                      className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors hover:bg-muted ${
                        theme === 'light' ? 'border-foreground/20 bg-muted' : 'border-transparent'
                      }`}
                    >
                      <Sun className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm">Light</span>
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors hover:bg-muted ${
                        theme === 'dark' ? 'border-foreground/20 bg-muted' : 'border-transparent'
                      }`}
                    >
                      <Moon className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm">Dark</span>
                    </button>
                    <button
                      onClick={() => setTheme('system')}
                      className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors hover:bg-muted ${
                        theme === 'system' ? 'border-foreground/20 bg-muted' : 'border-transparent'
                      }`}
                    >
                      <Monitor className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm">System</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Account</CardTitle>
                <CardDescription>
                  Manage your account settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {user ? (
                  <>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Email</Label>
                      <p className="text-sm">{user.email}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">User ID</Label>
                      <p className="text-sm font-mono text-xs">{user.id}</p>
                    </div>
                    <div className="pt-4">
                      <Button variant="outline" onClick={signOut}>
                        Sign Out
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground mb-4">
                      Sign in to save your data across devices
                    </p>
                    <Button onClick={() => router.push('/login')}>
                      Sign In
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>
                  Irreversible actions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" disabled>
                  Delete Account
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Contact support to delete your account
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
