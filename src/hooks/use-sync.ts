'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface SyncStatus {
  connected: boolean
  lastSyncAt: string | null
  lastActivityDate: string | null
  status: 'idle' | 'syncing' | 'error'
  errorMessage: string | null
  activitiesSynced: number
  wellnessSynced: number
  needsSync: boolean
}

interface SyncResult {
  success: boolean
  activitiesSynced: number
  wellnessSynced: number
  errors: string[]
}

interface UseSyncOptions {
  /** Auto-sync on mount if needed (default: true) */
  autoSync?: boolean
  /** Only sync if user is authenticated */
  requireAuth?: boolean
}

export function useSync(options: UseSyncOptions = {}) {
  const { autoSync = true, requireAuth = true } = options

  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [lastResult, setLastResult] = useState<SyncResult | null>(null)
  const hasAutoSynced = useRef(false)

  // Fetch current sync status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/sync')
      if (res.ok) {
        const data = await res.json()
        setStatus({
          connected: data.connected,
          lastSyncAt: data.syncLog?.lastSyncAt ?? null,
          lastActivityDate: data.syncLog?.lastActivityDate ?? null,
          status: data.syncLog?.status ?? 'idle',
          errorMessage: data.syncLog?.errorMessage ?? null,
          activitiesSynced: data.syncLog?.activitiesSynced ?? 0,
          wellnessSynced: data.syncLog?.wellnessSynced ?? 0,
          needsSync: data.needsSync,
        })
        return data
      }
    } catch (error) {
      console.error('Failed to fetch sync status:', error)
    }
    return null
  }, [])

  // Trigger sync
  const sync = useCallback(async (force = false): Promise<SyncResult | null> => {
    setSyncing(true)
    setLastResult(null)

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })

      if (res.ok) {
        const data = await res.json()
        const result: SyncResult = {
          success: data.success,
          activitiesSynced: data.activitiesSynced,
          wellnessSynced: data.wellnessSynced,
          errors: data.errors || [],
        }
        setLastResult(result)

        // Refresh status after sync
        await fetchStatus()

        // Auto-generate insights after successful sync with new data
        if (result.success && (result.activitiesSynced > 0 || result.wellnessSynced > 0)) {
          try {
            console.log('[Sync] Generating insights from synced data...')
            await fetch('/api/insights/generate', { method: 'POST' })
          } catch (err) {
            console.warn('[Sync] Failed to generate insights:', err)
          }
        }

        return result
      } else if (res.status === 401) {
        // Not authenticated - skip silently
        return null
      } else {
        const error = await res.json()
        console.error('Sync failed:', error)
        return null
      }
    } catch (error) {
      console.error('Sync error:', error)
      return null
    } finally {
      setSyncing(false)
    }
  }, [fetchStatus])

  // Initial status fetch
  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Auto-sync on mount if needed
  useEffect(() => {
    if (!autoSync || hasAutoSynced.current) return

    const doAutoSync = async () => {
      const statusData = await fetchStatus()

      // Only auto-sync if:
      // 1. Connected to intervals.icu
      // 2. Sync is needed (>15 min since last sync)
      // 3. Not currently syncing
      if (statusData?.connected && statusData?.needsSync && statusData?.syncLog?.status !== 'syncing') {
        hasAutoSynced.current = true
        console.log('[Sync] Auto-syncing data from intervals.icu...')
        const result = await sync(false)
        if (result?.success) {
          console.log(`[Sync] Synced ${result.activitiesSynced} activities, ${result.wellnessSynced} fitness records`)
        }
      }
    }

    doAutoSync()
  }, [autoSync, fetchStatus, sync])

  return {
    status,
    syncing,
    lastResult,
    sync,
    fetchStatus,
  }
}
