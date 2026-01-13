// Training Plan Templates
// Phase 4: Structured multi-week training plans

import type { WorkoutCategory, TrainingPhase } from '../workouts/library'

export type PlanGoal = 'base_build' | 'ftp_build' | 'event_prep' | 'taper' | 'maintenance'

export interface WeekTemplate {
  weekNumber: number
  phase: TrainingPhase
  focusDescription: string
  targetTSSRange: [number, number]  // Min, max weekly TSS as % of baseline
  keyWorkouts: Array<{
    dayOffset: number  // 0 = first key day, 1 = second key day, etc.
    category: WorkoutCategory
    preferredWorkoutIds?: string[]  // Specific workouts to prefer
    targetTSSPercent: number  // % of weekly TSS for this workout
    notes?: string
  }>
  recoveryDays: number  // Suggested recovery days
  intensityDistribution: {
    zone1_2: number  // % time in Z1-Z2
    zone3_4: number  // % time in Z3-Z4 (tempo/sweetspot)
    zone5_plus: number  // % time in Z5+ (threshold+)
  }
}

export interface PlanTemplate {
  id: string
  name: string
  goal: PlanGoal
  description: string
  durationWeeks: number

  // Prerequisites
  minCTL: number
  maxCTL?: number
  suitableFor: string[]  // e.g., ['time-crunched', 'high-volume', 'returning from break']

  // Structure
  weeks: WeekTemplate[]

  // Recovery patterns
  recoveryWeekFrequency: number  // e.g., every 3 weeks = 3
  recoveryWeekLoadReduction: number  // e.g., 0.6 = 60% of normal load

  // Progression
  weeklyTSSProgression: number[]  // Multiplier for each week (1.0 = baseline)

  // Tags for search/matching
  tags: string[]
}

// ============================================
// 4-WEEK BASE BUILD PLAN
// ============================================

