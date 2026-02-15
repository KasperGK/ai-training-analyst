'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Zap, TrendingUp, TrendingDown, HelpCircle } from 'lucide-react'
import type { RiderProfile } from '@/app/api/power-curve/route'

interface RiderProfileCardProps {
  profile: RiderProfile | null
  weightKg: number | null
  ftp: number | null
}

const PROFILE_DESCRIPTIONS: Record<RiderProfile['type'], string> = {
  sprinter: 'You excel at short, explosive efforts. Your neuromuscular power is your biggest asset.',
  pursuiter: 'You have strong anaerobic capacity. Great for attacks and short climbs.',
  climber: 'You excel at sustained high-intensity efforts. Ideal for long climbs and breakaways.',
  'TT specialist': 'You have exceptional threshold power. Perfect for time trials and steady-state efforts.',
  'all-rounder': 'You have a balanced power profile. Versatile across different race scenarios.',
}

const PROFILE_BADGES: Record<RiderProfile['type'], { variant: 'default' | 'secondary' | 'outline'; icon: string }> = {
  sprinter: { variant: 'default', icon: '⚡' },
  pursuiter: { variant: 'default', icon: '🔥' },
  climber: { variant: 'default', icon: '⛰️' },
  'TT specialist': { variant: 'default', icon: '🚴' },
  'all-rounder': { variant: 'secondary', icon: '🎯' },
}

export function RiderProfileCard({
  profile,
  weightKg,
  ftp,
}: RiderProfileCardProps) {
  if (!profile) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Rider Profile
          </CardTitle>
          <CardDescription>
            Your strengths and areas for improvement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Not enough data to determine your rider profile. Complete more rides with power data.
          </div>
        </CardContent>
      </Card>
    )
  }

  const badgeConfig = PROFILE_BADGES[profile.type]
  const description = PROFILE_DESCRIPTIONS[profile.type]

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Rider Profile
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[250px]">
                <p className="text-sm">
                  Based on your power outputs at different durations compared to
                  typical benchmarks for trained cyclists.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rider Type Badge */}
        <div className="flex items-center gap-2">
          <Badge variant={badgeConfig.variant} className="text-sm px-3 py-1">
            {badgeConfig.icon} {profile.type.charAt(0).toUpperCase() + profile.type.slice(1)}
          </Badge>
          {weightKg && ftp && (
            <span className="text-xs text-muted-foreground">
              {(ftp / weightKg).toFixed(2)} W/kg FTP
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground">{description}</p>

        {/* Strengths */}
        {profile.strengths.length > 0 && (
          <div>
            <div className="flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400 mb-1">
              <TrendingUp className="h-3 w-3" />
              Strengths
            </div>
            <ul className="text-sm text-muted-foreground space-y-0.5">
              {profile.strengths.map((strength) => (
                <li key={strength} className="flex items-center gap-1">
                  <span className="text-green-500">+</span> {strength}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Limiters */}
        {profile.limiters.length > 0 && (
          <div>
            <div className="flex items-center gap-1 text-sm font-medium text-orange-600 dark:text-orange-400 mb-1">
              <TrendingDown className="h-3 w-3" />
              Areas to Improve
            </div>
            <ul className="text-sm text-muted-foreground space-y-0.5">
              {profile.limiters.map((limiter) => (
                <li key={limiter} className="flex items-center gap-1">
                  <span className="text-orange-500">-</span> {limiter}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* All-rounder message */}
        {profile.strengths.length === 0 && profile.limiters.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Your power profile is well-balanced with no standout strengths or weaknesses.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
