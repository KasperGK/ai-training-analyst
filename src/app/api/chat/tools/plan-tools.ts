import { z } from 'zod'
import { defineTool, parseAthleteContext } from './types'
import { getCurrentFitness } from '@/lib/db/fitness'
import { formatDateForApi } from '@/lib/intervals-icu'
import { generateTrainingPlan as generatePlan, getAvailablePlans } from '@/lib/plans/generator'
import { planTemplates } from '@/lib/plans/templates'
import {
  createTrainingPlan,
  createPlanDays,
  getActivePlan as getActivePlanFromDB,
  updateTrainingPlan,
  getPlanDays,
  calculatePlanProgress,
  updatePlanDay as updateDay
} from '@/lib/db/training-plans'
import { analyzeAthletePatterns, summarizePatterns } from '@/lib/learning'

// ============================================================
// GENERATE TRAINING PLAN
// ============================================================

const generatePlanInputSchema = z.object({
  goal: z.enum(['base_build', 'ftp_build', 'event_prep', 'taper', 'maintenance']).optional()
    .describe('Training goal: base_build (aerobic foundation), ftp_build (increase FTP), event_prep (prepare for goal event), taper (pre-race), maintenance (hold fitness)'),
  templateId: z.string().optional()
    .describe('Specific plan template ID if known (e.g., "base_build_4week", "ftp_build_8week", "taper_3week", "event_prep_12week")'),
  startDate: z.string().optional()
    .describe('Plan start date in YYYY-MM-DD format. Defaults to next Monday.'),
  weeklyHoursTarget: z.number().optional()
    .describe('Target training hours per week (default: 8)'),
  keyWorkoutDays: z.array(z.number()).optional()
    .describe('Days of week for key workouts as array (0=Sun, 1=Mon, ..., 6=Sat). Default: [2,4,6] for Tue/Thu/Sat'),
  targetEventDate: z.string().optional()
    .describe('Target event date in YYYY-MM-DD format (helps with taper timing)'),
  showAvailablePlans: z.boolean().optional()
    .describe('Set to true to see all available plan templates instead of generating a plan'),
})

type GeneratePlanInput = z.infer<typeof generatePlanInputSchema>

