import { z } from 'zod'
import { defineTool, parseAthleteContext } from './types'
import { getCurrentFitness } from '@/lib/db/fitness'
import { formatDateForApi } from '@/lib/intervals-icu'
import { generateTrainingPlan as generatePlan, getAvailablePlans } from '@/lib/plans/generator'
import {
  createTrainingPlan,
  createPlanDays,
  getActivePlan as getActivePlanFromDB,
  getTrainingPlan as getTrainingPlanFromDB,
  updateTrainingPlan,
  getPlanDays,
} from '@/lib/db/training-plans'
import { projectFitness, planDataToPlanDays } from '@/lib/plans/projection'
import { analyzeAthletePatterns } from '@/lib/learning'

// ============================================================
// PROPOSE PLAN
// ============================================================

const proposePlanInputSchema = z.object({
  goal: z.enum(['base_build', 'ftp_build', 'event_prep', 'taper', 'maintenance']).optional()
    .describe('Training goal: base_build, ftp_build, event_prep, taper, or maintenance'),
  targetEventDate: z.string().optional()
    .describe('Target event date in YYYY-MM-DD format'),
  weeklyHours: z.number().optional()
    .describe('Target weekly training hours (default: 8)'),
  preferences: z.object({
    keyDays: z.array(z.number()).optional().describe('Key workout days (0=Sun, 6=Sat)'),
    startDate: z.string().optional().describe('Plan start date YYYY-MM-DD'),
    intensity: z.enum(['low', 'moderate', 'high']).optional().describe('Intensity preference'),
  }).optional().describe('Optional athlete preferences'),
})

type ProposePlanInput = z.infer<typeof proposePlanInputSchema>

