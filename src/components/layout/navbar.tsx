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
    <header className="border-b bg-background px-6 py-4 shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo className="h-8 w-8" />
          <h1 className="text-xl font-semibold tracking-tight">Conundrum.</h1>
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
              <LayoutGrid className="h-5 w-5" />
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
              <Brain className="h-5 w-5" />
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
              <CalendarCheck className="h-5 w-5" />
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
              <User className="h-5 w-5" />
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
              <BookOpen className="h-5 w-5" />
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
              <Settings className="h-5 w-5" />
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