export const generateTrainingPlan = defineTool<GeneratePlanInput, unknown>({
  description: 'Generate a structured multi-week training plan tailored to the athlete\'s goals and current fitness. Creates a complete periodized plan with daily workouts, recovery weeks, and progression. Use when the athlete wants a structured training plan or asks about building toward an event.',
  inputSchema: generatePlanInputSchema,
  execute: async ({
    goal,
    templateId,
    startDate,
    weeklyHoursTarget,
    keyWorkoutDays,
    targetEventDate,
    showAvailablePlans = false,
  }, ctx) => {
    // Gather athlete context
    const parsed = parseAthleteContext(ctx.athleteContext)
    const athleteFTP = parsed.athlete?.ftp || 250
    const weightKg = parsed.athlete?.weight_kg || 70
    let currentCTL = parsed.currentFitness?.ctl || 50
    let currentATL = parsed.currentFitness?.atl || 50
    let fitnessSource = parsed.currentFitness ? 'context' : 'default'

    // Try local Supabase
    if (ctx.flags.useLocalData && ctx.athleteId) {
      try {
        const localFitness = await getCurrentFitness(ctx.athleteId)
        if (localFitness) {
          currentCTL = localFitness.ctl
          currentATL = localFitness.atl
          fitnessSource = 'local'
        }
      } catch {
        // Fall through
      }
    }

    // Fall back to intervals.icu
    if (fitnessSource !== 'local' && ctx.intervalsConnected) {
      try {
        const today = formatDateForApi(new Date())
        const wellness = await ctx.intervalsClient.getWellnessForDate(today)
        if (wellness) {
          currentCTL = wellness.ctl
          currentATL = wellness.atl
          fitnessSource = 'intervals_icu'
        }
      } catch {
        // Use fallback
      }
    }

    // If just listing available plans
    if (showAvailablePlans) {
      const available = getAvailablePlans(currentCTL)
      return {
        currentFitness: {
          ctl: Math.round(currentCTL),
          atl: Math.round(currentATL),
          ftp: athleteFTP,
        },
        availablePlans: available,
        totalPlans: planTemplates.length,
        recommendation: available.filter(p => p.isApplicable).length > 0
          ? `You have ${available.filter(p => p.isApplicable).length} plans available at your current fitness level.`
          : 'Build fitness first - your CTL is below minimum for most plans.',
      }
    }

    // Calculate default start date (next Monday)
    let planStartDate = startDate
    if (!planStartDate) {
      const today = new Date()
      const daysUntilMonday = (8 - today.getDay()) % 7 || 7
      const nextMonday = new Date(today)
      nextMonday.setDate(today.getDate() + daysUntilMonday)
      planStartDate = nextMonday.toISOString().split('T')[0]
    }

    // Fetch athlete patterns for personalization (if available)
    let patterns = undefined
    if (ctx.athleteId) {
      try {
        patterns = await analyzeAthletePatterns(ctx.athleteId, { days: 90, saveAsMemories: false })
        if (patterns.dataPoints < 5) patterns = undefined // Not enough data
      } catch {
        // Patterns not available, continue without them
      }
    }

    // Generate the plan
    const result = generatePlan({
      templateId,
      goal,
      startDate: planStartDate,
      weeklyHoursTarget,
      keyWorkoutDays,
      targetEventDate,
      athleteContext: {
        ftp: athleteFTP,
        ctl: currentCTL,
        atl: currentATL,
        weight_kg: weightKg,
      },
      patterns,
    })

    if (!result.success || !result.plan) {
      return {
        error: result.error || 'Failed to generate plan',
        warnings: result.warnings,
        availablePlans: getAvailablePlans(currentCTL),
      }
    }

    const plan = result.plan

    // Persist plan to database
    let savedPlanId: string | null = null
    if (ctx.athleteId) {
      try {
        // Deactivate any existing active plans for this athlete
        const existingActive = await getActivePlanFromDB(ctx.athleteId)
        if (existingActive) {
          await updateTrainingPlan(existingActive.id, { status: 'abandoned' })
        }

        // Create the training plan record
        const savedPlan = await createTrainingPlan({
          athlete_id: ctx.athleteId,
          name: plan.templateName,
          description: plan.description,
          goal: plan.goal,
          duration_weeks: plan.durationWeeks,
          weekly_hours_target: plan.weeklyHoursTarget,
          start_date: plan.startDate,
          end_date: plan.endDate,
          key_workout_days: keyWorkoutDays || [],
          target_event_id: null,
          target_event_date: plan.targetEventDate || null,
          status: 'active',
          plan_data: plan as unknown as Record<string, unknown>,
        })

        if (savedPlan) {
          savedPlanId = savedPlan.id

          // Flatten weeks/days into plan_days table
          const planDaysToInsert = plan.weeks.flatMap(week =>
            week.days.map(day => ({
              plan_id: savedPlan.id,
              date: day.date,
              week_number: day.weekNumber,
              day_of_week: day.dayOfWeek,
              workout_template_id: day.workout?.templateId || null,
              workout_type: day.workout?.category || null,
              workout_name: day.workout?.name || null,
              target_tss: day.workout?.targetTSS || null,
              target_duration_minutes: day.workout?.targetDurationMinutes || null,
              target_if: day.workout?.targetIF || null,
              custom_description: null,
              intervals_json: day.workout?.intervals as unknown as Record<string, unknown> || null,
              completed: false,
              actual_session_id: null,
              actual_tss: null,
              actual_duration_minutes: null,
              compliance_score: null,
              coach_notes: null,
              athlete_notes: null,
            }))
          )
          await createPlanDays(planDaysToInsert)
        }
      } catch (e) {
        // Log but don't fail - plan was generated successfully
        console.error('Failed to persist training plan:', e)
      }
    }

    // Build a summary suitable for chat response
    const weekSummaries = plan.weeks.map(w => ({
      week: w.weekNumber,
      phase: w.phase,
      focus: w.focusDescription,
      targetTSS: w.actualTargetTSS,
      keyWorkouts: w.days
        .filter(d => d.isKeyWorkout && d.workout)
        .map(d => ({
          day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.dayOfWeek],
          workout: d.workout?.name,
          category: d.workout?.category,
          tss: d.workout?.targetTSS,
        })),
    }))

    // Sample first week's details
    const firstWeekDetails = plan.weeks[0]?.days
      .filter(d => d.workout !== null)
      .slice(0, 3)
      .map(d => ({
        date: d.date,
        day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.dayOfWeek],
        workout: d.workout?.name,
        description: d.workout?.description,
        targetTSS: d.workout?.targetTSS,
        targetDuration: d.workout?.targetDurationMinutes,
        intervals: d.workout?.intervals?.map(i => ({
          sets: i.sets,
          duration: `${Math.round(i.durationSeconds / 60)} min`,
          power: `${i.targetPowerMin}-${i.targetPowerMax}W`,
        })),
      }))

    return {
      success: true,
      savedPlanId,
      plan: {
        name: plan.templateName,
        goal: plan.goal,
        description: plan.description,
        duration: `${plan.durationWeeks} weeks`,
        dates: `${plan.startDate} to ${plan.endDate}`,
        targetEvent: plan.targetEventDate,
      },
      summary: {
        totalWorkoutDays: plan.summary.totalWorkoutDays,
        totalRestDays: plan.summary.totalRestDays,
        avgWeeklyTSS: plan.summary.avgWeeklyTSS,
        phases: plan.summary.phases,
      },
      weekOverview: weekSummaries,
      firstWeekSample: firstWeekDetails,
      athleteContext: {
        ctl: Math.round(currentCTL),
        atl: Math.round(currentATL),
        ftp: athleteFTP,
        fitnessSource,
      },
      warnings: result.warnings,
      tip: savedPlanId
        ? 'This plan has been saved and is now active. I\'ll track your progress as you complete workouts. Use "show my plan" to see details anytime.'
        : 'This plan is generated based on your current fitness. Review the week-by-week structure and let me know if you want to adjust intensity, add rest days, or modify any workouts.',
    }
  },
})

