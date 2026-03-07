import { z } from 'zod'
import type { intervalsClient } from '@/lib/intervals-icu'
import { getAthleteMetrics } from '@/lib/intervals-icu'
import { logger } from '@/lib/logger'

// Type of the intervals.icu client singleton
type IntervalsClient = typeof intervalsClient

/**
 * Shared context passed to all AI tools
 */
export interface ToolContext {
  /** Athlete ID from Supabase auth */
  athleteId: string | undefined
  /** Raw athlete context JSON string from frontend */
  athleteContext: string | undefined
  /** Whether intervals.icu is connected */
  intervalsConnected: boolean
  /** Intervals.icu API client (only use if intervalsConnected is true) */
  intervalsClient: IntervalsClient
  /** Whether ZwiftPower is connected */
  zwiftPowerConnected?: boolean
  /** Feature flags */
  flags: {
    useLocalData: boolean
    enableRag: boolean
    enableMemory: boolean
    enableInsights: boolean
  }
}

/**
 * Tool definition type matching AI SDK's tool structure
 */
export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  description: string
  inputSchema: z.ZodType<TInput>
  execute: (input: TInput) => Promise<TOutput>
}

/**
 * Factory function type for creating tools with context
 */
export type ToolFactory<TInput = unknown, TOutput = unknown> = (
  ctx: ToolContext
) => ToolDefinition<TInput, TOutput>

/**
 * Helper to create a tool factory
 */
export function defineTool<TInput, TOutput>(
  definition: {
    description: string
    inputSchema: z.ZodType<TInput>
    execute: (input: TInput, ctx: ToolContext) => Promise<TOutput>
  }
): ToolFactory<TInput, TOutput> {
  return (ctx: ToolContext) => ({
    description: definition.description,
    inputSchema: definition.inputSchema,
    execute: (input: TInput) => definition.execute(input, ctx),
  })
}

/**
 * Zod schema for athlete context validation
 */
const athleteContextSchema = z.object({
  athlete: z.object({
    ftp: z.number().optional(),
    max_hr: z.number().optional(),
    lthr: z.number().optional(),
    weight_kg: z.number().optional(),
    resting_hr: z.number().optional(),
    name: z.string().optional(),
  }).optional(),
  currentFitness: z.object({
    ctl: z.number().optional(),
    atl: z.number().optional(),
    tsb: z.number().optional(),
  }).optional(),
}).passthrough() // Allow additional properties

export type AthleteContext = z.infer<typeof athleteContextSchema>

/**
 * Parse athlete context from JSON string safely with Zod validation
 */
export function parseAthleteContext(athleteContext: string | undefined): AthleteContext {
  if (!athleteContext) return {}
  try {
    const parsed = JSON.parse(athleteContext)
    // Use safeParse to validate without throwing
    const result = athleteContextSchema.safeParse(parsed)
    return result.success ? result.data : {}
  } catch {
    return {}
  }
}

export interface AthleteProfile {
  ftp: number | null
  weight_kg: number | null
  source: 'context' | 'intervals_icu' | 'none'
  warnings: string[]
}

/**
 * Resolve athlete FTP and weight from context or intervals.icu.
 * Never falls back to hardcoded defaults — returns null with warnings instead.
 */
export async function resolveAthleteProfile(ctx: ToolContext): Promise<AthleteProfile> {
  const parsed = parseAthleteContext(ctx.athleteContext)
  const warnings: string[] = []

  let ftp: number | null = parsed.athlete?.ftp ?? null
  let weight_kg: number | null = parsed.athlete?.weight_kg ?? null
  let source: AthleteProfile['source'] = (ftp || weight_kg) ? 'context' : 'none'

  // If either value is missing, try intervals.icu
  if ((!ftp || !weight_kg) && ctx.intervalsConnected) {
    try {
      const athlete = await ctx.intervalsClient.getAthlete()
      const metrics = getAthleteMetrics(athlete)

      if (!ftp && metrics.ftp) {
        ftp = metrics.ftp
        source = 'intervals_icu'
      }
      if (!weight_kg && metrics.weight) {
        weight_kg = metrics.weight
        source = source === 'context' ? 'context' : 'intervals_icu'
      }
    } catch (error) {
      logger.error('[resolveAthleteProfile] Failed to fetch from intervals.icu:', error)
    }
  }

  if (!ftp) {
    warnings.push('FTP is not set in your profile. Please update your FTP in intervals.icu or your profile settings for accurate training recommendations.')
  }
  if (!weight_kg) {
    warnings.push('Weight is not set in your profile. Please update your weight in intervals.icu or your profile settings for accurate power-to-weight calculations.')
  }

  return { ftp, weight_kg, source, warnings }
}
