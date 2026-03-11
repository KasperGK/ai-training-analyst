import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import type {
  SessionReport,
  SessionReportRow,
  SessionReportInsert,
} from '@/lib/reports/types'

function rowToReport(row: SessionReportRow): SessionReport {
  return {
    id: row.id,
    athlete_id: row.athlete_id,
    session_id: row.session_id,
    score: row.score,
    headline: row.headline,
    quick_take: row.quick_take,
    deep_analysis: row.deep_analysis,
    tags: row.tags,
    goal_relevance: row.goal_relevance,
    session_context: row.session_context,
    is_read: row.is_read,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function getSessionReports(
  athleteId: string,
  options: {
    limit?: number
    unreadOnly?: boolean
  } = {}
): Promise<SessionReport[]> {
  const supabase = await createClient()
  if (!supabase) return []

  let query = supabase
    .from('session_reports')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false })

  if (options.unreadOnly) {
    query = query.eq('is_read', false)
  }

  if (options.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error || !data) {
    if (error) logger.error('[SessionReports] Error fetching reports:', error)
    return []
  }

  return data.map((row) => rowToReport(row as SessionReportRow))
}

export async function getSessionReport(
  sessionId: string
): Promise<SessionReport | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('session_reports')
    .select('*')
    .eq('session_id', sessionId)
    .single()

  if (error || !data) return null
  return rowToReport(data as SessionReportRow)
}

export async function getSessionReportById(
  reportId: string
): Promise<SessionReport | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('session_reports')
    .select('*')
    .eq('id', reportId)
    .single()

  if (error || !data) return null
  return rowToReport(data as SessionReportRow)
}

export async function createSessionReport(
  report: SessionReportInsert
): Promise<SessionReport | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('session_reports')
    .insert(report)
    .select()
    .single()

  if (error || !data) {
    if (error) logger.error('[SessionReports] Error creating report:', error)
    return null
  }

  return rowToReport(data as SessionReportRow)
}

export async function markReportRead(
  reportId: string,
  athleteId: string
): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('session_reports')
    .update({ is_read: true })
    .eq('id', reportId)
    .eq('athlete_id', athleteId)

  return !error
}

export async function markReportReadBySessionId(
  sessionId: string,
  athleteId: string
): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('session_reports')
    .update({ is_read: true })
    .eq('session_id', sessionId)
    .eq('athlete_id', athleteId)

  return !error
}

export async function getUnreadReportCount(
  athleteId: string
): Promise<number> {
  const supabase = await createClient()
  if (!supabase) return 0

  const { count, error } = await supabase
    .from('session_reports')
    .select('*', { count: 'exact', head: true })
    .eq('athlete_id', athleteId)
    .eq('is_read', false)

  if (error) return 0
  return count ?? 0
}

export async function hasReportForSession(
  sessionId: string
): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { count, error } = await supabase
    .from('session_reports')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)

  if (error) return false
  return (count ?? 0) > 0
}