// ============================================================
// ANALYZE PATTERNS
// ============================================================

const analyzePatternsInputSchema = z.object({
  days: z.number().optional().describe('Number of days to analyze (default: 90)'),
  saveAsMemories: z.boolean().optional().describe('Save discovered patterns as athlete memories (default: true)'),
})

type AnalyzePatternsInput = z.infer<typeof analyzePatternsInputSchema>

export const analyzePatterns = defineTool<AnalyzePatternsInput, unknown>({
  description: 'Analyze the athlete\'s training outcome patterns to understand what works best for them. Looks at recovery rate, optimal TSB range, best days for intensity, volume vs intensity preferences, and workout type success rates. Patterns are automatically saved as memories for future personalization.',
  inputSchema: analyzePatternsInputSchema,
  execute: async ({ days = 90, saveAsMemories = true }, ctx) => {
    if (!ctx.athleteId) {
      return { error: 'No athlete ID available. Pattern analysis requires a logged-in user.' }
    }

    try {
      const patterns = await analyzeAthletePatterns(ctx.athleteId, { days, saveAsMemories })

      if (patterns.dataPoints < 5) {
        return {
          message: 'Not enough workout outcome data to detect patterns yet.',
          dataPoints: patterns.dataPoints,
          tip: 'Keep logging workout outcomes (RPE, feedback) using the logWorkoutOutcome tool. After about 10-15 outcomes, patterns will start emerging.',
        }
      }

      const summary = summarizePatterns(patterns)

      return {
        summary,
        dataPoints: patterns.dataPoints,
        analyzedAt: patterns.analyzedAt,
        patterns: {
          recovery: patterns.recovery ? {
            averageDays: patterns.recovery.averageRecoveryDays,
            profile: patterns.recovery.fastRecoverer ? 'fast' : patterns.recovery.slowRecoverer ? 'slow' : 'average',
            confidence: Math.round(patterns.recovery.confidence * 100),
          } : null,
          optimalTSB: patterns.tsb ? {
            range: `${patterns.tsb.optimalTSB.min} to ${patterns.tsb.optimalTSB.max}`,
            peakTSB: patterns.tsb.peakPerformanceTSB,
            riskZone: `${patterns.tsb.riskZone.min} to ${patterns.tsb.riskZone.max}`,
            confidence: Math.round(patterns.tsb.confidence * 100),
          } : null,
          volumeIntensity: patterns.volumeIntensity ? {
            preference: patterns.volumeIntensity.prefersVolume ? 'volume-focused' :
              patterns.volumeIntensity.prefersIntensity ? 'intensity-focused' : 'balanced',
            weeklyHoursSweet: patterns.volumeIntensity.weeklyHoursSweet,
            confidence: Math.round(patterns.volumeIntensity.confidence * 100),
          } : null,
          dayOfWeek: patterns.dayOfWeek ? {
            bestIntensityDays: patterns.dayOfWeek.bestIntensityDays,
            avoidIntensityDays: patterns.dayOfWeek.avoidIntensityDays,
            confidence: Math.round(patterns.dayOfWeek.confidence * 100),
          } : null,
          workoutTypes: patterns.workoutTypes.slice(0, 5).map(t => ({
            type: t.workoutType,
            completionRate: Math.round(t.completionRate * 100),
            averageRPE: t.averageRPE,
            bestDays: t.bestDays,
            sampleSize: t.sampleSize,
          })),
        },
        memoriesSaved: saveAsMemories,
        tip: 'These patterns are now being used to personalize workout suggestions and training plans. Patterns update automatically as more outcomes are logged.',
      }
    } catch (error) {
      console.error('[analyzePatterns] Error:', error)
      return { error: 'Failed to analyze patterns' }
    }
  },
})

