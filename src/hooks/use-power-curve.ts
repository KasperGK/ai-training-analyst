'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PowerCurveResponse, RiderProfile, PowerCurvePoint } from '@/app/api/power-curve/route'

interface UsePowerCurveReturn {
  powerCurve: PowerCurvePoint[]
  riderProfile: RiderProfile | null
  weightKg: number | null
  ftp: number | null
  loading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export function usePowerCurve(): UsePowerCurveReturn {
  const [powerCurve, setPowerCurve] = useState<PowerCurvePoint[]>([])
  const [riderProfile, setRiderProfile] = useState<RiderProfile | null>(null)
  const [weightKg, setWeightKg] = useState<number | null>(null)
  const [ftp, setFtp] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/power-curve')
      if (!res.ok) throw new Error('Failed to fetch power curve data')

      const data: PowerCurveResponse = await res.json()

      setPowerCurve(data.powerCurve)
      setRiderProfile(data.riderProfile)
      setWeightKg(data.weightKg)
      setFtp(data.ftp)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    powerCurve,
    riderProfile,
    weightKg,
    ftp,
    loading,
    error,
    refresh: fetchData,
  }
}
