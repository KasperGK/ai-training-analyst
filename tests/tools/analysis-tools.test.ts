/**
 * Long-Term Data Analysis: Tool Integration Tests
 *
 * Tests the actual tool implementations with mocked data sources.
 * Verifies correct data flow, error handling, and output structure.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the database modules
vi.mock('@/lib/db/sessions', () => ({
  getSessions: vi.fn(),
}))

vi.mock('@/lib/db/fitness', () => ({
  getFitnessHistory: vi.fn(),
}))

vi.mock('@/lib/intervals-icu', () => ({
  getDateRange: vi.fn((days: number) => ({
    oldest: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    newest: new Date().toISOString().split('T')[0],
  })),
  formatDateForApi: vi.fn((date: Date) => date.toISOString().split('T')[0]),
  getNormalizedPower: vi.fn((activity: { icu_weighted_avg_watts?: number }) => activity.icu_weighted_avg_watts),
}))

vi.mock('@/lib/transforms', () => ({
  getNormalizedPower: vi.fn((activity: { icu_weighted_avg_watts?: number }) => activity.icu_weighted_avg_watts),
}))

import { getSessions } from '@/lib/db/sessions'
import { getFitnessHistory } from '@/lib/db/fitness'
import type { ToolContext } from '@/app/api/chat/tools/types'

// ============================================================
// TEST DATA FIXTURES
// ============================================================

function generateMockSessions(count: number, options?: {
  startDate?: Date
  withPower?: boolean
  withHR?: boolean
  avgTSS?: number
  avgIF?: number
}) {
  const startDate = options?.startDate || new Date()
  const sessions = []

  for (let i = 0; i < count; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() - i)

    sessions.push({
      id: `session-${i}`,
      athlete_id: 'test-athlete',
      date: date.toISOString().split('T')[0],
      duration_seconds: 3600 + Math.random() * 3600,
      sport: 'cycling',
      workout_type: ['Endurance', 'Intervals', 'Tempo', 'Recovery'][i % 4],
      tss: options?.avgTSS ? options.avgTSS + (Math.random() - 0.5) * 40 : 80 + Math.random() * 60,
      avg_power: options?.withPower !== false ? 200 + Math.random() * 50 : undefined,
      normalized_power: options?.withPower !== false ? 220 + Math.random() * 50 : undefined,
      max_power: options?.withPower !== false ? 400 + Math.random() * 200 : undefined,
      avg_hr: options?.withHR !== false ? 140 + Math.random() * 20 : undefined,
      max_hr: options?.withHR !== false ? 170 + Math.random() * 15 : undefined,
      intensity_factor: options?.avgIF ? options.avgIF + (Math.random() - 0.5) * 0.2 : 0.75 + Math.random() * 0.2,
      source: 'intervals_icu' as const,
    })
  }

  return sessions.sort((a, b) => a.date.localeCompare(b.date))
}

function generateMockFitnessHistory(days: number, options?: {
  startCTL?: number
  endCTL?: number
}) {
  const startCTL = options?.startCTL || 50
  const endCTL = options?.endCTL || 65
  const ctlStep = (endCTL - startCTL) / days

  const history = []
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  for (let i = 0; i <= days; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)

    const ctl = startCTL + ctlStep * i
    const atl = ctl + (Math.random() - 0.5) * 20
    const tss = 50 + Math.random() * 100

    history.push({
      athlete_id: 'test-athlete',
      date: date.toISOString().split('T')[0],
      ctl: Math.round(ctl),
      atl: Math.round(atl),
      tsb: Math.round(ctl - atl),
      tss_day: Math.round(tss),
    })
  }

  return history
}

// ============================================================
// TOOL CONTEXT HELPER
// ============================================================

function createMockToolContext(options?: {
  useLocalData?: boolean
  intervalsConnected?: boolean
  athleteId?: string
}): ToolContext {
  return {
    athleteId: options?.athleteId || 'test-athlete',
    athleteContext: JSON.stringify({
      athlete: { ftp: 280, weight_kg: 75, max_hr: 185 },
    }),
    intervalsConnected: options?.intervalsConnected ?? true,
    intervalsClient: {
      getActivities: vi.fn().mockResolvedValue([]),
      getWellness: vi.fn().mockResolvedValue([]),
      getPowerCurves: vi.fn().mockResolvedValue([]),
    } as never,
    flags: {
      useLocalData: options?.useLocalData ?? true,
      enableRag: false,
      enableMemory: false,
      enableInsights: false,
    },
  }
}

// ============================================================
// TESTS: analyzeTrainingLoad
// ============================================================

describe('analyzeTrainingLoad', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calculates ACWR from local fitness data', async () => {
    const mockFitness = generateMockFitnessHistory(42, { startCTL: 50, endCTL: 70 })
    const mockSessions = generateMockSessions(30)

    vi.mocked(getFitnessHistory).mockResolvedValue(mockFitness)
    vi.mocked(getSessions).mockResolvedValue(mockSessions)

    // Import the tool factory and create a tool instance with context
    const { analyzeTrainingLoad } = await import('@/app/api/chat/tools/analysis-tools')
    const ctx = createMockToolContext()
    const tool = analyzeTrainingLoad(ctx)

    const result = await tool.execute({ includeWeeklyBreakdown: true })

    // Should not return error
    expect(result).not.toHaveProperty('error')

    // Should have required fields
    expect(result).toHaveProperty('currentFitness')
    expect(result).toHaveProperty('acwr')
    expect(result).toHaveProperty('monotony')
    expect(result).toHaveProperty('strain')

    // ACWR should be within valid range (0-3 typically)
    const typedResult = result as { acwr: { value: number } }
    expect(typedResult.acwr.value).toBeGreaterThanOrEqual(0)
    expect(typedResult.acwr.value).toBeLessThanOrEqual(3)
  })

  it('returns error with insufficient data', async () => {
    vi.mocked(getFitnessHistory).mockResolvedValue([])
    vi.mocked(getSessions).mockResolvedValue([])

    const { analyzeTrainingLoad } = await import('@/app/api/chat/tools/analysis-tools')
    const ctx = createMockToolContext({ intervalsConnected: false })
    const tool = analyzeTrainingLoad(ctx)

    const result = await tool.execute({})

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('Insufficient data')
  })

  it('fills missing dates with zero TSS', async () => {
    // Create fitness history with gaps
    const mockFitness = [
      { athlete_id: 'test', date: '2024-01-01', ctl: 50, atl: 55, tsb: -5, tss_day: 100 },
      { athlete_id: 'test', date: '2024-01-03', ctl: 52, atl: 52, tsb: 0, tss_day: 80 },
      // Gap on 2024-01-02
    ]

    // Generate enough data points
    for (let i = 4; i <= 42; i++) {
      mockFitness.push({
        athlete_id: 'test',
        date: `2024-01-${String(i).padStart(2, '0')}`,
        ctl: 50 + i / 2,
        atl: 55 + i / 3,
        tsb: -5,
        tss_day: 70 + Math.random() * 30,
      })
    }

    vi.mocked(getFitnessHistory).mockResolvedValue(mockFitness)
    vi.mocked(getSessions).mockResolvedValue(generateMockSessions(30))

    const { analyzeTrainingLoad } = await import('@/app/api/chat/tools/analysis-tools')
    const ctx = createMockToolContext()
    const tool = analyzeTrainingLoad(ctx)

    const result = await tool.execute({ includeWeeklyBreakdown: true })

    // Should succeed - gaps are filled
    expect(result).not.toHaveProperty('error')
  })

  it('includes weekly breakdown when requested', async () => {
    vi.mocked(getFitnessHistory).mockResolvedValue(generateMockFitnessHistory(42))
    vi.mocked(getSessions).mockResolvedValue(generateMockSessions(30))

    const { analyzeTrainingLoad } = await import('@/app/api/chat/tools/analysis-tools')
    const ctx = createMockToolContext()
    const tool = analyzeTrainingLoad(ctx)

    const result = await tool.execute({ includeWeeklyBreakdown: true })

    expect(result).toHaveProperty('weeklyBreakdown')
    const typedResult = result as { weeklyBreakdown: Array<{ week: string; totalTSS: number }> }
    expect(Array.isArray(typedResult.weeklyBreakdown)).toBe(true)
    expect(typedResult.weeklyBreakdown.length).toBeGreaterThan(0)
  })

  it('assesses TSB status correctly', async () => {
    // Create fitness data with specific TSB
    const mockFitness = generateMockFitnessHistory(42)
    // Force specific CTL/ATL values in the latest entry
    mockFitness[mockFitness.length - 1] = {
      ...mockFitness[mockFitness.length - 1],
      ctl: 70,
      atl: 85,
      tsb: -15, // Fatigued but building
    }

    vi.mocked(getFitnessHistory).mockResolvedValue(mockFitness)
    vi.mocked(getSessions).mockResolvedValue(generateMockSessions(30))

    const { analyzeTrainingLoad } = await import('@/app/api/chat/tools/analysis-tools')
    const ctx = createMockToolContext()
    const tool = analyzeTrainingLoad(ctx)

    const result = await tool.execute({})

    const typedResult = result as { currentFitness: { tsb: number; tsbStatus: string } }
    expect(typedResult.currentFitness.tsb).toBe(-15)
    expect(typedResult.currentFitness.tsbStatus).toContain('Fatigued')
  })
})

// ============================================================
// TESTS: analyzeEfficiency
// ============================================================

describe('analyzeEfficiency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calculates EF for sessions with power and HR', async () => {
    const mockSessions = generateMockSessions(20, { withPower: true, withHR: true })

    vi.mocked(getSessions).mockResolvedValue(mockSessions)

    const { analyzeEfficiency } = await import('@/app/api/chat/tools/analysis-tools')
    const ctx = createMockToolContext()
    const tool = analyzeEfficiency(ctx)

    const result = await tool.execute({ days: 90 })

    expect(result).not.toHaveProperty('error')
    expect(result).toHaveProperty('summary')

    const typedResult = result as { summary: { averageEF: number; trend: string } }
    expect(typedResult.summary.averageEF).toBeGreaterThan(0)
    expect(['improving', 'stable', 'declining']).toContain(typedResult.summary.trend)
  })

  it('returns error with insufficient sessions', async () => {
    // Only 3 sessions - need at least 5
    const mockSessions = generateMockSessions(3)

    vi.mocked(getSessions).mockResolvedValue(mockSessions)

    const { analyzeEfficiency } = await import('@/app/api/chat/tools/analysis-tools')
    const ctx = createMockToolContext({ intervalsConnected: false })
    const tool = analyzeEfficiency(ctx)

    const result = await tool.execute({ days: 90 })

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('Insufficient data')
  })

  it('returns error when sessions lack power/HR data', async () => {
    const mockSessions = generateMockSessions(20, { withPower: false, withHR: false })

    vi.mocked(getSessions).mockResolvedValue(mockSessions)

    const { analyzeEfficiency } = await import('@/app/api/chat/tools/analysis-tools')
    const ctx = createMockToolContext({ intervalsConnected: false })
    const tool = analyzeEfficiency(ctx)

    const result = await tool.execute({ days: 90 })

    // Should return error because no sessions have both NP and HR
    expect(result).toHaveProperty('error')
  })

  it('includes weekly progression data', async () => {
    const mockSessions = generateMockSessions(30, { withPower: true, withHR: true })

    vi.mocked(getSessions).mockResolvedValue(mockSessions)

    const { analyzeEfficiency } = await import('@/app/api/chat/tools/analysis-tools')
    const ctx = createMockToolContext()
    const tool = analyzeEfficiency(ctx)

    const result = await tool.execute({ days: 90 })

    expect(result).toHaveProperty('weeklyProgression')
    const typedResult = result as { weeklyProgression: Array<{ week: string; avgEF: number }> }
    expect(Array.isArray(typedResult.weeklyProgression)).toBe(true)
  })

  it('interprets EF levels correctly', async () => {
    const mockSessions = generateMockSessions(20, { withPower: true, withHR: true })

    vi.mocked(getSessions).mockResolvedValue(mockSessions)

    const { analyzeEfficiency } = await import('@/app/api/chat/tools/analysis-tools')
    const ctx = createMockToolContext()
    const tool = analyzeEfficiency(ctx)

    const result = await tool.execute({ days: 90 })

    const typedResult = result as { interpretation: { currentLevel: string } }
    expect(['excellent', 'good', 'developing', 'needs work']).toContain(typedResult.interpretation.currentLevel)
  })
})

// ============================================================
// TESTS: queryHistoricalTrends
// ============================================================

describe('queryHistoricalTrends', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calculates session statistics correctly', async () => {
    const mockSessions = generateMockSessions(20, { avgTSS: 100 })

    vi.mocked(getSessions).mockResolvedValue(mockSessions)
    vi.mocked(getFitnessHistory).mockResolvedValue([])

    const { queryHistoricalTrends } = await import('@/app/api/chat/tools/query-historical-trends')
    const ctx = createMockToolContext()
    const tool = queryHistoricalTrends(ctx)

    const result = await tool.execute({ metric: 'tss', period: 'month' })

    expect(result).toHaveProperty('sessionCount')
    expect(result).toHaveProperty('totalTSS')
    expect(result).toHaveProperty('avgTSSPerSession')
    expect(result).toHaveProperty('sessionsPerWeek')

    const typedResult = result as { sessionCount: number; totalTSS: number; avgTSSPerSession: number }
    expect(typedResult.sessionCount).toBe(20)
    expect(typedResult.avgTSSPerSession).toBeGreaterThan(0)
  })

  it('calculates intensity distribution', async () => {
    // Create sessions with known IF distribution
    const mockSessions = [
      ...Array(5).fill(null).map((_, i) => ({
        id: `low-${i}`,
        athlete_id: 'test',
        date: '2024-01-01',
        duration_seconds: 3600,
        sport: 'cycling' as const,
        intensity_factor: 0.65,
        tss: 60,
        source: 'intervals_icu' as const,
      })),
      ...Array(3).fill(null).map((_, i) => ({
        id: `med-${i}`,
        athlete_id: 'test',
        date: '2024-01-02',
        duration_seconds: 3600,
        sport: 'cycling' as const,
        intensity_factor: 0.82,
        tss: 80,
        source: 'intervals_icu' as const,
      })),
      ...Array(2).fill(null).map((_, i) => ({
        id: `high-${i}`,
        athlete_id: 'test',
        date: '2024-01-03',
        duration_seconds: 3600,
        sport: 'cycling' as const,
        intensity_factor: 0.95,
        tss: 120,
        source: 'intervals_icu' as const,
      })),
    ]

    vi.mocked(getSessions).mockResolvedValue(mockSessions)
    vi.mocked(getFitnessHistory).mockResolvedValue([])

    const { queryHistoricalTrends } = await import('@/app/api/chat/tools/query-historical-trends')
    const ctx = createMockToolContext()
    const tool = queryHistoricalTrends(ctx)

    const result = await tool.execute({ metric: 'intensity', period: 'month' })

    expect(result).toHaveProperty('intensityDistribution')

    const typedResult = result as { intensityDistribution: { low: number; medium: number; high: number } }
    expect(typedResult.intensityDistribution.low).toBe(50) // 5/10
    expect(typedResult.intensityDistribution.medium).toBe(30) // 3/10
    expect(typedResult.intensityDistribution.high).toBe(20) // 2/10
    expect(
      typedResult.intensityDistribution.low +
      typedResult.intensityDistribution.medium +
      typedResult.intensityDistribution.high
    ).toBe(100)
  })

  it('includes fitness data when requested', async () => {
    const mockSessions = generateMockSessions(20)
    const mockFitness = generateMockFitnessHistory(30, { startCTL: 50, endCTL: 65 })

    vi.mocked(getSessions).mockResolvedValue(mockSessions)
    vi.mocked(getFitnessHistory).mockResolvedValue(mockFitness)

    const { queryHistoricalTrends } = await import('@/app/api/chat/tools/query-historical-trends')
    const ctx = createMockToolContext()
    const tool = queryHistoricalTrends(ctx)

    const result = await tool.execute({ metric: 'fitness', period: 'month' })

    expect(result).toHaveProperty('fitnessData')

    const typedResult = result as { fitnessData: { startCTL: number; endCTL: number; ctlChange: number } }
    expect(typedResult.fitnessData.startCTL).toBe(50)
    expect(typedResult.fitnessData.endCTL).toBe(65)
    expect(typedResult.fitnessData.ctlChange).toBe(15)
  })

  it('handles different time periods', async () => {
    vi.mocked(getSessions).mockResolvedValue(generateMockSessions(100))
    vi.mocked(getFitnessHistory).mockResolvedValue([])

    const { queryHistoricalTrends } = await import('@/app/api/chat/tools/query-historical-trends')
    const ctx = createMockToolContext()
    const tool = queryHistoricalTrends(ctx)

    const periods = ['week', 'month', '3months', '6months', 'year'] as const

    for (const period of periods) {
      const result = await tool.execute({ metric: 'tss', period })
      expect(result).toHaveProperty('period', period)
    }
  })

  it('returns error when empty and intervals not connected', async () => {
    vi.mocked(getSessions).mockResolvedValue([])
    vi.mocked(getFitnessHistory).mockResolvedValue([])

    const { queryHistoricalTrends } = await import('@/app/api/chat/tools/query-historical-trends')
    const ctx = createMockToolContext({ intervalsConnected: false })
    const tool = queryHistoricalTrends(ctx)

    const result = await tool.execute({ metric: 'tss', period: 'month' })

    expect(result).toHaveProperty('error')
  })
})

// ============================================================
// TESTS: Data Source Selection
// ============================================================

describe('Data Source Selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses local data when feature flag enabled and data available', async () => {
    const mockSessions = generateMockSessions(20)
    vi.mocked(getSessions).mockResolvedValue(mockSessions)
    vi.mocked(getFitnessHistory).mockResolvedValue(generateMockFitnessHistory(42))

    const { analyzeTrainingLoad } = await import('@/app/api/chat/tools/analysis-tools')
    const ctx = createMockToolContext({ useLocalData: true })
    const tool = analyzeTrainingLoad(ctx)

    const result = await tool.execute({})

    expect(result).toHaveProperty('dataSource', 'local')
    expect(getSessions).toHaveBeenCalled()
  })

  it('falls back to intervals.icu when local data insufficient', async () => {
    vi.mocked(getSessions).mockResolvedValue([])
    vi.mocked(getFitnessHistory).mockResolvedValue([])

    const { analyzeTrainingLoad } = await import('@/app/api/chat/tools/analysis-tools')
    const ctx = createMockToolContext({ useLocalData: true, intervalsConnected: true })

    // Mock intervals.icu to return data
    ctx.intervalsClient = {
      getWellness: vi.fn().mockResolvedValue(
        Array(42).fill(null).map((_, i) => ({
          ctl: 50 + i,
          atl: 55 + i * 0.5,
        }))
      ),
      getActivities: vi.fn().mockResolvedValue(
        Array(30).fill(null).map((_, i) => ({
          start_date_local: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
          icu_training_load: 80,
          moving_time: 3600,
          type: 'Ride',
        }))
      ),
    } as never

    const tool = analyzeTrainingLoad(ctx)
    const result = await tool.execute({})

    expect(result).toHaveProperty('dataSource', 'intervals_icu')
  })
})

// ============================================================
// TESTS: Edge Cases
// ============================================================

describe('Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles sessions with null TSS', async () => {
    const mockSessions = generateMockSessions(20)
    // Set some TSS values to null
    mockSessions[0].tss = undefined
    mockSessions[1].tss = undefined

    vi.mocked(getSessions).mockResolvedValue(mockSessions)
    vi.mocked(getFitnessHistory).mockResolvedValue(generateMockFitnessHistory(42))

    const { analyzeTrainingLoad } = await import('@/app/api/chat/tools/analysis-tools')
    const ctx = createMockToolContext()
    const tool = analyzeTrainingLoad(ctx)

    const result = await tool.execute({})

    // Should handle nulls gracefully
    expect(result).not.toHaveProperty('error')
  })

  it('handles sessions with null IF for intensity distribution', async () => {
    const mockSessions = generateMockSessions(10)
    // Set all IF to null
    mockSessions.forEach(s => { s.intensity_factor = undefined })

    vi.mocked(getSessions).mockResolvedValue(mockSessions)
    vi.mocked(getFitnessHistory).mockResolvedValue([])

    const { queryHistoricalTrends } = await import('@/app/api/chat/tools/query-historical-trends')
    const ctx = createMockToolContext()
    const tool = queryHistoricalTrends(ctx)

    const result = await tool.execute({ metric: 'intensity', period: 'month' })

    // Should handle gracefully - all sessions will be counted as low intensity (IF < 0.75 when IF is 0 or undefined)
    expect(result).not.toHaveProperty('error')
  })

  it('handles very large TSS values', async () => {
    const mockFitness = generateMockFitnessHistory(42)
    // Add some extreme values
    mockFitness[mockFitness.length - 1].tss_day = 500 // Very hard day

    vi.mocked(getFitnessHistory).mockResolvedValue(mockFitness)
    vi.mocked(getSessions).mockResolvedValue(generateMockSessions(20))

    const { analyzeTrainingLoad } = await import('@/app/api/chat/tools/analysis-tools')
    const ctx = createMockToolContext()
    const tool = analyzeTrainingLoad(ctx)

    const result = await tool.execute({})

    expect(result).not.toHaveProperty('error')
  })
})