export const proposePlan = defineTool<ProposePlanInput, unknown>({
  description: `Propose a training plan as a draft for the athlete to review. Unlike generateTrainingPlan which immediately activates a plan, this creates a DRAFT plan and shows it on the canvas with a fitness projection chart.

Use this when:
- Athlete mentions an upcoming event or race
- Athlete asks to "build fitness" or "train for..."
- Athlete wants a structured training plan
- You want to suggest a periodized training approach

The athlete can then review the calendar view and projection, ask for modifications, or accept the plan.`,

  inputSchema: proposePlanInputSchema,

  execute: async ({ goal, targetEventDate, weeklyHours, preferences }, ctx) => {
    // Gather athlete context
    const parsed = parseAthleteContext(ctx.athleteContext)
    const athleteFTP = parsed.athlete?.ftp || 250
    const weightKg = parsed.athlete?.weight_kg || 70
    let currentCTL = parsed.currentFitness?.ctl || 50
    let currentATL = parsed.currentFitness?.atl || 50
    let fitnessSource = parsed.currentFitness ? 'context' : 'default'

    // Try local Supabase for accurate fitness data
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

    // Calculate start date (next Monday by default)
    let planStartDate = preferences?.startDate
    if (!planStartDate) {
      const today = new Date()
      const daysUntilMonday = (8 - today.getDay()) % 7 || 7
      const nextMonday = new Date(today)
      nextMonday.setDate(today.getDate() + daysUntilMonday)
      planStartDate = nextMonday.toISOString().split('T')[0]
    }

    // Map intensity preference to weekly hours adjustment
    const intensityMultiplier = preferences?.intensity === 'low' ? 0.8
      : preferences?.intensity === 'high' ? 1.2
      : 1.0

    const adjustedWeeklyHours = Math.round((weeklyHours || 8) * intensityMultiplier)

    // Fetch athlete patterns for personalization
    let patterns = undefined
    if (ctx.athleteId) {
      try {
        patterns = await analyzeAthletePatterns(ctx.athleteId, { days: 90, saveAsMemories: false })
        if (patterns.dataPoints < 5) patterns = undefined
      } catch {
        // Continue without patterns
      }
    }

    // Generate the plan
    const result = generatePlan({
      goal,
      startDate: planStartDate,
      weeklyHoursTarget: adjustedWeeklyHours,
      keyWorkoutDays: preferences?.keyDays,
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
        error: result.error || 'Failed to generate plan proposal',
        warnings: result.warnings,
        availablePlans: getAvailablePlans(currentCTL),
        tip: 'Try specifying a different goal or adjusting weekly hours.',
      }
    }

    const plan = result.plan

    // Calculate fitness projection
    const planDays = planDataToPlanDays(plan as unknown as Record<string, unknown>)
    const projection = projectFitness(currentCTL, currentATL, planDays, {
      eventDate: targetEventDate,
    })

    // Save as DRAFT plan
    let savedPlanId: string | null = null
    if (ctx.athleteId) {
      try {
        const savedPlan = await createTrainingPlan({
          athlete_id: ctx.athleteId,
          name: plan.templateName,
          description: plan.description,
          goal: plan.goal,
          duration_weeks: plan.durationWeeks,
          weekly_hours_target: plan.weeklyHoursTarget,
          start_date: plan.startDate,
          end_date: plan.endDate,
          key_workout_days: preferences?.keyDays || [],
          target_event_id: null,
          target_event_date: plan.targetEventDate || null,
          status: 'draft', // Draft status — not active yet
          plan_data: plan as unknown as Record<string, unknown>,
        })

        if (savedPlan) {
          savedPlanId = savedPlan.id

          // Save plan days
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
        console.error('Failed to persist draft plan:', e)
      }
    }

    // Build week summaries for the proposal widget
    const weekSummaries = plan.weeks.map(w => ({
      week: w.weekNumber,
      phase: w.phase,
      focus: w.focusDescription,
      targetTSS: w.actualTargetTSS,
      days: w.days.map(d => ({
        date: d.date,
        dayOfWeek: d.dayOfWeek,
        isKeyWorkout: d.isKeyWorkout,
        workout: d.workout ? {
          name: d.workout.name,
          category: d.workout.category,
          targetTSS: d.workout.targetTSS,
          targetDurationMinutes: d.workout.targetDurationMinutes,
        } : null,
      })),
    }))

    // Build projection summary for the projection widget
    const projectionSummary = {
      points: projection.points,
      startFitness: { ctl: Math.round(currentCTL), atl: Math.round(currentATL), tsb: Math.round(currentCTL - currentATL) },
      endFitness: { ctl: Math.round(projection.finalCTL), atl: Math.round(projection.finalATL), tsb: Math.round(projection.finalTSB) },
      peakCTL: projection.peakCTL,
      peakCTLDate: projection.peakCTLDate,
      ctlGain: projection.ctlGain,
      eventFitness: projection.eventFitness,
    }

    return {
      success: true,
      planId: savedPlanId,
      status: 'draft',
      plan: {
        name: plan.templateName,
        goal: plan.goal,
        description: plan.description,
        duration: `${plan.durationWeeks} weeks`,
        dates: `${plan.startDate} to ${plan.endDate}`,
        targetEvent: plan.targetEventDate,
        weeklyHoursTarget: plan.weeklyHoursTarget,
      },
      summary: {
        totalWorkoutDays: plan.summary.totalWorkoutDays,
        totalRestDays: plan.summary.totalRestDays,
        avgWeeklyTSS: plan.summary.avgWeeklyTSS,
        phases: plan.summary.phases,
      },
      weekSummaries,
      projection: projectionSummary,
      athleteContext: {
        ctl: Math.round(currentCTL),
        atl: Math.round(currentATL),
        ftp: athleteFTP,
        fitnessSource,
      },
      warnings: result.warnings,
      // Canvas instructions for the AI to show widgets
      canvasWidgets: [
        {
          type: 'plan-proposal',
          insight: `${plan.templateName} — ${plan.durationWeeks} weeks targeting ${plan.goal.replace('_', ' ')}. Review the calendar below and let me know if you want to modify anything.`,
          config: {
            planId: savedPlanId,
            planName: plan.templateName,
            weekSummaries,
            targetEventDate,
            startDate: plan.startDate,
            endDate: plan.endDate,
          },
        },
        {
          type: 'plan-projection',
          insight: `Projected CTL gain: +${projection.ctlGain} (${Math.round(currentCTL)} → ${Math.round(projection.finalCTL)}).${projection.eventFitness ? ` Event day TSB: ${Math.round(projection.eventFitness.tsb)} — ${projection.eventFitness.tsb >= -10 && projection.eventFitness.tsb <= 15 ? 'good race form' : projection.eventFitness.tsb > 15 ? 'very fresh, may lose some fitness' : 'still fatigued, consider more taper'}.` : ''}`,
          config: {
            projection: projectionSummary,
            planId: savedPlanId,
          },
        },
      ],
      tip: 'This is a draft plan. Review the calendar and projection, then tell me to accept it, or ask me to modify it (e.g., "make it less intense" or "change key workouts to Tuesday/Thursday").',
    }
  },
})

// ============================================================
// MODIFY PROPOSAL
// ============================================================

const modifyProposalInputSchema = z.object({
  planId: z.string().describe('ID of the draft plan to modify'),
  modifications: z.object({
    weeklyHours: z.number().optional().describe('New weekly hours target'),
    keyDays: z.array(z.number()).optional().describe('New key workout days (0=Sun, 6=Sat)'),
    intensity: z.enum(['lower', 'higher']).optional().describe('Adjust intensity up or down'),
    startDate: z.string().optional().describe('New start date YYYY-MM-DD'),
  }).describe('What to change in the plan'),
})

type ModifyProposalInput = z.infer<typeof modifyProposalInputSchema>

export const modifyProposal = defineTool<ModifyProposalInput, unknown>({
  description: `Modify an existing draft plan proposal. Regenerates the plan with the requested changes and updates the projection. Use when the athlete asks to change something about a proposed plan (intensity, schedule, duration, etc.).`,

  inputSchema: modifyProposalInputSchema,

  execute: async ({ planId, modifications }, ctx) => {
    if (!ctx.athleteId) {
      return { error: 'No athlete ID available.' }
    }

    // Get the existing draft plan
    const existingPlan = await getTrainingPlanFromDB(planId)
    if (!existingPlan) {
      return { error: 'Plan not found. It may have been deleted.' }
    }

    if (existingPlan.status !== 'draft') {
      return { error: `Plan is already ${existingPlan.status}. Only draft plans can be modified.` }
    }

    // Get current fitness
    const parsed = parseAthleteContext(ctx.athleteContext)
    let currentCTL = parsed.currentFitness?.ctl || 50
    let currentATL = parsed.currentFitness?.atl || 50
    const athleteFTP = parsed.athlete?.ftp || 250
    const weightKg = parsed.athlete?.weight_kg || 70

    if (ctx.flags.useLocalData && ctx.athleteId) {
      try {
        const localFitness = await getCurrentFitness(ctx.athleteId)
        if (localFitness) {
          currentCTL = localFitness.ctl
          currentATL = localFitness.atl
        }
      } catch {
        // Fall through
      }
    }

    // Apply modifications
    const weeklyHours = modifications.weeklyHours ?? existingPlan.weekly_hours_target ?? 8
    const intensityMultiplier = modifications.intensity === 'lower' ? 0.85
      : modifications.intensity === 'higher' ? 1.15
      : 1.0
    const adjustedWeeklyHours = Math.round(weeklyHours * intensityMultiplier)
    const startDate = modifications.startDate ?? existingPlan.start_date
    const keyDays = modifications.keyDays ?? existingPlan.key_workout_days ?? undefined

    // Regenerate the plan
    const result = generatePlan({
      goal: existingPlan.goal as 'base_build' | 'ftp_build' | 'event_prep' | 'taper' | 'maintenance',
      startDate,
      weeklyHoursTarget: adjustedWeeklyHours,
      keyWorkoutDays: keyDays,
      targetEventDate: existingPlan.target_event_date ?? undefined,
      athleteContext: {
        ftp: athleteFTP,
        ctl: currentCTL,
        atl: currentATL,
        weight_kg: weightKg,
      },
    })

    if (!result.success || !result.plan) {
      return {
        error: result.error || 'Failed to regenerate plan',
        warnings: result.warnings,
      }
    }

    const plan = result.plan

    // Recalculate projection
    const planDays = planDataToPlanDays(plan as unknown as Record<string, unknown>)
    const projection = projectFitness(currentCTL, currentATL, planDays, {
      eventDate: existingPlan.target_event_date ?? undefined,
    })

    // Update the draft plan in DB
    try {
      await updateTrainingPlan(planId, {
        name: plan.templateName,
        description: plan.description,
        weekly_hours_target: plan.weeklyHoursTarget,
        start_date: plan.startDate,
        end_date: plan.endDate,
        key_workout_days: keyDays ?? [],
        plan_data: plan as unknown as Record<string, unknown>,
      })

      // Delete old plan days and recreate
      // (simpler than diffing — getPlanDays + delete + insert)
      const oldDays = await getPlanDays(planId)
      if (oldDays.length > 0) {
        const { createClient } = await import('@/lib/supabase/server')
        const supabase = await createClient()
        if (supabase) {
          await supabase.from('plan_days').delete().eq('plan_id', planId)
        }
      }

      const planDaysToInsert = plan.weeks.flatMap(week =>
        week.days.map(day => ({
          plan_id: planId,
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
    } catch (e) {
      console.error('Failed to update draft plan:', e)
    }

    // Build updated summaries
    const weekSummaries = plan.weeks.map(w => ({
      week: w.weekNumber,
      phase: w.phase,
      focus: w.focusDescription,
      targetTSS: w.actualTargetTSS,
      days: w.days.map(d => ({
        date: d.date,
        dayOfWeek: d.dayOfWeek,
        isKeyWorkout: d.isKeyWorkout,
        workout: d.workout ? {
          name: d.workout.name,
          category: d.workout.category,
          targetTSS: d.workout.targetTSS,
          targetDurationMinutes: d.workout.targetDurationMinutes,
        } : null,
      })),
    }))

    const projectionSummary = {
      points: projection.points,
      startFitness: { ctl: Math.round(currentCTL), atl: Math.round(currentATL), tsb: Math.round(currentCTL - currentATL) },
      endFitness: { ctl: Math.round(projection.finalCTL), atl: Math.round(projection.finalATL), tsb: Math.round(projection.finalTSB) },
      peakCTL: projection.peakCTL,
      peakCTLDate: projection.peakCTLDate,
      ctlGain: projection.ctlGain,
      eventFitness: projection.eventFitness,
    }

    return {
      success: true,
      planId,
      status: 'draft',
      modificationsApplied: modifications,
      plan: {
        name: plan.templateName,
        goal: plan.goal,
        description: plan.description,
        duration: `${plan.durationWeeks} weeks`,
        dates: `${plan.startDate} to ${plan.endDate}`,
        weeklyHoursTarget: plan.weeklyHoursTarget,
      },
      weekSummaries,
      projection: projectionSummary,
      canvasWidgets: [
        {
          type: 'plan-proposal',
          insight: `Updated plan — ${plan.weeklyHoursTarget}h/week, ${plan.durationWeeks} weeks. Review the changes below.`,
          config: {
            planId,
            planName: plan.templateName,
            weekSummaries,
            targetEventDate: existingPlan.target_event_date,
            startDate: plan.startDate,
            endDate: plan.endDate,
          },
        },
        {
          type: 'plan-projection',
          insight: `Updated projection: CTL ${Math.round(currentCTL)} → ${Math.round(projection.finalCTL)} (+${projection.ctlGain}).`,
          config: {
            projection: projectionSummary,
            planId,
          },
        },
      ],
      tip: 'The plan has been updated. Review the new calendar and projection. Tell me to accept it, or ask for more changes.',
    }
  },
})

// ============================================================
// ACCEPT PROPOSAL
// ============================================================

const acceptProposalInputSchema = z.object({
  planId: z.string().describe('ID of the draft plan to accept'),
})

type AcceptProposalInput = z.infer<typeof acceptProposalInputSchema>

export const acceptProposal = defineTool<AcceptProposalInput, unknown>({
  description: `Accept a draft training plan proposal, making it the active plan. Deactivates any existing active plan. Use when the athlete confirms they want to follow the proposed plan.`,

  inputSchema: acceptProposalInputSchema,

  execute: async ({ planId }, ctx) => {
    if (!ctx.athleteId) {
      return { error: 'No athlete ID available.' }
    }

    // Get the draft plan
    const draftPlan = await getTrainingPlanFromDB(planId)
    if (!draftPlan) {
      return { error: 'Plan not found.' }
    }

    if (draftPlan.status !== 'draft') {
      return { error: `Plan is already ${draftPlan.status}. Only draft plans can be accepted.` }
    }

    // Deactivate any existing active plan
    const existingActive = await getActivePlanFromDB(ctx.athleteId)
    if (existingActive) {
      await updateTrainingPlan(existingActive.id, { status: 'abandoned' })
    }

    // Activate the draft plan
    await updateTrainingPlan(planId, { status: 'active' })

    // Get first week's workouts for confirmation
    const today = new Date()
    const weekEnd = new Date(today)
    weekEnd.setDate(today.getDate() + 7)
    const firstWeekDays = await getPlanDays(planId, {
      startDate: today.toISOString().split('T')[0],
      endDate: weekEnd.toISOString().split('T')[0],
    })

    const firstWeekSchedule = firstWeekDays
      .filter(d => d.workout_name)
      .map(d => ({
        date: d.date,
        day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.day_of_week],
        workout: d.workout_name,
        type: d.workout_type,
        targetTSS: d.target_tss,
        targetDuration: d.target_duration_minutes,
      }))

    return {
      success: true,
      planId,
      status: 'active',
      plan: {
        name: draftPlan.name,
        goal: draftPlan.goal,
        duration: `${draftPlan.duration_weeks} weeks`,
        dates: `${draftPlan.start_date} to ${draftPlan.end_date}`,
      },
      firstWeekSchedule,
      previousPlanDeactivated: existingActive ? existingActive.name : null,
      message: `Your "${draftPlan.name}" plan is now active! I'll track your progress as you complete workouts.`,
      tip: firstWeekSchedule.length > 0
        ? `This week: ${firstWeekSchedule.map(d => `${d.day}: ${d.workout}`).join(', ')}. Say "show my plan" anytime to see details.`
        : 'Your plan starts soon. Say "show my plan" to see the full schedule.',
    }
  },
})
