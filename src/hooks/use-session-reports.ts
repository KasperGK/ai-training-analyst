'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { SessionReport } from '@/lib/reports/types'

interface UseSessionReportsResult {
  reports: Map<string, SessionReport>
  loading: boolean
  unreadCount: number
  markRead: (sessionId: string) => void
}

export function useSessionReports(sessionIds: string[]): UseSessionReportsResult {
  const [reports, setReports] = useState<Map<string, SessionReport>>(new Map())
  const [loading, setLoading] = useState(false)
  const generationTriggered = useRef(false)
  const pollCountRef = useRef(0)

  // Stabilize the dependency — only re-fetch when the actual IDs change
  const idsKey = useMemo(() => sessionIds.join(','), [sessionIds])

  useEffect(() => {
    if (!idsKey) return
    generationTriggered.current = false
    pollCountRef.current = 0

    setLoading(true)
    fetch(`/api/session-reports?session_ids=${idsKey}`)
      .then(res => res.json())
      .then(data => {
        const map = new Map<string, SessionReport>()
        for (const report of data.reports || []) {
          map.set(report.session_id, report)
        }
        setReports(map)
      })
      .catch(() => {
        // Silently fail — reports are non-critical
      })
      .finally(() => setLoading(false))
  }, [idsKey])

  // Check for missing reports and trigger generation if needed
  const pendingIds = useMemo(() => {
    if (loading || !idsKey) return []
    return sessionIds.filter(id => !reports.has(id))
  }, [sessionIds, reports, loading, idsKey])

  const pendingIdsKey = useMemo(() => pendingIds.join(','), [pendingIds])

  useEffect(() => {
    if (!pendingIdsKey) return

    // Trigger report generation for sessions missing reports (once per load)
    if (!generationTriggered.current) {
      generationTriggered.current = true
      fetch('/api/session-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 7 }),
      }).catch(() => {})
    }

    // Poll for the reports to appear
    const maxPolls = 20
    const interval = setInterval(() => {
      pollCountRef.current++
      if (pollCountRef.current > maxPolls) {
        clearInterval(interval)
        return
      }

      fetch(`/api/session-reports?session_ids=${pendingIdsKey}`)
        .then(res => res.json())
        .then(data => {
          const newReports = data.reports || []
          if (newReports.length > 0) {
            setReports(prev => {
              const next = new Map(prev)
              for (const report of newReports) {
                next.set(report.session_id, report)
              }
              return next
            })
          }
        })
        .catch(() => {})
    }, 3000)

    return () => clearInterval(interval)
  }, [pendingIdsKey])

  const unreadCount = Array.from(reports.values()).filter(r => !r.is_read).length

  const markRead = useCallback((sessionId: string) => {
    const report = reports.get(sessionId)
    if (!report || report.is_read) return

    // Optimistic update
    setReports(prev => {
      const next = new Map(prev)
      next.set(sessionId, { ...report, is_read: true })
      return next
    })

    // Fire-and-forget PATCH
    fetch(`/api/session-reports/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read: true }),
    }).catch(() => {
      // Revert on failure
      setReports(prev => {
        const next = new Map(prev)
        next.set(sessionId, report)
        return next
      })
    })
  }, [reports])

  return { reports, loading, unreadCount, markRead }
}
