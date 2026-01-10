'use client'

import { Card } from '@/components/ui/card'

interface ZoneData {
  zone: string
  seconds: number
  minutes: number
}

interface ZoneBarChartProps {
  title: string
  data: ZoneData[]
  colorScheme?: 'power' | 'hr'
}

const powerColors: Record<string, string> = {
  Z1: 'bg-gray-400',
  Z2: 'bg-blue-400',
  Z3: 'bg-green-400',
  Z4: 'bg-yellow-400',
  Z5: 'bg-orange-400',
  Z6: 'bg-red-500',
  Z7: 'bg-red-700',
  SS: 'bg-amber-500', // Sweet Spot
}

const hrColors: Record<string, string> = {
  Z1: 'bg-gray-400',
  Z2: 'bg-blue-400',
  Z3: 'bg-green-400',
  Z4: 'bg-yellow-400',
  Z5: 'bg-orange-500',
  Z6: 'bg-red-500',
  Z7: 'bg-red-700',
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

export function ZoneBarChart({ title, data, colorScheme = 'power' }: ZoneBarChartProps) {
  const colors = colorScheme === 'power' ? powerColors : hrColors
  const totalSeconds = data.reduce((sum, d) => sum + d.seconds, 0)

  // Filter out zones with 0 time
  const activeZones = data.filter(d => d.seconds > 0)

  if (activeZones.length === 0) {
    return (
      <Card className="p-4">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</span>
        <p className="text-sm text-muted-foreground mt-4">No zone data available</p>
      </Card>
    )
  }

  return (
    <Card className="p-4">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</span>
      <div className="mt-4 space-y-3">
        {/* Stacked bar */}
        <div className="h-8 flex rounded-md overflow-hidden">
          {activeZones.map((zone) => {
            const percentage = (zone.seconds / totalSeconds) * 100
            return (
              <div
                key={zone.zone}
                className={`${colors[zone.zone] || 'bg-gray-300'} transition-all`}
                style={{ width: `${percentage}%` }}
                title={`${zone.zone}: ${formatDuration(zone.seconds)}`}
              />
            )
          })}
        </div>

        {/* Legend with times */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          {data.map((zone) => (
            <div key={zone.zone} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-sm ${colors[zone.zone] || 'bg-gray-300'}`} />
              <span className="text-muted-foreground">{zone.zone}</span>
              <span className="font-semibold tabular-nums">{zone.minutes}m</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
