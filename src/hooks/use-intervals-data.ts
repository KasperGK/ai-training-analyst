'use client'

import { useState, useEffect } from 'react'
import type { CurrentFitness, Session } from '@/types'

interface IntervalsData {
  connected: boolean
  loading: boolean
  error: string | null
  athlete: {
    id: string
    name: string
    ftp: number
    max_hr: number
    lthr: number
    weight_kg: number
  } | null
  currentFitness: CurrentFitness | null
  sessions: Session[]
  pmcData: { date: string; ctl: number; atl: number; tsb: number }[]
  ctlTrend: number
}

export function useIntervalsData() {
  const [data, setData] = useState<IntervalsData>({
    connected: false,
    loading: true,
    error: null,
    athlete: null,
    currentFitness: null,
    sessions: [],
    pmcData: [],
    ctlTrend: 0,
  })

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/intervals/data')
        const json = await response.json()

        if (!response.ok) {
          setData(prev => ({
            ...prev,
            loading: false,
            connected: json.connected ?? false,
            error: json.error,
          }))
          return
        }

        setData({
          connected: true,
          loading: false,
          error: null,
          athlete: json.athlete,
          currentFitness: json.currentFitness,
          sessions: json.sessions,
          pmcData: json.pmcData,
          ctlTrend: json.ctlTrend,
        })
      } catch (error) {
        setData(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to fetch data',
        }))
      }
    }

    fetchData()
  }, [])

  const connect = () => {
    window.location.href = '/api/auth/intervals/connect'
  }

  return { ...data, connect }
}
