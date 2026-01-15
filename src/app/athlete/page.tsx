'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
    <main className="flex-1 overflow-auto bg-muted/40">
      <div className="container px-4 py-6">
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
      </div>
    </main>
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
    <main className="flex-1 overflow-auto bg-muted/40">
      <div className="container px-4 py-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="h-10 w-48 bg-muted rounded animate-pulse" />
          <div className="h-40 bg-muted rounded animate-pulse" />
          <div className="h-52 bg-muted rounded animate-pulse" />
          <div className="h-64 bg-muted rounded animate-pulse" />
        </div>
      </div>
    </main>
  )
}