// ============================================================
// GET TRAINING PLAN
// ============================================================

const getTrainingPlanInputSchema = z.object({
  includeFullWeek: z.boolean().optional().describe('Include full week details (default: true)'),
  weekOffset: z.number().optional().describe('Week offset from current (0=this week, 1=next week, -1=last week)'),
})

type GetTrainingPlanInput = z.infer<typeof getTrainingPlanInputSchema>

export const getTrainingPlan = defineTool<GetTrainingPlanInput, unknown>({
  description: 'Retrieve the athlete\'s current active training plan with upcoming workouts. Shows plan overview, this week\'s schedule, and progress tracking. Use this when athlete asks about their plan, what workout is scheduled, or plan progress.',
  inputSchema: getTrainingPlanInputSchema,
  execute: async ({ includeFullWeek = true, weekOffset = 0 }, ctx) => {
    if (!ctx.athleteId) {
      return { error: 'No athlete ID available. Plan retrieval requires a logged-in user.' }
    }

    try {
      // Get active plan
      const activePlan = await getActivePlanFromDB(ctx.athleteId)

      if (!activePlan) {
        return {
          hasPlan: false,
          message: 'No active training plan found.',
          tip: 'Would you like me to generate a training plan based on your goals and current fitness? Just tell me your goal (build FTP, prepare for event, maintain fitness, etc.).',
        }
      }

      // Calculate date range for requested week
      const today = new Date()
      const startOfWeek = new Date(today)
      startOfWeek.setDate(today.getDate() - today.getDay() + (weekOffset * 7))
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)

      const weekStartStr = startOfWeek.toISOString().split('T')[0]
      const weekEndStr = endOfWeek.toISOString().split('T')[0]

      // Get plan days for this week
      const weekDays = await getPlanDays(activePlan.id, {
        startDate: weekStartStr,
        endDate: weekEndStr,
      })

      // Calculate progress
      const progress = await calculatePlanProgress(activePlan.id)

      // Format week schedule
      const weekSchedule = weekDays.map(day => ({
        date: day.date,
        dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.day_of_week],
        isToday: day.date === today.toISOString().split('T')[0],
        workout: day.workout_name ? {
          name: day.workout_name,
          type: day.workout_type,
          targetTSS: day.target_tss,
          targetDuration: day.target_duration_minutes,
          completed: day.completed,
          actualTSS: day.actual_tss,
        } : null,
        isRestDay: !day.workout_name,
      }))

      // Find today's workout
      const todaysWorkout = weekSchedule.find(d => d.isToday)

      // Get upcoming key workouts (next 3)
      const allDays = await getPlanDays(activePlan.id)
      const upcomingDays = allDays
        .filter(d => d.date >= today.toISOString().split('T')[0] && d.workout_name)
        .slice(0, 3)

      return {
        hasPlan: true,
        plan: {
          id: activePlan.id,
          name: activePlan.name,
          goal: activePlan.goal,
          duration: `${activePlan.duration_weeks} weeks`,
          dates: `${activePlan.start_date} to ${activePlan.end_date}`,
          progress: `${progress}%`,
        },
        today: todaysWorkout ? {
          date: todaysWorkout.date,
          workout: todaysWorkout.workout,
          isRestDay: todaysWorkout.isRestDay,
        } : null,
        thisWeek: includeFullWeek ? weekSchedule : undefined,
        upcomingWorkouts: upcomingDays.map(d => ({
          date: d.date,
          name: d.workout_name,
          type: d.workout_type,
          targetTSS: d.target_tss,
        })),
        weekNumber: Math.ceil(
          (new Date(weekStartStr).getTime() - new Date(activePlan.start_date).getTime()) /
          (7 * 24 * 60 * 60 * 1000)
        ) + 1,
        tip: todaysWorkout?.workout
          ? `Today's workout: ${todaysWorkout.workout.name}. Let me know if you want details or need to modify it.`
          : todaysWorkout?.isRestDay
            ? 'Today is a rest day. Take it easy and recover well!'
            : 'Check the weekly schedule above for your upcoming workouts.',
      }
    } catch (error) {
      console.error('[getTrainingPlan] Error:', error)
      return { error: 'Failed to retrieve training plan' }
    }
  },
})

