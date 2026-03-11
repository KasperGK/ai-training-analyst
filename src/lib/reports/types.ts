/**
 * Types for AI-generated session reports
 */

export interface DeepAnalysis {
  execution: {
    score: number
    summary: string
    pacing_quality: string
    power_management: string
    hr_response: string | null
  }
  training_value: {
    score: number
    summary: string
    physiological_stimulus: string
    progression_context: string
  }
  recovery: {
    score: number
    summary: string
    fatigue_indicators: string
    recovery_recommendation: string
  }
  key_observations: string[]
  areas_for_improvement: string[]
}

export interface GoalRelevance {
  relevant_goals: {
    goal_id: string
    goal_title: string
    relevance: string
    impact: 'positive' | 'neutral' | 'negative'
  }[]
}

export interface SessionContext {
  session_type: string
  training_phase: string | null
  days_since_last_session: number | null
  weekly_tss_before: number | null
  ctl: number | null
  atl: number | null
  tsb: number | null
}

export interface SessionReport {
  id: string
  athlete_id: string
  session_id: string
  score: number
  headline: string
  quick_take: string
  deep_analysis: DeepAnalysis
  tags: string[]
  goal_relevance: GoalRelevance | null
  session_context: SessionContext | null
  is_read: boolean
  created_at: string
  updated_at: string
}

export type SessionReportRow = {
  id: string
  athlete_id: string
  session_id: string
  score: number
  headline: string
  quick_take: string
  deep_analysis: DeepAnalysis
  tags: string[]
  goal_relevance: GoalRelevance | null
  session_context: SessionContext | null
  is_read: boolean
  created_at: string
  updated_at: string
}

export type SessionReportInsert = Omit<SessionReportRow, 'id' | 'created_at' | 'updated_at'>
