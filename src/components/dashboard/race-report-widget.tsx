'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Trophy } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { DragHandle } from '@/components/ui/drag-handle'
import { SessionScoreGauge } from '@/components/dashboard/session-score-gauge'
import type { SessionReport } from '@/lib/reports/types'
import { logger } from '@/lib/logger'

function SectionHeader({
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
      className="flex items-center gap-2 w-full py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
    >
      {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      {title}
    </CollapsibleTrigger>
  )
}

function DeepAnalysisSections({ report }: { report: SessionReport }) {
  const { deep_analysis, goal_relevance } = report
  const [executionOpen, setExecutionOpen] = useState(false)
  const [metricsOpen, setMetricsOpen] = useState(false)
  const [trainingValueOpen, setTrainingValueOpen] = useState(false)
  const [goalOpen, setGoalOpen] = useState(false)
  const [improvementOpen, setImprovementOpen] = useState(false)
  const [recoveryOpen, setRecoveryOpen] = useState(false)

  return (
    <div className="space-y-1 pt-2 border-t">
      {/* Execution Summary */}
      <Collapsible open={executionOpen} onOpenChange={setExecutionOpen}>
        <SectionHeader title="Execution" open={executionOpen} onClick={() => setExecutionOpen(!executionOpen)} />
        <CollapsibleContent>
          <div className="pb-3 space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">Score: {deep_analysis.execution.score}</span>
            </div>
            <p>{deep_analysis.execution.summary}</p>
            {deep_analysis.execution.pacing_quality && (
              <p><span className="font-medium text-foreground">Pacing:</span> {deep_analysis.execution.pacing_quality}</p>
            )}
            {deep_analysis.execution.power_management && (
              <p><span className="font-medium text-foreground">Power:</span> {deep_analysis.execution.power_management}</p>
            )}
            {deep_analysis.execution.hr_response && (
              <p><span className="font-medium text-foreground">HR Response:</span> {deep_analysis.execution.hr_response}</p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Key Observations */}
      {deep_analysis.key_observations.length > 0 && (
        <Collapsible open={metricsOpen} onOpenChange={setMetricsOpen}>
          <SectionHeader title="Key Observations" open={metricsOpen} onClick={() => setMetricsOpen(!metricsOpen)} />
          <CollapsibleContent>
            <ul className="pb-3 space-y-1">
              {deep_analysis.key_observations.map((obs, i) => (
                <li key={i} className="text-xs text-muted-foreground pl-3 relative before:content-['·'] before:absolute before:left-0">
                  {obs}
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Training Value / Comparison */}
      <Collapsible open={trainingValueOpen} onOpenChange={setTrainingValueOpen}>
        <SectionHeader title="Training Value" open={trainingValueOpen} onClick={() => setTrainingValueOpen(!trainingValueOpen)} />
        <CollapsibleContent>
          <div className="pb-3 space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">Score: {deep_analysis.training_value.score}</span>
            </div>
            <p>{deep_analysis.training_value.summary}</p>
            {deep_analysis.training_value.physiological_stimulus && (
              <p><span className="font-medium text-foreground">Stimulus:</span> {deep_analysis.training_value.physiological_stimulus}</p>
            )}
            {deep_analysis.training_value.progression_context && (
              <p><span className="font-medium text-foreground">Progression:</span> {deep_analysis.training_value.progression_context}</p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Goal Impact */}
      {goal_relevance && goal_relevance.relevant_goals.length > 0 && (
        <Collapsible open={goalOpen} onOpenChange={setGoalOpen}>
          <SectionHeader title="Goal Impact" open={goalOpen} onClick={() => setGoalOpen(!goalOpen)} />
          <CollapsibleContent>
            <div className="pb-3 space-y-2">
              {goal_relevance.relevant_goals.map((g) => (
                <div key={g.goal_id} className="text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-foreground">{g.goal_title}</span>
                    <Badge
                      variant="outline"
                      className={
                        g.impact === 'positive' ? 'text-green-600 border-green-600/30' :
                        g.impact === 'negative' ? 'text-red-600 border-red-600/30' :
                        ''
                      }
                    >
                      {g.impact}
                    </Badge>
                  </div>
                  <p className="mt-0.5">{g.relevance}</p>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Areas for Improvement / Recommendation */}
      {deep_analysis.areas_for_improvement.length > 0 && (
        <Collapsible open={improvementOpen} onOpenChange={setImprovementOpen}>
          <SectionHeader title="Recommendations" open={improvementOpen} onClick={() => setImprovementOpen(!improvementOpen)} />
          <CollapsibleContent>
            <ul className="pb-3 space-y-1">
              {deep_analysis.areas_for_improvement.map((area, i) => (
                <li key={i} className="text-xs text-muted-foreground pl-3 relative before:content-['·'] before:absolute before:left-0">
                  {area}
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Recovery */}
      <Collapsible open={recoveryOpen} onOpenChange={setRecoveryOpen}>
        <SectionHeader title="Recovery" open={recoveryOpen} onClick={() => setRecoveryOpen(!recoveryOpen)} />
        <CollapsibleContent>
          <div className="pb-3 space-y-2 text-xs text-muted-foreground">
            <p>{deep_analysis.recovery.summary}</p>
            <p><span className="font-medium text-foreground">Recommendation:</span> {deep_analysis.recovery.recovery_recommendation}</p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

export function RaceReportWidget() {
  const [report, setReport] = useState<SessionReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/session-reports?limit=20')
      .then(res => res.json())
      .then(data => {
        const reports = (data.reports || []) as SessionReport[]
        // Find the latest race report by session_context or tags
        const raceReport = reports.find(
          r =>
            r.session_context?.session_type === 'race' ||
            r.tags.some(t => t.toLowerCase().includes('race'))
        )
        setReport(raceReport || null)
      })
      .catch(err => {
        logger.error('[RaceReport] Failed to fetch reports:', err)
        setError(true)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Card className="group h-full flex flex-col relative">
        <DragHandle />
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Race Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-24 items-center justify-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !report) {
    return (
      <Card className="group h-full flex flex-col relative">
        <DragHandle />
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Race Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">No race reports yet</p>
              <p className="text-xs text-muted-foreground">
                Race reports appear after your next race
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="group h-full flex flex-col overflow-hidden relative">
      <DragHandle />
      <CardHeader className="flex-shrink-0 pb-3">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-4 w-4" />
          Race Report
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto min-h-0 space-y-3">
        {/* Score gauge + headline */}
        <div className="flex items-start gap-3">
          <SessionScoreGauge score={report.score} size="md" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold leading-tight">{report.headline}</h3>
            {report.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-1">
                {report.tags.slice(0, 3).map(tag => (
                  <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick take - always visible */}
        <p className="text-xs text-muted-foreground leading-relaxed">{report.quick_take}</p>

        {/* Expandable deep analysis sections */}
        <DeepAnalysisSections report={report} />
      </CardContent>
    </Card>
  )
}