// ============================================================
// UPDATE PLAN DAY
// ============================================================

const updatePlanDayInputSchema = z.object({
  date: z.string().describe('Date of the plan day to update (YYYY-MM-DD)'),
  completed: z.boolean().optional().describe('Mark the workout as completed'),
  actualSessionId: z.string().optional().describe('Link to actual session ID if available'),
  actualTSS: z.number().optional().describe('Actual TSS achieved'),
  actualDuration: z.number().optional().describe('Actual duration in minutes'),
  athleteNotes: z.string().optional().describe('Notes from athlete about the workout'),
})

type UpdatePlanDayInput = z.infer<typeof updatePlanDayInputSchema>

export const updatePlanDay = defineTool<UpdatePlanDayInput, unknown>({
  description: 'Update a training plan day - mark workout as complete, add notes, or link to actual session. Use after athlete completes a workout to track compliance.',
  inputSchema: updatePlanDayInputSchema,
  execute: async ({
    date,
    completed,
    actualSessionId,
    actualTSS,
    actualDuration,
    athleteNotes,
  }, ctx) => {
    if (!ctx.athleteId) {
      return { error: 'No athlete ID available.' }
    }

    try {
      const activePlan = await getActivePlanFromDB(ctx.athleteId)
      if (!activePlan) {
        return { error: 'No active training plan found.' }
      }

      // Get the plan day for this date
      const days = await getPlanDays(activePlan.id, { startDate: date, endDate: date })
      const planDay = days[0]

      if (!planDay) {
        return { error: `No workout scheduled for ${date}.` }
      }

      // Build update object
      const updates: Record<string, unknown> = {}
      if (completed !== undefined) updates.completed = completed
      if (actualSessionId) updates.actual_session_id = actualSessionId
      if (actualTSS !== undefined) updates.actual_tss = actualTSS
      if (actualDuration !== undefined) updates.actual_duration_minutes = actualDuration
      if (athleteNotes) updates.athlete_notes = athleteNotes

      // Calculate compliance if we have actual data
      if (actualTSS && planDay.target_tss) {
        updates.compliance_score = Math.min(100, Math.round((actualTSS / planDay.target_tss) * 100))
      }

      const updated = await updateDay(planDay.id, updates)

      if (!updated) {
        return { error: 'Failed to update plan day.' }
      }

      // Update plan progress
      const progress = await calculatePlanProgress(activePlan.id)
      await updateTrainingPlan(activePlan.id, { progress_percent: progress })

      return {
        success: true,
        updated: {
          date: updated.date,
          workout: updated.workout_name,
          completed: updated.completed,
          complianceScore: updated.compliance_score,
          athleteNotes: updated.athlete_notes,
        },
        planProgress: `${progress}%`,
        message: completed
          ? `Great job completing ${planDay.workout_name}! Plan progress: ${progress}%`
          : 'Plan day updated successfully.',
      }
    } catch (error) {
      console.error('[updatePlanDay] Error:', error)
      return { error: 'Failed to update plan day' }
    }
  },
})
