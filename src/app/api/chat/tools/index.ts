import { type ToolContext } from './types'
import { getDetailedSession } from './get-detailed-session'
import { queryHistoricalTrends } from './query-historical-trends'
import { getAthleteGoals } from './get-athlete-goals'
import { suggestWorkout } from './suggest-workout'
import { generateChart } from './generate-chart'
import { searchKnowledge } from './search-knowledge'
import { getAthleteMemory, saveAthleteMemory } from './athlete-memory'
import { getRecoveryTrends } from './get-recovery-trends'
import { getActiveInsights } from './get-active-insights'
import { logWorkoutOutcome } from './log-workout-outcome'
import { analyzePowerCurve, analyzeEfficiency, analyzeTrainingLoad } from './analysis-tools'
import { generateTrainingPlan, analyzePatterns, getTrainingPlan, updatePlanDay } from './plan-tools'

export type { ToolContext } from './types'

/**
 * Build all AI tools with the given context.
 * Feature flags are used to conditionally include tools.
 */
export function buildTools(ctx: ToolContext) {
  return {
    // Core tools (always available)
    getDetailedSession: getDetailedSession(ctx),
    queryHistoricalTrends: queryHistoricalTrends(ctx),
    getAthleteGoals: getAthleteGoals(ctx),
    suggestWorkout: suggestWorkout(ctx),
    generateChart: generateChart(ctx),
    getRecoveryTrends: getRecoveryTrends(ctx),
    logWorkoutOutcome: logWorkoutOutcome(ctx),

    // Analysis tools (always available)
    analyzePowerCurve: analyzePowerCurve(ctx),
    analyzeEfficiency: analyzeEfficiency(ctx),
    analyzeTrainingLoad: analyzeTrainingLoad(ctx),

    // Plan tools (always available)
    generateTrainingPlan: generateTrainingPlan(ctx),
    analyzePatterns: analyzePatterns(ctx),
    getTrainingPlan: getTrainingPlan(ctx),
    updatePlanDay: updatePlanDay(ctx),

    // Conditional tools based on feature flags
    ...(ctx.flags.enableRag ? {
      searchKnowledge: searchKnowledge(ctx),
    } : {}),

    ...(ctx.flags.enableMemory ? {
      getAthleteMemory: getAthleteMemory(ctx),
      saveAthleteMemory: saveAthleteMemory(ctx),
    } : {}),

    ...(ctx.flags.enableInsights ? {
      getActiveInsights: getActiveInsights(ctx),
    } : {}),
  }
}

// Re-export individual tools for testing or direct use
export {
  getDetailedSession,
  queryHistoricalTrends,
  getAthleteGoals,
  suggestWorkout,
  generateChart,
  searchKnowledge,
  getAthleteMemory,
  saveAthleteMemory,
  getRecoveryTrends,
  getActiveInsights,
  logWorkoutOutcome,
  analyzePowerCurve,
  analyzeEfficiency,
  analyzeTrainingLoad,
  generateTrainingPlan,
  analyzePatterns,
  getTrainingPlan,
  updatePlanDay,
}
