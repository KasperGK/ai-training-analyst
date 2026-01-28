import { z } from 'zod'
import type { intervalsClient } from '@/lib/intervals-icu'

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
