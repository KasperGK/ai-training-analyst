'use client'

import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { AthleteProfileTab } from '@/components/athlete/profile-tab'
import { AthleteDataTab } from '@/components/athlete/data-tab'

type AthleteTab = 'profile' | 'data'

export function AthleteContent() {
  const [tab, setTab] = useState<AthleteTab>('profile')

  return (
    <main className="h-full overflow-y-auto bg-muted/40">
      <div className="container px-4 pt-[88px] pb-6">
        <div className="mx-auto max-w-4xl">
          <Tabs value={tab} onValueChange={(v) => setTab(v as AthleteTab)} className="space-y-6">
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
