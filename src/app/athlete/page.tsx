'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ArrowLeft, Settings } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { InsightsDropdown } from '@/components/insights/insights-dropdown'
import { AthleteProfileTab } from '@/components/athlete/profile-tab'
import { AthleteDataTab } from '@/components/athlete/data-tab'

const VALID_TABS = ['profile', 'data'] as const
type AthleteTab = typeof VALID_TABS[number]

// Map old tab names to new ones for backwards compatibility
const TAB_REDIRECTS: Record<string, AthleteTab> = {
  overview: 'profile',
  power: 'data',
  recovery: 'data',
  history: 'data',
  events: 'data',
}

function AthletePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')

  // Handle legacy tab redirects
  let tab: AthleteTab = 'profile'
  if (tabParam) {
    if (VALID_TABS.includes(tabParam as AthleteTab)) {
      tab = tabParam as AthleteTab
    } else if (TAB_REDIRECTS[tabParam]) {
      tab = TAB_REDIRECTS[tabParam]
    }
  }

  const handleTabChange = (newTab: string) => {
    router.push(`/athlete?tab=${newTab}`, { scroll: false })
  }

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="mr-2">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Logo className="h-6 w-6" />
            <h1 className="text-lg font-semibold">Athlete</h1>
          </div>
          <div className="flex items-center gap-1">
            <InsightsDropdown />
            <Link href="/settings">
              <Button variant="ghost" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container px-4 py-6">
        <div className="mx-auto max-w-4xl">
          <Tabs value={tab} onValueChange={handleTabChange} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 max-w-xs">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="data">Data</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="mt-6">
              <AthleteProfileTab />
            </TabsContent>

            <TabsContent value="data" className="mt-6">
              <AthleteDataTab />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}

export default function AthletePage() {
  return (
    <Suspense fallback={<AthletePageSkeleton />}>
      <AthletePageContent />
    </Suspense>
  )
}

function AthletePageSkeleton() {
  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="container flex h-14 items-center px-4">
          <div className="h-6 w-6 bg-muted rounded animate-pulse mr-3" />
          <div className="h-6 w-32 bg-muted rounded animate-pulse" />
        </div>
      </header>
      <main className="container px-4 py-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="h-10 w-48 bg-muted rounded animate-pulse" />
          <div className="h-40 bg-muted rounded animate-pulse" />
          <div className="h-52 bg-muted rounded animate-pulse" />
          <div className="h-64 bg-muted rounded animate-pulse" />
        </div>
      </main>
    </div>
  )
}
