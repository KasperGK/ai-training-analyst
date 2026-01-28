/**
 * Long-Term Data Analysis: exploreTrainingData Tool Tests
 *
 * Tests the exploratory data tool that provides raw training data
 * for AI-driven pattern discovery.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the database modules
vi.mock('@/lib/db/sessions', () => ({
  getSessions: vi.fn(),
}))

vi.mock('@/lib/db/fitness', () => ({
  getFitnessHistory: vi.fn(),
}))

vi.mock('@/lib/db/race-results', () => ({
  getRaceResults: vi.fn(),
}))

vi.mock('@/lib/db/workout-outcomes', () => ({
  getWorkoutOutcomes: vi.fn(),
}))

vi.mock('@/lib/personalization/athlete-memory', () => ({
  getMemories: vi.fn(),
}))

import { getSessions } from '@/lib/db/sessions'
import { getFitnessHistory } from '@/lib/db/fitness'
import { getRaceResults } from '@/lib/db/race-results'
import { getWorkoutOutcomes } from '@/lib/db/workout-outcomes'
import { getMemories } from '@/lib/personalization/athlete-memory'
import type { ToolContext } from '@/app/api/chat/tools/types'

// ============================================================
// TEST DATA FIXTURES
// ============================================================

function generateMockSessions(count: number) {
  const sessions = []
  const startDate = new Date()

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
      tss: 80 + Math.random() * 60,
      avg_power: 200 + Math.random() * 50,
      normalized_power: 220 + Math.random() * 50,
      max_power: 400 + Math.random() * 200,
      avg_hr: 140 + Math.random() * 20,
      max_hr: 170 + Math.random() * 15,
      intensity_factor: 0.75 + Math.random() * 0.2,
      source: 'intervals_icu' as const,
    })
  }

  return sessions.sort((a, b) => a.date.localeCompare(b.date))
}

function generateMockFitnessHistory(days: number) {
  const history = []
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  for (let i = 0; i <= days; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)

    history.push({
      athlete_id: 'test-athlete',
      date: date.toISOString().split('T')[0],
      ctl: 50 + i / 2,
      atl: 55 + i / 3,
      tsb: -5 + Math.random() * 10,
      tss_day: 70 + Math.random() * 30,
    })
  }

  return history
}

function createMockToolContext(): ToolContext {
  return {
    athleteId: 'test-athlete',
    athleteContext: JSON.stringify({
      athlete: { ftp: 280, weight_kg: 75, max_hr: 185 },
    }),
    intervalsConnected: true,
    intervalsClient: {} as never,
    flags: {
      useLocalData: true,
      enableRag: false,
      enableMemory: true,
      enableInsights: false,
    },
  }
}

// ============================================================
// TESTS: exploreTrainingData
// ============================================================

describe('exploreTrainingData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRaceResults).mockResolvedValue([])
    vi.mocked(getWorkoutOutcomes).mockResolvedValue([])
    vi.mocked(getMemories).mockResolvedValue([])
  })

  it('returns error when not authenticated', async () => {
    const { exploreTrainingData } = await import('@/app/api/chat/tools/explore-training-data')
    const ctx = createMockToolContext()
    ctx.athleteId = undefined

    const tool = exploreTrainingData(ctx)
    const result = await tool.execute({})

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('not authenticated')
  })

  it('returns error when no sessions found', async () => {
    vi.mocked(getSessions).mockResolvedValue([])
    vi.mocked(getFitnessHistory).mockResolvedValue([])

    const { exploreTrainingData } = await import('@/app/api/chat/tools/explore-training-data')
    const ctx = createMockToolContext()
    const tool = exploreTrainingData(ctx)

    const result = await tool.execute({ period: '90d' })

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('No training data')
  })

  it('returns metadata with aggregates', async () => {
    const mockSessions = generateMockSessions(30)
    const mockFitness = generateMockFitnessHistory(90)

    vi.mocked(getSessions).mockResolvedValue(mockSessions)
    vi.mocked(getFitnessHistory).mockResolvedValue(mockFitness)

    const { exploreTrainingData } = await import('@/app/api/chat/tools/explore-training-data')
    const ctx = createMockToolContext()
    const tool = exploreTrainingData(ctx)

    const result = await tool.execute({ period: '90d' })

    expect(result).toHaveProperty('metadata')
    expect(result).toHaveProperty('aggregates')
    expect(result).toHaveProperty('weeklySummaries')
    expect(result).toHaveProperty('analysisHints')

    const typedResult = result as {
      metadata: {
        period: string
        totalSessions: number
        dataQuality: { sessionsWithPower: number }
      }
    }

    expect(typedResult.metadata.period).toBe('90d')
    expect(typedResult.metadata.totalSessions).toBe(30)
    expect(typedResult.metadata.dataQuality.sessionsWithPower).toBe(30)
  })

  it('includes day-of-week statistics', async () => {
    const mockSessions = generateMockSessions(30)
    vi.mocked(getSessions).mockResolvedValue(mockSessions)
    vi.mocked(getFitnessHistory).mockResolvedValue(generateMockFitnessHistory(90))

    const { exploreTrainingData } = await import('@/app/api/chat/tools/explore-training-data')
    const ctx = createMockToolContext()
    const tool = exploreTrainingData(ctx)

    const result = await tool.execute({ period: '90d' })

    const typedResult = result as {
      aggregates: {
        byDayOfWeek: Record<string, { count: number; avgTSS: number }>
      }
    }

    expect(typedResult.aggregates.byDayOfWeek).toBeDefined()
    // Should have entries for at least some days
    expect(Object.keys(typedResult.aggregates.byDayOfWeek).length).toBeGreaterThan(0)
  })

  it('includes weekly summaries', async () => {
    const mockSessions = generateMockSessions(30)
    vi.mocked(getSessions).mockResolvedValue(mockSessions)
    vi.mocked(getFitnessHistory).mockResolvedValue(generateMockFitnessHistory(90))

    const { exploreTrainingData } = await import('@/app/api/chat/tools/explore-training-data')
    const ctx = createMockToolContext()
    const tool = exploreTrainingData(ctx)

    const result = await tool.execute({ period: '90d' })

    const typedResult = result as {
      weeklySummaries: Array<{
        weekStart: string
        sessions: number
        totalHours: number
        totalTSS: number
      }>
    }

    expect(Array.isArray(typedResult.weeklySummaries)).toBe(true)
    expect(typedResult.weeklySummaries.length).toBeGreaterThan(0)

    // Check weekly summary structure
    const firstWeek = typedResult.weeklySummaries[0]
    expect(firstWeek).toHaveProperty('weekStart')
    expect(firstWeek).toHaveProperty('sessions')
    expect(firstWeek).toHaveProperty('totalHours')
    expect(firstWeek).toHaveProperty('totalTSS')
  })

  it('includes raw sessions when requested', async () => {
    const mockSessions = generateMockSessions(10)
    vi.mocked(getSessions).mockResolvedValue(mockSessions)
    vi.mocked(getFitnessHistory).mockResolvedValue(generateMockFitnessHistory(30))

    const { exploreTrainingData } = await import('@/app/api/chat/tools/explore-training-data')
    const ctx = createMockToolContext()
    const tool = exploreTrainingData(ctx)

    const result = await tool.execute({ period: '30d', includeRaw: true })

    expect(result).toHaveProperty('sessions')
    const typedResult = result as { sessions: Array<{ date: string; dayOfWeek: string }> }
    expect(typedResult.sessions.length).toBe(10)
    expect(typedResult.sessions[0]).toHaveProperty('dayOfWeek')
  })

  it('excludes raw sessions by default', async () => {
    const mockSessions = generateMockSessions(10)
    vi.mocked(getSessions).mockResolvedValue(mockSessions)
    vi.mocked(getFitnessHistory).mockResolvedValue(generateMockFitnessHistory(30))

    const { exploreTrainingData } = await import('@/app/api/chat/tools/explore-training-data')
    const ctx = createMockToolContext()
    const tool = exploreTrainingData(ctx)

    const result = await tool.execute({ period: '30d', includeRaw: false })

    expect(result).not.toHaveProperty('sessions')
  })

  it('includes race data when focus is racing', async () => {
    const mockSessions = generateMockSessions(20)
    const mockRaces = [
      {
        race_date: '2024-01-15',
        race_name: 'Test Race',
        category: 'Cat 3',
        placement: 5,
        total_in_category: 30,
        avg_power: 280,
        tsb_at_race: 5,
        ctl_at_race: 65,
      },
    ]

    vi.mocked(getSessions).mockResolvedValue(mockSessions)
    vi.mocked(getFitnessHistory).mockResolvedValue(generateMockFitnessHistory(90))
    vi.mocked(getRaceResults).mockResolvedValue(mockRaces)

    const { exploreTrainingData } = await import('@/app/api/chat/tools/explore-training-data')
    const ctx = createMockToolContext()
    const tool = exploreTrainingData(ctx)

    const result = await tool.execute({ period: '90d', focus: 'racing' })

    expect(result).toHaveProperty('races')
    const typedResult = result as { races: Array<{ name: string; percentile: number }> }
    expect(typedResult.races.length).toBe(1)
    expect(typedResult.races[0].name).toBe('Test Race')
    // Percentile = (1 - 5/30) * 100 = 83.33...
    expect(typedResult.races[0].percentile).toBe(83)
  })

  it('includes investigation hints when question provided', async () => {
    const mockSessions = generateMockSessions(20)
    vi.mocked(getSessions).mockResolvedValue(mockSessions)
    vi.mocked(getFitnessHistory).mockResolvedValue(generateMockFitnessHistory(60))

    const { exploreTrainingData } = await import('@/app/api/chat/tools/explore-training-data')
    const ctx = createMockToolContext()
    const tool = exploreTrainingData(ctx)

    const result = await tool.execute({
      period: '60d',
      question: 'Do I perform better after rest days?',
    })

    expect(result).toHaveProperty('investigationQuestion')
    expect(result).toHaveProperty('investigationHint')

    const typedResult = result as { investigationQuestion: string }
    expect(typedResult.investigationQuestion).toContain('rest days')
  })

  it('calculates days since last hard session', async () => {
    // Create sessions with varying intensity
    const mockSessions = [
      {
        id: '1',
        athlete_id: 'test',
        date: '2024-01-01',
        duration_seconds: 3600,
        sport: 'cycling' as const,
        workout_type: 'Recovery',
        tss: 40,
        intensity_factor: 0.65,
        avg_power: 150,
        normalized_power: 160,
        avg_hr: 120,
        max_hr: 140,
        source: 'intervals_icu' as const,
      },
      {
        id: '2',
        athlete_id: 'test',
        date: '2024-01-02',
        duration_seconds: 3600,
        sport: 'cycling' as const,
        workout_type: 'Intervals',
        tss: 120,
        intensity_factor: 0.92, // Hard session
        avg_power: 250,
        normalized_power: 270,
        avg_hr: 160,
        max_hr: 180,
        source: 'intervals_icu' as const,
      },
      {
        id: '3',
        athlete_id: 'test',
        date: '2024-01-04',
        duration_seconds: 3600,
        sport: 'cycling' as const,
        workout_type: 'Endurance',
        tss: 60,
        intensity_factor: 0.70,
        avg_power: 180,
        normalized_power: 190,
        avg_hr: 130,
        max_hr: 150,
        source: 'intervals_icu' as const,
      },
    ]

    vi.mocked(getSessions).mockResolvedValue(mockSessions)
    vi.mocked(getFitnessHistory).mockResolvedValue([])

    const { exploreTrainingData } = await import('@/app/api/chat/tools/explore-training-data')
    const ctx = createMockToolContext()
    const tool = exploreTrainingData(ctx)

    const result = await tool.execute({ period: '30d', includeRaw: true })

    const typedResult = result as { sessions: Array<{ date: string; daysSinceLastHard: number | null }> }

    // Third session (Jan 4) should be 2 days after the hard session (Jan 2)
    const thirdSession = typedResult.sessions.find(s => s.date === '2024-01-04')
    expect(thirdSession?.daysSinceLastHard).toBe(2)
  })

  it('handles all time periods correctly', async () => {
    const mockSessions = generateMockSessions(100)
    vi.mocked(getSessions).mockResolvedValue(mockSessions)
    vi.mocked(getFitnessHistory).mockResolvedValue(generateMockFitnessHistory(365))

    const { exploreTrainingData } = await import('@/app/api/chat/tools/explore-training-data')
    const ctx = createMockToolContext()
    const tool = exploreTrainingData(ctx)

    const periods = ['30d', '60d', '90d', '180d', '365d'] as const

    for (const period of periods) {
      const result = await tool.execute({ period })
      const typedResult = result as { metadata: { period: string } }
      expect(typedResult.metadata.period).toBe(period)
    }
  })

  it('includes workout type breakdown', async () => {
    const mockSessions = generateMockSessions(20)
    vi.mocked(getSessions).mockResolvedValue(mockSessions)
    vi.mocked(getFitnessHistory).mockResolvedValue(generateMockFitnessHistory(60))

    const { exploreTrainingData } = await import('@/app/api/chat/tools/explore-training-data')
    const ctx = createMockToolContext()
    const tool = exploreTrainingData(ctx)

    const result = await tool.execute({ period: '60d' })

    const typedResult = result as {
      aggregates: {
        workoutTypeBreakdown: Record<string, number>
      }
    }

    expect(typedResult.aggregates.workoutTypeBreakdown).toBeDefined()
    // Should have entries for the workout types in mock data
    expect(Object.keys(typedResult.aggregates.workoutTypeBreakdown).length).toBeGreaterThan(0)
  })
})
