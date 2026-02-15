import { cn } from '@/lib/utils'
import { Trophy } from 'lucide-react'

const priorityStyles: Record<string, { bg: string; text: string }> = {
  A: { bg: 'bg-amber-100 dark:bg-amber-900/50', text: 'text-amber-700 dark:text-amber-300' },
  B: { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-700 dark:text-blue-300' },
  C: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400' },
}

interface EventMarkerProps {
  name: string
  priority: string
}

export function EventMarker({ name, priority }: EventMarkerProps) {
  const styles = priorityStyles[priority] || priorityStyles.C

  return (
    <div className={cn(
      'w-full px-2.5 py-1.5 rounded-md text-sm leading-tight truncate flex items-center gap-1.5',
      styles.bg, styles.text,
    )}>
      <Trophy className="size-3.5 shrink-0" />
      <span className="truncate font-semibold">{name}</span>
    </div>
  )
}
