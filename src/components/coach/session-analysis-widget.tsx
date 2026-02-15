'use client'

/**
 * Session Analysis Widget
 *
 * Analysis of a training session with unified stat strip.
 * Data arrives via widget.params (no fetching needed).
 *
 * Header: Session type badge, name, date, duration
 * Stat strip: TSS/IF/NP/Avg/EF in one unified row + inline comparison
 * Zones/Pacing/Intervals: Rendered directly (no collapsible)
 * Peak Powers: Collapsible table with PB% and comparison columns
 */

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PowerZones {
  z1: number
  z2: number
  z3: number
  z4: number
  z5: number
  z6: number
}

interface PeakPowers {
  peak_5s: number | null
  peak_30s: number | null
  peak_1min: number | null
  peak_5min: number | null
  peak_20min: number | null
}

interface PacingData {
  firstHalfAvgPower: number | null
  secondHalfAvgPower: number | null
  negativeSplit: boolean
  splitDifferencePercent: number | null
  variabilityIndex: number | null
  matchBurns: number
}

interface SessionData {
  id: string
  date: string
  name: string | null
  type: string | null
  duration_seconds: number | null
  tss: number | null
  intensity_factor: number | null
  normalized_power: number | null
  avg_power: number | null
  max_power: number | null
  avg_hr: number | null
  max_hr: number | null
  power_zones: PowerZones | null
  avg_cadence?: number
  elevation_gain?: number
  decoupling?: number
  calories?: number
  peakPowers?: PeakPowers
  pacing?: PacingData
  intervalSummary?: string[] | null
}

interface AnalysisData {
  isHighIntensity: boolean
  isPolarized: boolean
  efficiencyFactor: number | null
  decoupling?: string | null
  isLikelyRace: boolean
  sessionType: 'race' | 'workout' | 'endurance' | 'recovery' | 'unknown'
  pacingAssessment?: string
}

interface ComparisonData {
  similarSessionCount: number
  avgTSS: number | null
  avgIF: number | null
  avgNP: number | null
  avgDuration: number | null
  peakPowerComparison?: Record<string, { thisSession: number; average: number; percentDiff: number }>
}

export interface SessionAnalysisData {
  session: SessionData
  analysis: AnalysisData
  comparison?: ComparisonData
  personalBests?: Record<string, number>
}

const ZONE_COLORS = [
  'bg-blue-400',    // Z1 - Recovery
  'bg-green-400',   // Z2 - Endurance
  'bg-yellow-400',  // Z3 - Tempo
  'bg-orange-400',  // Z4 - Threshold
  'bg-red-400',     // Z5 - VO2max
  'bg-purple-400',  // Z6 - Anaerobic
]

const ZONE_LABELS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6']


