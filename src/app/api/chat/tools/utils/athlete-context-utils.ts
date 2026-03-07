import { parseAthleteContext, resolveAthleteProfile, type ToolContext } from '../types'
import { getCurrentFitness } from '@/lib/db/fitness'
import { formatDateForApi } from '@/lib/intervals-icu'

/**
 * Enriched athlete context with fitness data from the best available source.
 * Follows the cascade: parsed context → local Supabase → intervals.icu.
 * FTP/weight use resolveAthleteProfile — no hardcoded defaults.
 */
export interface EnrichedAthleteContext {
  ftp: number | null
  weight_kg: number | null
  ctl: number
  atl: number
  tsb: number
  fitness_source: 'context' | 'local' | 'intervals_icu' | 'default'
  profile_source: 'context' | 'intervals_icu' | 'none'
  warnings: string[]
}

/**
 * Gather enriched athlete context by resolving FTP, weight, and fitness metrics
 * from the best available source.
 *
 * FTP/weight resolution (via resolveAthleteProfile):
 * 1. Parse athleteContext JSON
 * 2. Fall back to intervals.icu athlete API
 * 3. Return null if unavailable (no hardcoded defaults)
 *
 * Fitness (CTL/ATL/TSB) resolution:
 * 1. Parse athleteContext JSON for initial values
 * 2. Try local Supabase (getCurrentFitness) if useLocalData flag is on
 * 3. Fall back to intervals.icu wellness API if connected
 * 4. Use parsed context values or defaults (50/50/0)
 */
export async function enrichAthleteContext(
  ctx: ToolContext
): Promise<EnrichedAthleteContext> {
  // Resolve FTP and weight — no hardcoded defaults
  const profile = await resolveAthleteProfile(ctx)

  // Parse fitness metrics from context
  const parsed = parseAthleteContext(ctx.athleteContext)
  let ctl = parsed.currentFitness?.ctl || 50
  let atl = parsed.currentFitness?.atl || 50
  let tsb = parsed.currentFitness?.tsb ?? (ctl - atl)
  let fitness_source: EnrichedAthleteContext['fitness_source'] =
    parsed.currentFitness ? 'context' : 'default'

  // Try local Supabase for more accurate fitness data
  if (ctx.flags.useLocalData && ctx.athleteId) {
    try {
      const localFitness = await getCurrentFitness(ctx.athleteId)
      if (localFitness) {
        ctl = localFitness.ctl
        atl = localFitness.atl
        tsb = localFitness.tsb
        fitness_source = 'local'
      }
    } catch {
      // Fall through to next source
    }
  }

  // Fall back to intervals.icu if local data wasn't found
  if (fitness_source !== 'local' && ctx.intervalsConnected) {
    try {
      const today = formatDateForApi(new Date())
      const wellness = await ctx.intervalsClient.getWellnessForDate(today)
      if (wellness) {
        ctl = wellness.ctl
        atl = wellness.atl
        tsb = wellness.ctl - wellness.atl
        fitness_source = 'intervals_icu'
      }
    } catch {
      // Use whatever we already have
    }
  }

  return {
    ftp: profile.ftp,
    weight_kg: profile.weight_kg,
    ctl,
    atl,
    tsb,
    fitness_source,
    profile_source: profile.source,
    warnings: profile.warnings,
  }
}
