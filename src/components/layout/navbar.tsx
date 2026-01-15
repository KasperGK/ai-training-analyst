'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'
import { InsightsDropdown } from '@/components/insights/insights-dropdown'
import { useUser } from '@/hooks/use-user'
import { useIntervalsData } from '@/hooks/use-intervals-data'
import {
  Settings,
  BookOpen,
  Link2,
  Unlink,
  LayoutGrid,
  CalendarCheck,
  User,
  Brain,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function Navbar() {
  const pathname = usePathname()
  const { user, signOut } = useUser()
  const { connected, loading, connect } = useIntervalsData()

  const isActive = (path: string) => pathname === path

  return (
    <header className="fixed top-4 left-4 right-4 z-50 border border-border/50 bg-background/50 backdrop-blur-md px-6 py-2.5 rounded-full">
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
              <LayoutGrid className="h-[18px] w-[18px]" />
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
              <Brain className="h-[18px] w-[18px]" />
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
              <CalendarCheck className="h-[18px] w-[18px]" />
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
              <User className="h-[18px] w-[18px]" />
              <span className="sr-only">Athlete Profile</span>
            </Link>
          </Button>

          {/* Learn */}
          <Button
            variant="ghost"
            size="icon"
            asChild
            title="Learn"
            className={cn(pathname.startsWith('/learn') && 'bg-muted')}
          >
            <Link href="/learn">
              <BookOpen className="h-[18px] w-[18px]" />
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

          {/* Settings */}
          <Button
            variant="ghost"
            size="icon"
            asChild
            title="Settings"
            className={cn(isActive('/settings') && 'bg-muted')}
          >
            <Link href="/settings">
              <Settings className="h-[18px] w-[18px]" />
              <span className="sr-only">Settings</span>
            </Link>
          </Button>

          {/* Sign out */}
          {user && (
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign out
            </Button>
          )}
        </nav>
      </div>
    </header>
  )
}