export const baseBuilding4Week: PlanTemplate = {
  id: 'base_build_4week',
  name: '4-Week Base Building',
  goal: 'base_build',
  description: 'Foundation building plan focused on aerobic development through Zone 2 work with progressive volume increase. Perfect for starting a new season or returning from a break.',
  durationWeeks: 4,

  minCTL: 20,
  maxCTL: 60,
  suitableFor: ['returning from break', 'new season', 'aerobic development'],

  weeks: [
    {
      weekNumber: 1,
      phase: 'base',
      focusDescription: 'Establish rhythm - easy aerobic work with one tempo touchpoint',
      targetTSSRange: [85, 95],
      keyWorkouts: [
        { dayOffset: 0, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_60', 'endurance_zone2_90'], targetTSSPercent: 25, notes: 'Zone 2 foundation ride' },
        { dayOffset: 1, category: 'tempo', preferredWorkoutIds: ['tempo_3x10'], targetTSSPercent: 25, notes: 'Light tempo to maintain some intensity' },
        { dayOffset: 2, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_90', 'endurance_zone2_120'], targetTSSPercent: 35, notes: 'Longer Zone 2 ride' },
      ],
      recoveryDays: 2,
      intensityDistribution: { zone1_2: 80, zone3_4: 18, zone5_plus: 2 },
    },
    {
      weekNumber: 2,
      phase: 'base',
      focusDescription: 'Build volume - longer endurance rides',
      targetTSSRange: [95, 105],
      keyWorkouts: [
        { dayOffset: 0, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_90'], targetTSSPercent: 25 },
        { dayOffset: 1, category: 'sweetspot', preferredWorkoutIds: ['sweetspot_3x10'], targetTSSPercent: 28, notes: 'Introduce sweet spot' },
        { dayOffset: 2, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_120'], targetTSSPercent: 35 },
      ],
      recoveryDays: 2,
      intensityDistribution: { zone1_2: 75, zone3_4: 22, zone5_plus: 3 },
    },
    {
      weekNumber: 3,
      phase: 'base',
      focusDescription: 'Peak volume week - push duration',
      targetTSSRange: [105, 115],
      keyWorkouts: [
        { dayOffset: 0, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_90', 'endurance_progressive'], targetTSSPercent: 25 },
        { dayOffset: 1, category: 'sweetspot', preferredWorkoutIds: ['sweetspot_2x20'], targetTSSPercent: 28, notes: 'Build to 2x20 sweet spot' },
        { dayOffset: 2, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_120', 'endurance_zone2_180'], targetTSSPercent: 35, notes: 'Long ride - biggest of block' },
      ],
      recoveryDays: 2,
      intensityDistribution: { zone1_2: 72, zone3_4: 25, zone5_plus: 3 },
    },
    {
      weekNumber: 4,
      phase: 'recovery',
      focusDescription: 'Recovery week - absorb adaptations',
      targetTSSRange: [60, 70],
      keyWorkouts: [
        { dayOffset: 0, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_60'], targetTSSPercent: 30 },
        { dayOffset: 1, category: 'recovery', preferredWorkoutIds: ['recovery_easy_spin', 'recovery_openers'], targetTSSPercent: 20, notes: 'Very easy - feel the legs' },
        { dayOffset: 2, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_90'], targetTSSPercent: 35 },
      ],
      recoveryDays: 3,
      intensityDistribution: { zone1_2: 90, zone3_4: 8, zone5_plus: 2 },
    },
  ],

  recoveryWeekFrequency: 4,
  recoveryWeekLoadReduction: 0.65,
  weeklyTSSProgression: [1.0, 1.1, 1.2, 0.65],

  tags: ['base', 'aerobic', 'zone 2', 'foundation', 'beginner-friendly'],
}

// ============================================
// 8-WEEK FTP BUILD PLAN
// ============================================

export const ftpBuild8Week: PlanTemplate = {
  id: 'ftp_build_8week',
  name: '8-Week FTP Builder',
  goal: 'ftp_build',
  description: 'Structured plan to increase FTP through progressive threshold and sweet spot work. Includes two 3-week build blocks with recovery weeks.',
  durationWeeks: 8,

  minCTL: 40,
  suitableFor: ['FTP improvement', 'time trialists', 'climbers'],

  weeks: [
    // Block 1: Foundation
    {
      weekNumber: 1,
      phase: 'build',
      focusDescription: 'Establish intensity baseline with sweet spot introduction',
      targetTSSRange: [90, 100],
      keyWorkouts: [
        { dayOffset: 0, category: 'sweetspot', preferredWorkoutIds: ['sweetspot_3x10'], targetTSSPercent: 28 },
        { dayOffset: 1, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_90'], targetTSSPercent: 25 },
        { dayOffset: 2, category: 'sweetspot', preferredWorkoutIds: ['sweetspot_2x20'], targetTSSPercent: 32 },
      ],
      recoveryDays: 2,
      intensityDistribution: { zone1_2: 60, zone3_4: 35, zone5_plus: 5 },
    },
    {
      weekNumber: 2,
      phase: 'build',
      focusDescription: 'Build sweet spot volume',
      targetTSSRange: [100, 110],
      keyWorkouts: [
        { dayOffset: 0, category: 'sweetspot', preferredWorkoutIds: ['sweetspot_2x20'], targetTSSPercent: 30 },
        { dayOffset: 1, category: 'threshold', preferredWorkoutIds: ['threshold_3x8'], targetTSSPercent: 25, notes: 'First threshold work' },
        { dayOffset: 2, category: 'sweetspot', preferredWorkoutIds: ['sweetspot_3x15'], targetTSSPercent: 32 },
      ],
      recoveryDays: 2,
      intensityDistribution: { zone1_2: 55, zone3_4: 35, zone5_plus: 10 },
    },
    {
      weekNumber: 3,
      phase: 'build',
      focusDescription: 'Peak sweet spot week - push duration',
      targetTSSRange: [110, 120],
      keyWorkouts: [
        { dayOffset: 0, category: 'sweetspot', preferredWorkoutIds: ['sweetspot_3x15', 'sweetspot_over_under'], targetTSSPercent: 30 },
        { dayOffset: 1, category: 'threshold', preferredWorkoutIds: ['threshold_3x10'], targetTSSPercent: 28 },
        { dayOffset: 2, category: 'sweetspot', preferredWorkoutIds: ['sweetspot_2x30'], targetTSSPercent: 32, notes: 'Big sweet spot session' },
      ],
      recoveryDays: 2,
      intensityDistribution: { zone1_2: 50, zone3_4: 38, zone5_plus: 12 },
    },
    {
      weekNumber: 4,
      phase: 'recovery',
      focusDescription: 'Recovery week - absorb adaptations from Block 1',
      targetTSSRange: [60, 70],
      keyWorkouts: [
        { dayOffset: 0, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_60'], targetTSSPercent: 30 },
        { dayOffset: 1, category: 'recovery', preferredWorkoutIds: ['recovery_easy_spin'], targetTSSPercent: 20 },
        { dayOffset: 2, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_90'], targetTSSPercent: 35 },
      ],
      recoveryDays: 3,
      intensityDistribution: { zone1_2: 88, zone3_4: 10, zone5_plus: 2 },
    },
    // Block 2: Threshold Focus
    {
      weekNumber: 5,
      phase: 'build',
      focusDescription: 'Begin threshold focus - building on sweet spot base',
      targetTSSRange: [95, 105],
      keyWorkouts: [
        { dayOffset: 0, category: 'threshold', preferredWorkoutIds: ['threshold_3x10'], targetTSSPercent: 28 },
        { dayOffset: 1, category: 'sweetspot', preferredWorkoutIds: ['sweetspot_over_under'], targetTSSPercent: 25 },
        { dayOffset: 2, category: 'threshold', preferredWorkoutIds: ['threshold_2x20'], targetTSSPercent: 32, notes: 'Key FTP session' },
      ],
      recoveryDays: 2,
      intensityDistribution: { zone1_2: 50, zone3_4: 32, zone5_plus: 18 },
    },
    {
      weekNumber: 6,
      phase: 'build',
      focusDescription: 'Build threshold volume',
      targetTSSRange: [105, 115],
      keyWorkouts: [
        { dayOffset: 0, category: 'threshold', preferredWorkoutIds: ['threshold_2x20'], targetTSSPercent: 30 },
        { dayOffset: 1, category: 'vo2max', preferredWorkoutIds: ['vo2max_6x3'], targetTSSPercent: 25, notes: 'VO2 work to lift ceiling' },
        { dayOffset: 2, category: 'threshold', preferredWorkoutIds: ['threshold_3x15'], targetTSSPercent: 32 },
      ],
      recoveryDays: 2,
      intensityDistribution: { zone1_2: 45, zone3_4: 30, zone5_plus: 25 },
    },
    {
      weekNumber: 7,
      phase: 'build',
      focusDescription: 'Peak threshold week - FTP breakthrough',
      targetTSSRange: [115, 125],
      keyWorkouts: [
        { dayOffset: 0, category: 'threshold', preferredWorkoutIds: ['threshold_3x15'], targetTSSPercent: 30 },
        { dayOffset: 1, category: 'vo2max', preferredWorkoutIds: ['vo2max_5x4', 'vo2max_5x5'], targetTSSPercent: 25 },
        { dayOffset: 2, category: 'threshold', preferredWorkoutIds: ['threshold_40min_tt'], targetTSSPercent: 32, notes: 'FTP test/breakthrough attempt' },
      ],
      recoveryDays: 2,
      intensityDistribution: { zone1_2: 42, zone3_4: 28, zone5_plus: 30 },
    },
    {
      weekNumber: 8,
      phase: 'recovery',
      focusDescription: 'Final recovery - consolidate gains',
      targetTSSRange: [55, 65],
      keyWorkouts: [
        { dayOffset: 0, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_60'], targetTSSPercent: 30 },
        { dayOffset: 1, category: 'recovery', preferredWorkoutIds: ['recovery_easy_spin', 'recovery_openers'], targetTSSPercent: 20 },
        { dayOffset: 2, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_90'], targetTSSPercent: 35 },
      ],
      recoveryDays: 3,
      intensityDistribution: { zone1_2: 90, zone3_4: 8, zone5_plus: 2 },
    },
  ],

  recoveryWeekFrequency: 4,
  recoveryWeekLoadReduction: 0.6,
  weeklyTSSProgression: [1.0, 1.1, 1.2, 0.6, 1.0, 1.1, 1.2, 0.55],

  tags: ['FTP', 'threshold', 'sweet spot', 'build', 'power'],
}

// ============================================
// 3-WEEK TAPER PLAN
// ============================================

export const taper3Week: PlanTemplate = {
  id: 'taper_3week',
  name: '3-Week Pre-Event Taper',
  goal: 'taper',
  description: 'Progressive load reduction leading to peak freshness for a goal event. Maintains intensity while reducing volume to optimize form.',
  durationWeeks: 3,

  minCTL: 50,
  suitableFor: ['pre-race', 'A event', 'peak performance'],

  weeks: [
    {
      weekNumber: 1,
      phase: 'taper',
      focusDescription: 'Begin taper - reduce volume, maintain intensity',
      targetTSSRange: [70, 80],
      keyWorkouts: [
        { dayOffset: 0, category: 'threshold', preferredWorkoutIds: ['threshold_3x8'], targetTSSPercent: 30, notes: 'Keep intensity sharp' },
        { dayOffset: 1, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_60'], targetTSSPercent: 22 },
        { dayOffset: 2, category: 'vo2max', preferredWorkoutIds: ['vo2max_6x3'], targetTSSPercent: 28, notes: 'Short sharp VO2 work' },
      ],
      recoveryDays: 2,
      intensityDistribution: { zone1_2: 60, zone3_4: 20, zone5_plus: 20 },
    },
    {
      weekNumber: 2,
      phase: 'taper',
      focusDescription: 'Deeper taper - more rest, intensity touchpoints only',
      targetTSSRange: [50, 60],
      keyWorkouts: [
        { dayOffset: 0, category: 'sweetspot', preferredWorkoutIds: ['sweetspot_3x10'], targetTSSPercent: 30 },
        { dayOffset: 1, category: 'recovery', preferredWorkoutIds: ['recovery_easy_spin'], targetTSSPercent: 18 },
        { dayOffset: 2, category: 'threshold', preferredWorkoutIds: ['threshold_3x8'], targetTSSPercent: 28, notes: 'Keep legs used to race pace' },
      ],
      recoveryDays: 3,
      intensityDistribution: { zone1_2: 65, zone3_4: 20, zone5_plus: 15 },
    },
    {
      weekNumber: 3,
      phase: 'peak',
      focusDescription: 'Race week - openers and rest',
      targetTSSRange: [30, 40],
      keyWorkouts: [
        { dayOffset: 0, category: 'recovery', preferredWorkoutIds: ['recovery_openers'], targetTSSPercent: 35, notes: 'Mid-week openers' },
        { dayOffset: 1, category: 'recovery', preferredWorkoutIds: ['recovery_easy_spin', 'recovery_flush'], targetTSSPercent: 25, notes: 'Day before pre-ride' },
        // Day 2 would be race day
      ],
      recoveryDays: 4,
      intensityDistribution: { zone1_2: 70, zone3_4: 15, zone5_plus: 15 },
    },
  ],

  recoveryWeekFrequency: 0, // No recovery weeks in taper
  recoveryWeekLoadReduction: 1.0,
  weeklyTSSProgression: [0.75, 0.5, 0.3],

  tags: ['taper', 'race prep', 'peak', 'event'],
}

// ============================================
// 12-WEEK EVENT PREP PLAN
// ============================================

export const eventPrep12Week: PlanTemplate = {
  id: 'event_prep_12week',
  name: '12-Week Event Preparation',
  goal: 'event_prep',
  description: 'Complete preparation cycle for a goal event. Includes base, build, peak, and taper phases with progressive specificity toward race demands.',
  durationWeeks: 12,

  minCTL: 35,
  suitableFor: ['A race', 'goal event', 'comprehensive prep'],

  weeks: [
    // Phase 1: Base (Weeks 1-3)
    {
      weekNumber: 1,
      phase: 'base',
      focusDescription: 'Establish base - aerobic focus',
      targetTSSRange: [85, 95],
      keyWorkouts: [
        { dayOffset: 0, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_90'], targetTSSPercent: 28 },
        { dayOffset: 1, category: 'tempo', preferredWorkoutIds: ['tempo_3x10'], targetTSSPercent: 25 },
        { dayOffset: 2, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_120'], targetTSSPercent: 35 },
      ],
      recoveryDays: 2,
      intensityDistribution: { zone1_2: 78, zone3_4: 20, zone5_plus: 2 },
    },
    {
      weekNumber: 2,
      phase: 'base',
      focusDescription: 'Build base volume',
      targetTSSRange: [95, 105],
      keyWorkouts: [
        { dayOffset: 0, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_90', 'endurance_progressive'], targetTSSPercent: 28 },
        { dayOffset: 1, category: 'sweetspot', preferredWorkoutIds: ['sweetspot_3x10'], targetTSSPercent: 25 },
        { dayOffset: 2, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_120'], targetTSSPercent: 35 },
      ],
      recoveryDays: 2,
      intensityDistribution: { zone1_2: 72, zone3_4: 25, zone5_plus: 3 },
    },
    {
      weekNumber: 3,
      phase: 'base',
      focusDescription: 'Peak base volume',
      targetTSSRange: [105, 115],
      keyWorkouts: [
        { dayOffset: 0, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_90'], targetTSSPercent: 25 },
        { dayOffset: 1, category: 'sweetspot', preferredWorkoutIds: ['sweetspot_2x20'], targetTSSPercent: 28 },
        { dayOffset: 2, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_180'], targetTSSPercent: 38, notes: 'Long ride week' },
      ],
      recoveryDays: 2,
      intensityDistribution: { zone1_2: 70, zone3_4: 27, zone5_plus: 3 },
    },
    {
      weekNumber: 4,
      phase: 'recovery',
      focusDescription: 'Recovery week - absorb base adaptations',
      targetTSSRange: [60, 70],
      keyWorkouts: [
        { dayOffset: 0, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_60'], targetTSSPercent: 30 },
        { dayOffset: 1, category: 'recovery', preferredWorkoutIds: ['recovery_easy_spin'], targetTSSPercent: 20 },
        { dayOffset: 2, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_90'], targetTSSPercent: 35 },
      ],
      recoveryDays: 3,
      intensityDistribution: { zone1_2: 88, zone3_4: 10, zone5_plus: 2 },
    },
    // Phase 2: Build (Weeks 5-8)
    {
      weekNumber: 5,
      phase: 'build',
      focusDescription: 'Begin build phase - introduce threshold',
      targetTSSRange: [95, 105],
      keyWorkouts: [
        { dayOffset: 0, category: 'sweetspot', preferredWorkoutIds: ['sweetspot_2x20'], targetTSSPercent: 28 },
        { dayOffset: 1, category: 'threshold', preferredWorkoutIds: ['threshold_3x8'], targetTSSPercent: 25 },
        { dayOffset: 2, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_120'], targetTSSPercent: 32 },
      ],
      recoveryDays: 2,
      intensityDistribution: { zone1_2: 58, zone3_4: 30, zone5_plus: 12 },
    },
    {
      weekNumber: 6,
      phase: 'build',
      focusDescription: 'Build intensity volume',
      targetTSSRange: [105, 115],
      keyWorkouts: [
        { dayOffset: 0, category: 'threshold', preferredWorkoutIds: ['threshold_3x10'], targetTSSPercent: 28 },
        { dayOffset: 1, category: 'vo2max', preferredWorkoutIds: ['vo2max_6x3'], targetTSSPercent: 25, notes: 'First VO2 work' },
        { dayOffset: 2, category: 'sweetspot', preferredWorkoutIds: ['sweetspot_3x15', 'sweetspot_over_under'], targetTSSPercent: 32 },
      ],
      recoveryDays: 2,
      intensityDistribution: { zone1_2: 52, zone3_4: 28, zone5_plus: 20 },
    },
    {
      weekNumber: 7,
      phase: 'build',
      focusDescription: 'Peak build week',
      targetTSSRange: [115, 125],
      keyWorkouts: [
        { dayOffset: 0, category: 'threshold', preferredWorkoutIds: ['threshold_2x20'], targetTSSPercent: 30 },
        { dayOffset: 1, category: 'vo2max', preferredWorkoutIds: ['vo2max_5x4'], targetTSSPercent: 25 },
        { dayOffset: 2, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_120'], targetTSSPercent: 32 },
      ],
      recoveryDays: 2,
      intensityDistribution: { zone1_2: 50, zone3_4: 25, zone5_plus: 25 },
    },
    {
      weekNumber: 8,
      phase: 'recovery',
      focusDescription: 'Recovery week - absorb build adaptations',
      targetTSSRange: [60, 70],
      keyWorkouts: [
        { dayOffset: 0, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_60'], targetTSSPercent: 30 },
        { dayOffset: 1, category: 'recovery', preferredWorkoutIds: ['recovery_easy_spin'], targetTSSPercent: 20 },
        { dayOffset: 2, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_90'], targetTSSPercent: 35 },
      ],
      recoveryDays: 3,
      intensityDistribution: { zone1_2: 88, zone3_4: 10, zone5_plus: 2 },
    },
    // Phase 3: Peak/Specificity (Weeks 9-10)
    {
      weekNumber: 9,
      phase: 'peak',
      focusDescription: 'Peak phase - race-specific intensity',
      targetTSSRange: [90, 100],
      keyWorkouts: [
        { dayOffset: 0, category: 'vo2max', preferredWorkoutIds: ['vo2max_5x5'], targetTSSPercent: 28 },
        { dayOffset: 1, category: 'threshold', preferredWorkoutIds: ['threshold_2x20'], targetTSSPercent: 28 },
        { dayOffset: 2, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_90'], targetTSSPercent: 30 },
      ],
      recoveryDays: 2,
      intensityDistribution: { zone1_2: 52, zone3_4: 20, zone5_plus: 28 },
    },
    {
      weekNumber: 10,
      phase: 'peak',
      focusDescription: 'Final peak week - maintain sharpness',
      targetTSSRange: [80, 90],
      keyWorkouts: [
        { dayOffset: 0, category: 'threshold', preferredWorkoutIds: ['threshold_3x10'], targetTSSPercent: 30 },
        { dayOffset: 1, category: 'anaerobic', preferredWorkoutIds: ['anaerobic_30_30', 'anaerobic_1min'], targetTSSPercent: 22, notes: 'Race-specific efforts' },
        { dayOffset: 2, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_60'], targetTSSPercent: 28 },
      ],
      recoveryDays: 2,
      intensityDistribution: { zone1_2: 58, zone3_4: 18, zone5_plus: 24 },
    },
    // Phase 4: Taper (Weeks 11-12)
    {
      weekNumber: 11,
      phase: 'taper',
      focusDescription: 'Begin taper - reduce volume, keep intensity',
      targetTSSRange: [55, 65],
      keyWorkouts: [
        { dayOffset: 0, category: 'threshold', preferredWorkoutIds: ['threshold_3x8'], targetTSSPercent: 30 },
        { dayOffset: 1, category: 'recovery', preferredWorkoutIds: ['recovery_easy_spin'], targetTSSPercent: 20 },
        { dayOffset: 2, category: 'vo2max', preferredWorkoutIds: ['vo2max_6x3'], targetTSSPercent: 28, notes: 'Short sharp efforts' },
      ],
      recoveryDays: 3,
      intensityDistribution: { zone1_2: 60, zone3_4: 20, zone5_plus: 20 },
    },
    {
      weekNumber: 12,
      phase: 'peak',
      focusDescription: 'Race week - openers and rest',
      targetTSSRange: [30, 40],
      keyWorkouts: [
        { dayOffset: 0, category: 'recovery', preferredWorkoutIds: ['recovery_openers'], targetTSSPercent: 35 },
        { dayOffset: 1, category: 'recovery', preferredWorkoutIds: ['recovery_easy_spin', 'recovery_flush'], targetTSSPercent: 25 },
      ],
      recoveryDays: 4,
      intensityDistribution: { zone1_2: 70, zone3_4: 15, zone5_plus: 15 },
    },
  ],

  recoveryWeekFrequency: 4,
  recoveryWeekLoadReduction: 0.6,
  weeklyTSSProgression: [1.0, 1.1, 1.2, 0.6, 1.0, 1.1, 1.2, 0.6, 0.95, 0.85, 0.55, 0.3],

  tags: ['event prep', 'race', 'complete cycle', 'periodization', 'A event'],
}

// ============================================
// MAINTENANCE PLAN (4 weeks, repeatable)
// ============================================

export const maintenance4Week: PlanTemplate = {
  id: 'maintenance_4week',
  name: '4-Week Maintenance',
  goal: 'maintenance',
  description: 'Maintain current fitness during busy periods or between goal events. Balanced workload with variety to prevent staleness.',
  durationWeeks: 4,

  minCTL: 40,
  suitableFor: ['maintenance', 'busy schedule', 'between events'],

  weeks: [
    {
      weekNumber: 1,
      phase: 'any',
      focusDescription: 'Balanced week - mixed intensities',
      targetTSSRange: [90, 100],
      keyWorkouts: [
        { dayOffset: 0, category: 'sweetspot', preferredWorkoutIds: ['sweetspot_2x20'], targetTSSPercent: 28 },
        { dayOffset: 1, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_90'], targetTSSPercent: 28 },
        { dayOffset: 2, category: 'threshold', preferredWorkoutIds: ['threshold_3x8'], targetTSSPercent: 28 },
      ],
      recoveryDays: 2,
      intensityDistribution: { zone1_2: 60, zone3_4: 28, zone5_plus: 12 },
    },
    {
      weekNumber: 2,
      phase: 'any',
      focusDescription: 'VO2 focus week',
      targetTSSRange: [90, 100],
      keyWorkouts: [
        { dayOffset: 0, category: 'vo2max', preferredWorkoutIds: ['vo2max_6x3', 'vo2max_5x4'], targetTSSPercent: 26 },
        { dayOffset: 1, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_90'], targetTSSPercent: 28 },
        { dayOffset: 2, category: 'sweetspot', preferredWorkoutIds: ['sweetspot_3x10'], targetTSSPercent: 28 },
      ],
      recoveryDays: 2,
      intensityDistribution: { zone1_2: 58, zone3_4: 24, zone5_plus: 18 },
    },
    {
      weekNumber: 3,
      phase: 'any',
      focusDescription: 'Endurance focus week',
      targetTSSRange: [95, 105],
      keyWorkouts: [
        { dayOffset: 0, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_90', 'endurance_progressive'], targetTSSPercent: 28 },
        { dayOffset: 1, category: 'tempo', preferredWorkoutIds: ['tempo_2x20', 'tempo_continuous'], targetTSSPercent: 25 },
        { dayOffset: 2, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_120'], targetTSSPercent: 35 },
      ],
      recoveryDays: 2,
      intensityDistribution: { zone1_2: 72, zone3_4: 25, zone5_plus: 3 },
    },
    {
      weekNumber: 4,
      phase: 'recovery',
      focusDescription: 'Easy week - reset',
      targetTSSRange: [60, 70],
      keyWorkouts: [
        { dayOffset: 0, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_60'], targetTSSPercent: 30 },
        { dayOffset: 1, category: 'recovery', preferredWorkoutIds: ['recovery_easy_spin'], targetTSSPercent: 20 },
        { dayOffset: 2, category: 'endurance', preferredWorkoutIds: ['endurance_zone2_90'], targetTSSPercent: 35 },
      ],
      recoveryDays: 3,
      intensityDistribution: { zone1_2: 88, zone3_4: 10, zone5_plus: 2 },
    },
  ],

  recoveryWeekFrequency: 4,
  recoveryWeekLoadReduction: 0.65,
  weeklyTSSProgression: [1.0, 1.0, 1.05, 0.65],

  tags: ['maintenance', 'balanced', 'sustainable', 'variety'],
}

// ============================================
// EXPORT ALL TEMPLATES
// ============================================

export const planTemplates: PlanTemplate[] = [
  baseBuilding4Week,
  ftpBuild8Week,
  taper3Week,
  eventPrep12Week,
  maintenance4Week,
]

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getPlanTemplateById(id: string): PlanTemplate | undefined {
  return planTemplates.find(t => t.id === id)
}

export function getPlanTemplatesByGoal(goal: PlanGoal): PlanTemplate[] {
  return planTemplates.filter(t => t.goal === goal)
}

export function getApplicablePlans(currentCTL: number): PlanTemplate[] {
  return planTemplates.filter(t =>
    currentCTL >= t.minCTL &&
    (t.maxCTL === undefined || currentCTL <= t.maxCTL)
  )
}

export function searchPlanTemplates(query: string): PlanTemplate[] {
  const lowerQuery = query.toLowerCase()
  return planTemplates.filter(t =>
    t.name.toLowerCase().includes(lowerQuery) ||
    t.description.toLowerCase().includes(lowerQuery) ||
    t.tags.some(tag => tag.includes(lowerQuery))
  )
}

export function getPlanTemplateSummary(): Array<{
  id: string
  name: string
  goal: PlanGoal
  durationWeeks: number
  minCTL: number
  description: string
}> {
  return planTemplates.map(t => ({
    id: t.id,
    name: t.name,
    goal: t.goal,
    durationWeeks: t.durationWeeks,
    minCTL: t.minCTL,
    description: t.description,
  }))
}
