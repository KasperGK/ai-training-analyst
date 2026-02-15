import { cn } from '@/lib/utils'
import type { Session } from '@/types'

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h${m > 0 ? `${m}m` : ''}`
  return `${m}m`
}

function getDisplayName(session: Session): string {
  // Use workout_type if it looks like a name (has spaces or is long enough)
  if (session.workout_type && (session.workout_type.includes(' ') || session.workout_type.length > 12)) {
    // Truncate long Zwift names etc
    const name = session.workout_type
    return name.length > 24 ? name.slice(0, 22) + '...' : name
  }
  // Fallback to sport type
  return session.sport === 'cycling' ? 'Ride' : session.sport.charAt(0).toUpperCase() + session.sport.slice(1)
}

interface SessionPillProps {
  session: Session
  onClick?: () => void
}

export function SessionPill({ session, onClick }: SessionPillProps) {
  const label = getDisplayName(session)
  const detail = session.tss ? `${Math.round(session.tss)} TSS` : formatDuration(session.duration_seconds)

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-2.5 py-1.5 rounded-md text-sm leading-tight',
        'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
        onClick && 'hover:bg-sky-100 dark:hover:bg-sky-950/60 cursor-pointer',
      )}
    >
      <span className="flex items-center gap-1.5 min-w-0">
        <span className="truncate font-medium">{label}</span>
        <span className="shrink-0 text-xs text-sky-600/70 dark:text-sky-400/70">{detail}</span>
      </span>
    </button>
  )
}
