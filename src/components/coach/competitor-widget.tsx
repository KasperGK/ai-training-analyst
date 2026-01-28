'use client'

/**
 * Competitor Widget
 *
 * Displays competitor analysis including:
 * - Frequent opponents with head-to-head records
 * - Power comparisons
 * - Category comparison
 */

import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Users,
  Trophy,
  Zap,
  TrendingUp,
  TrendingDown,
  Target,
  Swords,
} from 'lucide-react'

export interface CompetitorData {
  frequentOpponents: Array<{
    name: string
    racesTogether: number
    winsAgainst: number
    lossesAgainst: number
    winRate: number | null
    avgPowerGap: number | null
    avgPositionGap: number | null
  }>
  headToHead?: {
    totalOpponents: number
    overallWinRate: number | null
    toughestRivals: Array<{
      name: string
      record: string
      avgPowerGap: number | null
    }>
    dominatedOpponents: Array<{
      name: string
      record: string
    }>
  }
  categoryComparison?: Array<{
    category: string
    races: number
    yourAvgPower: number | null
    categoryAvgPower: number | null
    powerDifference: number | null
    yourAvgWkg: number | null
    categoryAvgWkg: number | null
    wkgDifference: number | null
  }>
  nearFinishers?: {
    avgPowerGapToNextPlace: number | null
    avgTimeGapToNextPlace: number | null
    racesAnalyzed: number
    insight: string
  }
}

interface CompetitorWidgetProps {
  data: CompetitorData
}

function WinRateBar({ winRate }: { winRate: number | null }) {
  if (winRate === null) return <span className="text-muted-foreground">-</span>

  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <Progress
        value={winRate}
        className="h-2 flex-1"
      />
      <span className="text-xs font-mono w-8">{winRate}%</span>
    </div>
  )
}

function PowerGapIndicator({ gap }: { gap: number | null }) {
  if (gap === null) return <span className="text-muted-foreground">-</span>

  const isAhead = gap > 0
  return (
    <div className={`flex items-center gap-1 text-sm font-mono ${isAhead ? 'text-green-500' : 'text-red-500'}`}>
      {isAhead ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {gap > 0 ? '+' : ''}{gap}W
    </div>
  )
}

export function CompetitorWidget({ data }: CompetitorWidgetProps) {
  const { frequentOpponents, headToHead, categoryComparison, nearFinishers } = data

  if (frequentOpponents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-center">
        <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">No competitor data available</p>
        <p className="text-xs text-muted-foreground mt-1">
          Race more events to identify your frequent opponents
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Head-to-Head Summary */}
      {headToHead && (
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{headToHead.totalOpponents}</span>
            </div>
            <div className="text-xs text-muted-foreground">Frequent Opponents</div>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <span className="text-2xl font-bold">
                {headToHead.overallWinRate !== null ? `${headToHead.overallWinRate}%` : '-'}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">Win Rate</div>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">
                {nearFinishers?.avgPowerGapToNextPlace ?? '-'}W
              </span>
            </div>
            <div className="text-xs text-muted-foreground">Gap to Next Place</div>
          </div>
        </div>
      )}

      {/* Near Finishers Insight */}
      {nearFinishers?.insight && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
          <Zap className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300">{nearFinishers.insight}</p>
        </div>
      )}

      {/* Frequent Opponents Table */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Swords className="h-4 w-4" />
          Frequent Opponents
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium">Rider</th>
                <th className="text-center py-2 font-medium">Races</th>
                <th className="text-center py-2 font-medium">Record</th>
                <th className="text-center py-2 font-medium">Win Rate</th>
                <th className="text-right py-2 font-medium">Power Gap</th>
              </tr>
            </thead>
            <tbody>
              {frequentOpponents.slice(0, 7).map((opponent, idx) => (
                <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2">
                    <div className="font-medium truncate max-w-[150px]">{opponent.name}</div>
                  </td>
                  <td className="text-center py-2">{opponent.racesTogether}</td>
                  <td className="text-center py-2">
                    <span className="text-green-500">{opponent.winsAgainst}</span>
                    <span className="text-muted-foreground">-</span>
                    <span className="text-red-500">{opponent.lossesAgainst}</span>
                  </td>
                  <td className="text-center py-2">
                    <WinRateBar winRate={opponent.winRate} />
                  </td>
                  <td className="text-right py-2">
                    <PowerGapIndicator gap={opponent.avgPowerGap ? -opponent.avgPowerGap : null} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toughest Rivals & Dominated */}
      {headToHead && (headToHead.toughestRivals.length > 0 || headToHead.dominatedOpponents.length > 0) && (
        <div className="grid grid-cols-2 gap-4">
          {headToHead.toughestRivals.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-medium text-muted-foreground uppercase">
                Toughest Rivals
              </h5>
              <div className="space-y-1">
                {headToHead.toughestRivals.map((rival, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-950/30 rounded"
                  >
                    <span className="text-sm truncate max-w-[100px]">{rival.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{rival.record}</span>
                      {rival.avgPowerGap !== null && (
                        <span className="text-xs font-mono text-red-500">
                          {rival.avgPowerGap > 0 ? '+' : ''}{rival.avgPowerGap}W
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {headToHead.dominatedOpponents.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-medium text-muted-foreground uppercase">
                You Dominate
              </h5>
              <div className="space-y-1">
                {headToHead.dominatedOpponents.map((opp, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950/30 rounded"
                  >
                    <span className="text-sm truncate max-w-[100px]">{opp.name}</span>
                    <span className="text-xs text-green-600 dark:text-green-400">{opp.record}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Category Comparison */}
      {categoryComparison && categoryComparison.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Category Comparison</h4>
          <div className="space-y-2">
            {categoryComparison.map((cat, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{cat.category}</Badge>
                  <span className="text-xs text-muted-foreground">{cat.races} races</span>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  {cat.powerDifference !== null && (
                    <div className="text-right">
                      <div className={`font-mono ${cat.powerDifference >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {cat.powerDifference > 0 ? '+' : ''}{cat.powerDifference}W
                      </div>
                      <div className="text-xs text-muted-foreground">vs category avg</div>
                    </div>
                  )}
                  {cat.wkgDifference !== null && (
                    <div className="text-right">
                      <div className={`font-mono ${cat.wkgDifference >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {cat.wkgDifference > 0 ? '+' : ''}{cat.wkgDifference.toFixed(2)} W/kg
                      </div>
                      <div className="text-xs text-muted-foreground">vs category avg</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