function formatDuration(seconds: number | null): string {
  if (!seconds) return '--'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function ZoneBar({ zones }: { zones: PowerZones }) {
  const zoneValues = [zones.z1, zones.z2, zones.z3, zones.z4, zones.z5, zones.z6]
  const total = zoneValues.reduce((a, b) => a + b, 0)
  if (total === 0) return <p className="text-xs text-muted-foreground">No zone data</p>

  return (
    <div className="space-y-1.5">
      {/* Stacked horizontal bar */}
      <div className="flex h-5 rounded-md overflow-hidden">
        {zoneValues.map((val, i) => {
          if (val === 0) return null
          return (
            <div
              key={i}
              className={cn(ZONE_COLORS[i], 'transition-all')}
              style={{ width: `${(val / total) * 100}%` }}
              title={`${ZONE_LABELS[i]}: ${val}%`}
            />
          )
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {zoneValues.map((val, i) => (
          val > 0 && (
            <div key={i} className="flex items-center gap-1 text-xs">
              <div className={cn('w-2 h-2 rounded-sm', ZONE_COLORS[i])} />
              <span className="text-muted-foreground">{ZONE_LABELS[i]}</span>
              <span className="font-medium tabular-nums">{val}%</span>
            </div>
          )
        ))}
      </div>
    </div>
  )
}

function PeakPowerTable({
  peakPowers,
  personalBests,
  comparison,
}: {
  peakPowers: PeakPowers
  personalBests?: Record<string, number>
  comparison?: ComparisonData
}) {
  const rows = [
    { label: '5s', key: 'peak_5s' as const, pbKey: '5s', duration: '5 sec' },
    { label: '30s', key: 'peak_30s' as const, pbKey: '30s', duration: '30 sec' },
    { label: '1min', key: 'peak_1min' as const, pbKey: '1min', duration: '1 min' },
    { label: '5min', key: 'peak_5min' as const, pbKey: '5min', duration: '5 min' },
    { label: '20min', key: 'peak_20min' as const, pbKey: '20min', duration: '20 min' },
  ]

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[80px]">Duration</TableHead>
          <TableHead className="text-right">Power</TableHead>
          {personalBests && <TableHead className="text-right">% of PB</TableHead>}
          {comparison?.peakPowerComparison && <TableHead className="text-right">vs Avg</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ label, key, pbKey, duration }) => {
          const watts = peakPowers[key]
          if (watts == null) return null
          const pb = personalBests?.[pbKey]
          const pbPercent = pb ? Math.round((watts / pb) * 100) : null
          const comp = comparison?.peakPowerComparison?.[pbKey]

          return (
            <TableRow key={key}>
              <TableCell className="font-medium">{duration}</TableCell>
              <TableCell className="text-right tabular-nums">{watts}W</TableCell>
              {personalBests && (
                <TableCell className="text-right">
                  {pbPercent != null ? (
                    <span className={cn(
                      'tabular-nums',
                      pbPercent >= 95 ? 'text-green-600 font-semibold' :
                      pbPercent >= 85 ? 'text-foreground' :
                      'text-muted-foreground'
                    )}>
                      {pbPercent}%
                    </span>
                  ) : '--'}
                </TableCell>
              )}
              {comparison?.peakPowerComparison && (
                <TableCell className="text-right">
                  {comp ? (
                    <span className={cn(
                      'tabular-nums text-xs',
                      comp.percentDiff > 0 ? 'text-green-600' : comp.percentDiff < 0 ? 'text-red-600' : 'text-muted-foreground'
                    )}>
                      {comp.percentDiff > 0 ? '+' : ''}{Math.round(comp.percentDiff)}%
                    </span>
                  ) : '--'}
                </TableCell>
              )}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function TierHeader({
  title,
  open,
  onClick,
}: {
  title: string
  open: boolean
  onClick: () => void
}) {
  return (
    <CollapsibleTrigger
      onClick={onClick}
      className="flex items-center gap-2 w-full py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
    >
      {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      {title}
    </CollapsibleTrigger>
  )
}

export function SessionAnalysisWidget({ data }: { data: SessionAnalysisData }) {
  const { session, analysis, comparison, personalBests } = data
  const [tier3Open, setTier3Open] = useState(false)

  const hasTier3Data = !!session.peakPowers

  return (
    <div className="space-y-4">
      {/* Tier 1: Always visible - Key metrics */}
      <div className="space-y-3">
        {/* Header: Session type + date + duration */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className="capitalize"
          >
            {analysis.sessionType}
          </Badge>
          {session.name && (
            <span className="text-sm font-medium truncate">{session.name}</span>
          )}
          <span className="text-xs text-muted-foreground ml-auto shrink-0">
            {formatDate(session.date)} &middot; {formatDuration(session.duration_seconds)}
          </span>
        </div>

        {/* Unified stat strip */}
        <div className="rounded-lg border bg-muted/30 px-1 py-3">
          <div className="flex flex-wrap items-start divide-x divide-border">
            {session.tss != null && (
              <div className="flex-1 min-w-[4.5rem] px-3 text-center">
                <p className="text-lg font-bold tabular-nums tracking-tight">{Math.round(session.tss)}</p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">TSS</p>
              </div>
            )}
            {session.intensity_factor != null && (
              <div className="flex-1 min-w-[4.5rem] px-3 text-center">
                <p className="text-lg font-bold tabular-nums tracking-tight">{session.intensity_factor.toFixed(2)}</p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">IF</p>
              </div>
            )}
            {session.normalized_power != null && (
              <div className="flex-1 min-w-[4.5rem] px-3 text-center">
                <p className="text-lg font-bold tabular-nums tracking-tight">
                  {session.normalized_power}<span className="text-sm font-normal text-muted-foreground">w</span>
                </p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">NP</p>
              </div>
            )}
            {session.avg_power != null && (
              <div className="flex-1 min-w-[4.5rem] px-3 text-center">
                <p className="text-lg font-bold tabular-nums tracking-tight">
                  {session.avg_power}<span className="text-sm font-normal text-muted-foreground">w</span>
                </p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Avg</p>
              </div>
            )}
            {analysis.efficiencyFactor != null && (
              <div className="flex-1 min-w-[4.5rem] px-3 text-center">
                <p className="text-lg font-bold tabular-nums tracking-tight">{analysis.efficiencyFactor}</p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">EF</p>
              </div>
            )}
          </div>
        </div>

        {/* Decoupling (if exists, shown below stat strip) */}
        {analysis.decoupling && (
          <p className="text-xs text-muted-foreground">
            Decoupling: <span className="font-medium text-foreground">{analysis.decoupling}</span>
          </p>
        )}

        {/* Comparison summary (compact inline) */}
        {comparison && (
          <p className="text-xs text-muted-foreground">
            vs {comparison.similarSessionCount} similar
            {comparison.avgNP != null && session.normalized_power != null && (
              <span className={cn(
                'font-medium ml-1',
                session.normalized_power >= comparison.avgNP ? 'text-green-600' : 'text-red-600'
              )}>
                · NP {session.normalized_power > comparison.avgNP ? '+' : ''}{Math.round(session.normalized_power - comparison.avgNP)}W
              </span>
            )}
            {comparison.avgTSS != null && session.tss != null && Math.abs(session.tss - comparison.avgTSS) >= 5 && (
              <span className={cn(
                'font-medium ml-1',
                session.tss <= comparison.avgTSS ? 'text-green-600' : 'text-orange-600'
              )}>
                · TSS {session.tss > comparison.avgTSS ? '+' : ''}{Math.round(session.tss - comparison.avgTSS)}
              </span>
            )}
          </p>
        )}
      </div>

      {/* Zones, Pacing & Intervals (rendered directly, no collapsible) */}
      {session.power_zones && (
        <div>
          <p className="text-xs font-medium mb-2">Power Zone Distribution</p>
          <ZoneBar zones={session.power_zones} />
        </div>
      )}

      {session.pacing && (
        <div className="space-y-2">
          <p className="text-xs font-medium">Pacing</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {session.pacing.firstHalfAvgPower != null && session.pacing.secondHalfAvgPower != null && (
              <>
                <div className="rounded-md bg-muted/40 p-2">
                  <span className="text-muted-foreground">1st Half</span>
                  <p className="font-semibold tabular-nums">{session.pacing.firstHalfAvgPower}W</p>
                </div>
                <div className="rounded-md bg-muted/40 p-2">
                  <span className="text-muted-foreground">2nd Half</span>
                  <p className="font-semibold tabular-nums">{session.pacing.secondHalfAvgPower}W</p>
                </div>
              </>
            )}
            {session.pacing.splitDifferencePercent != null && (
              <div className="rounded-md bg-muted/40 p-2">
                <span className="text-muted-foreground">Split</span>
                <p className={cn(
                  'font-semibold tabular-nums flex items-center gap-1',
                  session.pacing.negativeSplit ? 'text-green-600' : session.pacing.splitDifferencePercent < -5 ? 'text-red-600' : ''
                )}>
                  {session.pacing.negativeSplit ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : session.pacing.splitDifferencePercent < -5 ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : (
                    <Minus className="h-3 w-3" />
                  )}
                  {session.pacing.splitDifferencePercent > 0 ? '+' : ''}{session.pacing.splitDifferencePercent.toFixed(1)}%
                </p>
              </div>
            )}
            {session.pacing.variabilityIndex != null && (
              <div className="rounded-md bg-muted/40 p-2">
                <span className="text-muted-foreground">VI</span>
                <p className="font-semibold tabular-nums">{session.pacing.variabilityIndex.toFixed(2)}</p>
              </div>
            )}
            {session.pacing.matchBurns > 0 && (
              <div className="rounded-md bg-muted/40 p-2">
                <span className="text-muted-foreground">Match Burns</span>
                <p className="font-semibold tabular-nums">{session.pacing.matchBurns}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {session.intervalSummary && session.intervalSummary.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-1">Intervals</p>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {session.intervalSummary.map((interval, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-muted-foreground/60 shrink-0">{i + 1}.</span>
                {interval}
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.pacingAssessment && (
        <p className="text-xs text-muted-foreground italic">{analysis.pacingAssessment}</p>
      )}

      {/* Tier 3: Peak powers + Comparison (collapsed by default) */}
      {hasTier3Data && (
        <Collapsible open={tier3Open} onOpenChange={setTier3Open}>
          <TierHeader title="Peak Powers" open={tier3Open} onClick={() => setTier3Open(!tier3Open)} />
          <CollapsibleContent className="pt-1">
            {session.peakPowers && (
              <PeakPowerTable
                peakPowers={session.peakPowers}
                personalBests={personalBests}
                comparison={comparison}
              />
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}
