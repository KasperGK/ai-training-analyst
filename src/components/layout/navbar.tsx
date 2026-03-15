'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'
import { InsightsDropdown } from '@/components/insights/insights-dropdown'
import { useUser } from '@/hooks/use-user'
import { useIntervalsData } from '@/hooks/use-intervals-data'
import {
  BookOpen,
  Link2,
  Unlink,
  LayoutGrid,
  CalendarCheck,
  User,
  Brain,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProfileDropdown } from '@/components/layout/profile-dropdown'

export function Navbar() {
  const pathname = usePathname()
  const { user, signOut } = useUser()
  const { connected, loading, connect } = useIntervalsData()

  // Track active path — syncs with both Next.js navigation and carousel swipes
  const [activePath, setActivePath] = useState(pathname)

  useEffect(() => { setActivePath(pathname) }, [pathname])

  useEffect(() => {
    const handler = (e: Event) => setActivePath((e as CustomEvent).detail.path)
    window.addEventListener('carousel-page-change', handler)
    return () => window.removeEventListener('carousel-page-change', handler)
  }, [])

  const isActive = (path: string) => activePath === path

  return (
    <header className="fixed top-4 left-4 right-4 z-40 bg-white/10 backdrop-blur-lg backdrop-saturate-150 px-6 py-2.5 rounded-full border border-white/20 shadow-lg shadow-black/5 dark:bg-white/5 dark:border-white/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Logo className="h-7 w-7" />
          <h1 className="text-lg font-semibold tracking-tight">Conundrum.</h1>
        </div>
        <nav className="flex items-center gap-1">
          {/* Dashboard */}
          <Button
            variant="ghost"
            size="icon"
            asChild
            title="Dashboard"
            className={cn(isActive('/') && 'bg-muted')}
          >
            <Link href="/">
              <LayoutGrid className="h-[18px] w-[18px]" fill={isActive('/') ? 'currentColor' : 'none'} />
              <span className="sr-only">Dashboard</span>
            </Link>
          </Button>

          {/* AI Coach */}
          <Button
            variant="ghost"
            size="icon"
            asChild
            title="AI Coach"
            className={cn(isActive('/coach') && 'bg-muted')}
          >
            <Link href="/coach">
              <Brain className="h-[18px] w-[18px]" fill={isActive('/coach') ? 'currentColor' : 'none'} />
              <span className="sr-only">AI Coach</span>
            </Link>
          </Button>

          {/* Training Plan */}
          <Button
            variant="ghost"
            size="icon"
            asChild
            title="Training Plan"
            className={cn(isActive('/training') && 'bg-muted')}
          >
            <Link href="/training">
              <CalendarCheck className="h-[18px] w-[18px]" fill={isActive('/training') ? 'currentColor' : 'none'} />
              <span className="sr-only">Training Plan</span>
            </Link>
          </Button>

          {/* Athlete Profile */}
          <Button
            variant="ghost"
            size="icon"
            asChild
            title="Athlete Profile"
            className={cn(isActive('/athlete') && 'bg-muted')}
          >
            <Link href="/athlete">
              <User className="h-[18px] w-[18px]" fill={isActive('/athlete') ? 'currentColor' : 'none'} />
              <span className="sr-only">Athlete Profile</span>
            </Link>
          </Button>

          {/* Learn */}
          <Button
            variant="ghost"
            size="icon"
            asChild
            title="Learn"
            className={cn(activePath.startsWith('/learn') && 'bg-muted')}
          >
            <Link href="/learn">
              <BookOpen className="h-[18px] w-[18px]" fill={activePath.startsWith('/learn') ? 'currentColor' : 'none'} />
              <span className="sr-only">Learn</span>
            </Link>
          </Button>

          {/* Insights */}
          <InsightsDropdown />

          {/* Connection status */}
          {connected ? (
            <Button variant="ghost" size="icon" className="relative" title="Connected to intervals.icu">
              <Link2 className="h-5 w-5 text-green-600" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={connect} disabled={loading} title="Connect intervals.icu">
              <Unlink className="h-5 w-5 text-muted-foreground" />
            </Button>
          )}

          {/* Profile dropdown */}
          {user && (
            <ProfileDropdown user={user} onSignOut={signOut} />
          )}
        </nav>
      </div>
    </header>
  )
}
