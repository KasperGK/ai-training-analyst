'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useUser } from '@/hooks/use-user'
import { ArrowLeft, Check, Loader2, Link2, Unlink } from 'lucide-react'

interface AthleteProfile {
  name: string
  ftp: number
  weight_kg: number
  max_hr: number
  lthr: number
  resting_hr: number | null
  weekly_hours_available: number
}

export default function SettingsPage() {
  const router = useRouter()
  const { user, signOut } = useUser()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [intervalsConnected, setIntervalsConnected] = useState(false)

  const [profile, setProfile] = useState<AthleteProfile>({
    name: '',
    ftp: 200,
    weight_kg: 75,
    max_hr: 190,
    lthr: 165,
    resting_hr: null,
    weekly_hours_available: 10,
  })

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

  // TODO: Load profile from database when API is ready
  // useEffect(() => { loadProfile() }, [user])

  const handleSave = async () => {
    setLoading(true)
    setSaved(false)

    try {
      // TODO: Save to database via API
      // await fetch('/api/athletes', {
      //   method: 'PATCH',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(profile),
      // })

      // Simulate save for now
      await new Promise(resolve => setTimeout(resolve, 500))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
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
    // TODO: Implement disconnect
    setIntervalsConnected(false)
  }

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Header */}
      <header className="border-b bg-background px-6 py-4">
        <div className="mx-auto max-w-3xl flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Manage your profile and integrations
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl p-6">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
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
                  <Button onClick={handleSave} disabled={loading}>
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
                    <Button variant="outline" onClick={handleDisconnectIntervals}>
                      <Unlink className="mr-2 h-4 w-4" />
                      Disconnect
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
      </main>
    </div>
  )
}
