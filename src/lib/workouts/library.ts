// Comprehensive Workout Library
// 30+ structured workout templates with metadata for intelligent selection

export type WorkoutCategory =
  | 'recovery'
  | 'endurance'
  | 'tempo'
  | 'sweetspot'
  | 'threshold'
  | 'vo2max'
  | 'anaerobic'
  | 'sprint'
  | 'mixed'

export type EnergySystem = 'aerobic' | 'threshold' | 'vo2max' | 'anaerobic' | 'neuromuscular'

export type TrainingPhase = 'base' | 'build' | 'peak' | 'taper' | 'recovery' | 'any'

export interface WorkoutInterval {
  sets: number
  duration_seconds: number
  rest_seconds: number
  intensity_min: number // % of FTP
  intensity_max: number // % of FTP
  cadence_target?: number
  notes?: string
}

export interface WorkoutPrerequisites {
  min_ctl?: number          // Minimum fitness level
  max_ctl?: number          // Maximum (some workouts for beginners only)
  min_tsb?: number          // Minimum freshness required
  max_tsb?: number          // Maximum (don't do easy workouts when very fresh)
  min_days_since_intensity?: number  // Days since last hard workout
  not_after_types?: WorkoutCategory[] // Don't do after these workout types
  required_equipment?: string[]
}

export interface WorkoutTemplate {
  id: string
  name: string
  category: WorkoutCategory
  energy_systems: EnergySystem[]
  suitable_phases: TrainingPhase[]

  // Structure
  duration_minutes: number
  warmup_minutes: number
  cooldown_minutes: number
  intervals?: WorkoutInterval[]

  // Metrics
  target_tss_range: [number, number]  // min, max TSS
  intensity_factor_range: [number, number] // min, max IF

  // Guidance
  description: string
  purpose: string
  execution_tips: string[]
  common_mistakes: string[]

  // Prerequisites
  prerequisites: WorkoutPrerequisites

  // Progression
  easier_alternative?: string  // ID of easier workout
  harder_progression?: string  // ID of harder workout

  // Tags for search
  tags: string[]
}

// ============================================
// RECOVERY WORKOUTS (3)
// ============================================

const recoveryWorkouts: WorkoutTemplate[] = [
  {
    id: 'recovery_easy_spin',
    name: 'Easy Recovery Spin',
    category: 'recovery',
    energy_systems: ['aerobic'],
    suitable_phases: ['any'],
    duration_minutes: 45,
    warmup_minutes: 0,
    cooldown_minutes: 0,
    target_tss_range: [15, 30],
    intensity_factor_range: [0.5, 0.6],
    description: 'Very easy spin keeping power below 55% FTP. Focus on smooth pedaling and relaxation.',
    purpose: 'Active recovery to promote blood flow without adding training stress. Helps clear metabolic waste from previous hard efforts.',
    execution_tips: [
      'Keep cadence high (90-100 rpm)',
      'Power should feel effortless',
      'Stop if you feel any fatigue',
    ],
    common_mistakes: [
      'Going too hard - this should feel almost too easy',
      'Extending duration thinking more is better',
    ],
    prerequisites: {
      max_tsb: 10, // Don't do recovery ride if very fresh
    },
    harder_progression: 'endurance_zone2_60',
    tags: ['recovery', 'easy', 'active recovery', 'day after'],
  },
  {
    id: 'recovery_flush',
    name: 'Recovery Flush Ride',
    category: 'recovery',
    energy_systems: ['aerobic'],
    suitable_phases: ['any'],
    duration_minutes: 30,
    warmup_minutes: 0,
    cooldown_minutes: 0,
    target_tss_range: [10, 20],
    intensity_factor_range: [0.45, 0.55],
    description: 'Short, very easy spin. Perfect for day after racing or very hard training.',
    purpose: 'Minimal stress recovery ride to get blood flowing without any training stimulus.',
    execution_tips: [
      'Keep it short - 30 minutes max',
      'Stay seated, relaxed grip',
      'Can be done on trainer or flat roads',
    ],
    common_mistakes: [
      'Making it too long',
      'Adding any intensity whatsoever',
    ],
    prerequisites: {
      min_days_since_intensity: 0, // Can do day after hard effort
    },
    harder_progression: 'recovery_easy_spin',
    tags: ['recovery', 'flush', 'post-race', 'very easy'],
  },
  {
    id: 'recovery_openers',
    name: 'Pre-Event Openers',
    category: 'recovery',
    energy_systems: ['aerobic', 'neuromuscular'],
    suitable_phases: ['peak', 'taper'],
    duration_minutes: 45,
    warmup_minutes: 15,
    cooldown_minutes: 15,
    intervals: [
      { sets: 3, duration_seconds: 30, rest_seconds: 180, intensity_min: 120, intensity_max: 150, notes: 'Short sharp efforts to activate legs' },
    ],
    target_tss_range: [25, 40],
    intensity_factor_range: [0.55, 0.7],
    description: 'Easy ride with 3x30s hard efforts to open up legs before an event.',
    purpose: 'Activate neuromuscular system and prime legs without adding fatigue before competition.',
    execution_tips: [
      'Do this ride day before or morning of event',
      'Keep base ride very easy',
      'Efforts should feel sharp but not draining',
    ],
    common_mistakes: [
      'Making opener efforts too long',
      'Doing too many openers',
      'Going too hard on easy portions',
    ],
    prerequisites: {
      min_tsb: 5, // Should be somewhat fresh for openers
    },
    tags: ['openers', 'pre-race', 'taper', 'activation'],
  },
]

// ============================================
// ENDURANCE WORKOUTS (5)
// ============================================

const enduranceWorkouts: WorkoutTemplate[] = [
  {
    id: 'endurance_zone2_60',
    name: 'Zone 2 Foundation',
    category: 'endurance',
    energy_systems: ['aerobic'],
    suitable_phases: ['base', 'build', 'any'],
    duration_minutes: 60,
    warmup_minutes: 10,
    cooldown_minutes: 5,
    target_tss_range: [40, 55],
    intensity_factor_range: [0.65, 0.75],
    description: 'Steady Zone 2 ride at 60-75% FTP. Conversational pace throughout.',
    purpose: 'Build aerobic base, improve fat oxidation, develop mitochondrial density.',
    execution_tips: [
      'Should be able to hold a conversation',
      'Nasal breathing test - if you can\'t breathe through nose, slow down',
      'Keep cadence comfortable (85-95 rpm)',
    ],
    common_mistakes: [
      'Riding too hard - Zone 2 should feel easy',
      'Chasing others or Strava segments',
    ],
    prerequisites: {},
    easier_alternative: 'recovery_easy_spin',
    harder_progression: 'endurance_zone2_90',
    tags: ['zone 2', 'aerobic', 'base', 'endurance', 'foundation'],
  },
  {
    id: 'endurance_zone2_90',
    name: 'Zone 2 Builder',
    category: 'endurance',
    energy_systems: ['aerobic'],
    suitable_phases: ['base', 'build'],
    duration_minutes: 90,
    warmup_minutes: 10,
    cooldown_minutes: 5,
    target_tss_range: [55, 75],
    intensity_factor_range: [0.65, 0.75],
    description: '90-minute Zone 2 ride. The workhorse of aerobic development.',
    purpose: 'Extended aerobic stimulus for significant base building. Key workout for endurance foundation.',
    execution_tips: [
      'Bring nutrition - aim for 40-60g carbs per hour',
      'Stay hydrated',
      'Monitor for cardiac drift - if HR rises significantly, back off power',
    ],
    common_mistakes: [
      'Starting too hard and fading',
      'Neglecting nutrition/hydration',
    ],
    prerequisites: {
      min_ctl: 30, // Need some base fitness for 90 min
    },
    easier_alternative: 'endurance_zone2_60',
    harder_progression: 'endurance_zone2_120',
    tags: ['zone 2', 'aerobic', 'base', 'medium-long'],
  },
  {
    id: 'endurance_zone2_120',
    name: 'Long Endurance Ride',
    category: 'endurance',
    energy_systems: ['aerobic'],
    suitable_phases: ['base', 'build'],
    duration_minutes: 120,
    warmup_minutes: 10,
    cooldown_minutes: 5,
    target_tss_range: [75, 100],
    intensity_factor_range: [0.65, 0.75],
    description: '2-hour Zone 2 ride. Foundation for longer events.',
    purpose: 'Build endurance for longer events, train fueling strategy, develop mental stamina.',
    execution_tips: [
      'Practice race nutrition',
      'Include brief standing every 30 minutes',
      'Stay focused on form when tired',
    ],
    common_mistakes: [
      'Going out too hard',
      'Inadequate fueling',
    ],
    prerequisites: {
      min_ctl: 45,
      min_tsb: -15, // Don't do if too fatigued
    },
    easier_alternative: 'endurance_zone2_90',
    harder_progression: 'endurance_zone2_180',
    tags: ['zone 2', 'aerobic', 'long ride', 'endurance'],
  },
  {
    id: 'endurance_zone2_180',
    name: 'Long Aerobic Builder',
    category: 'endurance',
    energy_systems: ['aerobic'],
    suitable_phases: ['base'],
    duration_minutes: 180,
    warmup_minutes: 15,
    cooldown_minutes: 10,
    target_tss_range: [100, 140],
    intensity_factor_range: [0.60, 0.72],
    description: '3-hour Zone 2 ride with optional tempo bursts.',
    purpose: 'Key long ride for building serious endurance. Prepares body for extended efforts.',
    execution_tips: [
      'Eat early and often - 60-90g carbs per hour',
      'Include 2-3 short tempo efforts (5 min) if feeling good',
      'Plan route with bail-out options',
    ],
    common_mistakes: [
      'Attempting without adequate base',
      'Under-fueling',
      'Going too hard early',
    ],
    prerequisites: {
      min_ctl: 60,
      min_tsb: -10,
    },
    easier_alternative: 'endurance_zone2_120',
    tags: ['zone 2', 'long ride', 'big day', 'base building'],
  },
  {
    id: 'endurance_progressive',
    name: 'Progressive Endurance',
    category: 'endurance',
    energy_systems: ['aerobic'],
    suitable_phases: ['base', 'build'],
    duration_minutes: 90,
    warmup_minutes: 15,
    cooldown_minutes: 10,
    intervals: [
      { sets: 1, duration_seconds: 1800, rest_seconds: 0, intensity_min: 60, intensity_max: 65, notes: 'First 30 min - easy Zone 2' },
      { sets: 1, duration_seconds: 1800, rest_seconds: 0, intensity_min: 68, intensity_max: 72, notes: 'Second 30 min - upper Zone 2' },
      { sets: 1, duration_seconds: 900, rest_seconds: 0, intensity_min: 75, intensity_max: 80, notes: 'Last 15 min - low tempo' },
    ],
    target_tss_range: [60, 80],
    intensity_factor_range: [0.68, 0.75],
    description: 'Progressive ride starting easy and building to tempo finish.',
    purpose: 'Builds endurance while practicing negative split pacing. Good mental training.',
    execution_tips: [
      'Start easier than you think',
      'Increase power smoothly, not in jumps',
      'Last 15 minutes should feel comfortably hard',
    ],
    common_mistakes: [
      'Starting too hard',
      'Building too quickly',
    ],
    prerequisites: {
      min_ctl: 35,
    },
    easier_alternative: 'endurance_zone2_90',
    tags: ['progressive', 'negative split', 'pacing practice'],
  },
]

// ============================================
// TEMPO WORKOUTS (4)
// ============================================

const tempoWorkouts: WorkoutTemplate[] = [
  {
    id: 'tempo_3x10',
    name: 'Tempo Intervals 3x10',
    category: 'tempo',
    energy_systems: ['aerobic', 'threshold'],
    suitable_phases: ['base', 'build'],
    duration_minutes: 60,
    warmup_minutes: 15,
    cooldown_minutes: 10,
    intervals: [
      { sets: 3, duration_seconds: 600, rest_seconds: 300, intensity_min: 76, intensity_max: 87 },
    ],
    target_tss_range: [55, 70],
    intensity_factor_range: [0.75, 0.82],
    description: '3x10 minutes at tempo (76-87% FTP) with 5 min recovery.',
    purpose: 'Build muscular endurance and lactate clearance. Good introduction to sustained efforts.',
    execution_tips: [
      'Start each interval at lower end of range',
      'Focus on steady power, not surges',
      'Recovery should be easy spinning',
    ],
    common_mistakes: [
      'Going too hard on first interval',
      'Not recovering enough between intervals',
    ],
    prerequisites: {
      min_ctl: 30,
    },
    harder_progression: 'tempo_3x15',
    tags: ['tempo', 'muscular endurance', 'intervals'],
  },
  {
    id: 'tempo_3x15',
    name: 'Tempo Intervals 3x15',
    category: 'tempo',
    energy_systems: ['aerobic', 'threshold'],
    suitable_phases: ['base', 'build'],
    duration_minutes: 75,
    warmup_minutes: 15,
    cooldown_minutes: 10,
    intervals: [
      { sets: 3, duration_seconds: 900, rest_seconds: 300, intensity_min: 76, intensity_max: 87 },
    ],
    target_tss_range: [65, 80],
    intensity_factor_range: [0.78, 0.84],
    description: '3x15 minutes at tempo with 5 min recovery. Progression from 3x10.',
    purpose: 'Extended tempo efforts build greater muscular endurance and fatigue resistance.',
    execution_tips: [
      'Maintain even power throughout each interval',
      'Mental focus becomes important in final 5 minutes',
      'Stay relaxed - tension wastes energy',
    ],
    common_mistakes: [
      'Fading in third interval',
      'Tensing up when tired',
    ],
    prerequisites: {
      min_ctl: 40,
    },
    easier_alternative: 'tempo_3x10',
    harder_progression: 'tempo_2x20',
    tags: ['tempo', 'muscular endurance', 'progression'],
  },
  {
    id: 'tempo_2x20',
    name: 'Tempo 2x20',
    category: 'tempo',
    energy_systems: ['aerobic', 'threshold'],
    suitable_phases: ['base', 'build'],
    duration_minutes: 70,
    warmup_minutes: 15,
    cooldown_minutes: 10,
    intervals: [
      { sets: 2, duration_seconds: 1200, rest_seconds: 600, intensity_min: 76, intensity_max: 87 },
    ],
    target_tss_range: [60, 75],
    intensity_factor_range: [0.78, 0.84],
    description: '2x20 minutes at tempo with 10 min recovery between.',
    purpose: 'Classic sustained tempo format. Builds ability to hold moderate-hard effort for extended time.',
    execution_tips: [
      '20 minutes is mentally challenging - break into 5-min chunks',
      'Stay aero if possible to simulate race position',
      'Use second interval to prove you can repeat the effort',
    ],
    common_mistakes: [
      'Starting first interval too hard',
      'Giving up mentally in last 5 minutes',
    ],
    prerequisites: {
      min_ctl: 40,
    },
    easier_alternative: 'tempo_3x15',
    harder_progression: 'sweetspot_2x20',
    tags: ['tempo', '2x20', 'sustained effort'],
  },
  {
    id: 'tempo_continuous',
    name: 'Continuous Tempo',
    category: 'tempo',
    energy_systems: ['aerobic', 'threshold'],
    suitable_phases: ['build'],
    duration_minutes: 75,
    warmup_minutes: 15,
    cooldown_minutes: 15,
    intervals: [
      { sets: 1, duration_seconds: 2700, rest_seconds: 0, intensity_min: 76, intensity_max: 85 },
    ],
    target_tss_range: [70, 85],
    intensity_factor_range: [0.78, 0.83],
    description: '45 minutes of continuous tempo. No breaks, no excuses.',
    purpose: 'Mental and physical training for sustained race-pace efforts. Simulates time trial demands.',
    execution_tips: [
      'Start conservatively - you have 45 minutes ahead',
      'Use landmarks to break up the effort mentally',
      'Stay smooth and efficient',
    ],
    common_mistakes: [
      'Starting too hard',
      'Losing focus mid-effort',
    ],
    prerequisites: {
      min_ctl: 50,
      min_tsb: -15,
    },
    easier_alternative: 'tempo_2x20',
    tags: ['tempo', 'continuous', 'time trial', 'mental toughness'],
  },
]

// ============================================
// SWEET SPOT WORKOUTS (5)
// ============================================

const sweetspotWorkouts: WorkoutTemplate[] = [
  {
    id: 'sweetspot_3x10',
    name: 'Sweet Spot 3x10',
    category: 'sweetspot',
    energy_systems: ['aerobic', 'threshold'],
    suitable_phases: ['base', 'build'],
    duration_minutes: 60,
    warmup_minutes: 15,
    cooldown_minutes: 10,
    intervals: [
      { sets: 3, duration_seconds: 600, rest_seconds: 300, intensity_min: 88, intensity_max: 93 },
    ],
    target_tss_range: [60, 75],
    intensity_factor_range: [0.82, 0.88],
    description: '3x10 minutes at sweet spot (88-93% FTP). Introduction to sweet spot training.',
    purpose: 'Time-efficient FTP development. High training stimulus with manageable recovery.',
    execution_tips: [
      'RPE should be 7-8/10 - hard but sustainable',
      'Focus on smooth, consistent power',
      'Recovery should feel easy, not rushed',
    ],
    common_mistakes: [
      'Riding at threshold instead of sweet spot',
      'Too short recovery between intervals',
    ],
    prerequisites: {
      min_ctl: 35,
    },
    harder_progression: 'sweetspot_2x20',
    tags: ['sweet spot', 'FTP', 'time efficient'],
  },
  {
    id: 'sweetspot_2x20',
    name: 'Sweet Spot 2x20',
    category: 'sweetspot',
    energy_systems: ['aerobic', 'threshold'],
    suitable_phases: ['base', 'build'],
    duration_minutes: 70,
    warmup_minutes: 15,
    cooldown_minutes: 10,
    intervals: [
      { sets: 2, duration_seconds: 1200, rest_seconds: 600, intensity_min: 88, intensity_max: 93 },
    ],
    target_tss_range: [70, 85],
    intensity_factor_range: [0.84, 0.89],
    description: 'Classic 2x20 at sweet spot. The bread and butter of FTP building.',
    purpose: 'High-quality FTP development with extended time at productive intensity.',
    execution_tips: [
      'Target middle of sweet spot range (90% FTP)',
      'Break 20 min into four 5-min mental chunks',
      'Stay seated for most of the interval',
    ],
    common_mistakes: [
      'Drifting up to threshold',
      'Giving up when it gets hard around 15 min',
    ],
    prerequisites: {
      min_ctl: 45,
    },
    easier_alternative: 'sweetspot_3x10',
    harder_progression: 'sweetspot_3x15',
    tags: ['sweet spot', '2x20', 'FTP builder', 'classic'],
  },
  {
    id: 'sweetspot_3x15',
    name: 'Sweet Spot 3x15',
    category: 'sweetspot',
    energy_systems: ['aerobic', 'threshold'],
    suitable_phases: ['build'],
    duration_minutes: 75,
    warmup_minutes: 15,
    cooldown_minutes: 10,
    intervals: [
      { sets: 3, duration_seconds: 900, rest_seconds: 300, intensity_min: 88, intensity_max: 93 },
    ],
    target_tss_range: [75, 90],
    intensity_factor_range: [0.85, 0.90],
    description: '3x15 at sweet spot. More volume than 2x20 with similar stress.',
    purpose: 'Increased total time at sweet spot. Good progression from 2x20.',
    execution_tips: [
      'Shorter rest means managing fatigue across all three',
      'Don\'t go harder on early intervals',
      'Third interval proves your fitness',
    ],
    common_mistakes: [
      'Going too hard on first two intervals',
      'Fading significantly on third interval',
    ],
    prerequisites: {
      min_ctl: 50,
      min_tsb: -20,
    },
    easier_alternative: 'sweetspot_2x20',
    harder_progression: 'sweetspot_2x30',
    tags: ['sweet spot', '3x15', 'volume'],
  },
  {
    id: 'sweetspot_2x30',
    name: 'Sweet Spot 2x30',
    category: 'sweetspot',
    energy_systems: ['aerobic', 'threshold'],
    suitable_phases: ['build'],
    duration_minutes: 90,
    warmup_minutes: 15,
    cooldown_minutes: 10,
    intervals: [
      { sets: 2, duration_seconds: 1800, rest_seconds: 600, intensity_min: 88, intensity_max: 92 },
    ],
    target_tss_range: [85, 100],
    intensity_factor_range: [0.85, 0.89],
    description: '2x30 minutes at sweet spot. Extended duration builds serious fitness.',
    purpose: 'Maximum duration sweet spot intervals. Builds mental and physical endurance at intensity.',
    execution_tips: [
      'Start at lower end of sweet spot range',
      'Break into 10-min segments mentally',
      'Nutrition during workout helps',
    ],
    common_mistakes: [
      'Attempting without adequate fitness base',
      'Going out too hard',
    ],
    prerequisites: {
      min_ctl: 60,
      min_tsb: -15,
    },
    easier_alternative: 'sweetspot_3x15',
    tags: ['sweet spot', 'extended', 'advanced'],
  },
  {
    id: 'sweetspot_over_under',
    name: 'Sweet Spot Over-Unders',
    category: 'sweetspot',
    energy_systems: ['aerobic', 'threshold'],
    suitable_phases: ['build'],
    duration_minutes: 75,
    warmup_minutes: 15,
    cooldown_minutes: 10,
    intervals: [
      { sets: 3, duration_seconds: 720, rest_seconds: 360, intensity_min: 85, intensity_max: 95, notes: '2 min at 95%, 1 min at 85%, repeat 4x' },
    ],
    target_tss_range: [75, 90],
    intensity_factor_range: [0.85, 0.91],
    description: '3x12min over-unders: alternate 2 min at 95% FTP with 1 min at 85% FTP.',
    purpose: 'Train lactate clearance while maintaining power. Crucial for racing.',
    execution_tips: [
      '"Over" should feel hard but controlled',
      '"Under" is active recovery - don\'t coast',
      'Transitions should be smooth, not abrupt',
    ],
    common_mistakes: [
      'Over portions too hard',
      'Under portions too easy (should still be work)',
    ],
    prerequisites: {
      min_ctl: 50,
    },
    easier_alternative: 'sweetspot_2x20',
    tags: ['over-under', 'lactate clearance', 'racing', 'advanced'],
  },
]

// ============================================
// THRESHOLD WORKOUTS (5)
// ============================================

const thresholdWorkouts: WorkoutTemplate[] = [
  {
    id: 'threshold_3x8',
    name: 'Threshold 3x8',
    category: 'threshold',
    energy_systems: ['threshold'],
    suitable_phases: ['build'],
    duration_minutes: 60,
    warmup_minutes: 15,
    cooldown_minutes: 10,
    intervals: [
      { sets: 3, duration_seconds: 480, rest_seconds: 360, intensity_min: 95, intensity_max: 100 },
    ],
    target_tss_range: [65, 80],
    intensity_factor_range: [0.86, 0.92],
    description: '3x8 minutes at FTP (95-100%). Introduction to threshold intervals.',
    purpose: 'Develop ability to sustain FTP. 8 minutes is long enough to challenge threshold.',
    execution_tips: [
      'Target 97-98% FTP',
      'Should feel hard but doable',
      'Full recovery between intervals',
    ],
    common_mistakes: [
      'Going above FTP',
      'Not recovering enough between efforts',
    ],
    prerequisites: {
      min_ctl: 40,
      min_tsb: -20,
    },
    harder_progression: 'threshold_3x10',
    tags: ['threshold', 'FTP', 'intervals'],
  },
  {
    id: 'threshold_3x10',
    name: 'Threshold 3x10',
    category: 'threshold',
    energy_systems: ['threshold'],
    suitable_phases: ['build'],
    duration_minutes: 65,
    warmup_minutes: 15,
    cooldown_minutes: 10,
    intervals: [
      { sets: 3, duration_seconds: 600, rest_seconds: 360, intensity_min: 95, intensity_max: 100 },
    ],
    target_tss_range: [70, 85],
    intensity_factor_range: [0.88, 0.93],
    description: '3x10 minutes at threshold. Classic threshold development workout.',
    purpose: 'Extend time at threshold. 30 total minutes of threshold work.',
    execution_tips: [
      'Even pacing is critical',
      'Mental focus required especially in last 3 minutes of each interval',
      'Recovery should be complete',
    ],
    common_mistakes: [
      'Starting intervals too hard',
      'Shortening recovery time',
    ],
    prerequisites: {
      min_ctl: 45,
      min_tsb: -20,
    },
    easier_alternative: 'threshold_3x8',
    harder_progression: 'threshold_2x20',
    tags: ['threshold', 'FTP', '3x10'],
  },
  {
    id: 'threshold_2x20',
    name: 'Threshold 2x20',
    category: 'threshold',
    energy_systems: ['threshold'],
    suitable_phases: ['build', 'peak'],
    duration_minutes: 70,
    warmup_minutes: 15,
    cooldown_minutes: 10,
    intervals: [
      { sets: 2, duration_seconds: 1200, rest_seconds: 600, intensity_min: 96, intensity_max: 100 },
    ],
    target_tss_range: [80, 95],
    intensity_factor_range: [0.90, 0.95],
    description: 'The gold standard: 2x20 minutes at FTP.',
    purpose: 'Maximum threshold development. 40 minutes total at FTP is highly effective.',
    execution_tips: [
      'Start at 96% FTP, build to 100% if feeling good',
      'Mental challenge - break into 4x5 min segments',
      'This workout separates the committed from the casual',
    ],
    common_mistakes: [
      'Going above FTP early',
      'Giving up mentally',
    ],
    prerequisites: {
      min_ctl: 55,
      min_tsb: -15,
    },
    easier_alternative: 'threshold_3x10',
    harder_progression: 'threshold_3x15',
    tags: ['threshold', '2x20', 'gold standard', 'FTP test'],
  },
  {
    id: 'threshold_3x15',
    name: 'Threshold 3x15',
    category: 'threshold',
    energy_systems: ['threshold'],
    suitable_phases: ['build', 'peak'],
    duration_minutes: 80,
    warmup_minutes: 15,
    cooldown_minutes: 10,
    intervals: [
      { sets: 3, duration_seconds: 900, rest_seconds: 420, intensity_min: 96, intensity_max: 100 },
    ],
    target_tss_range: [85, 100],
    intensity_factor_range: [0.91, 0.96],
    description: '3x15 minutes at threshold. 45 minutes total at FTP.',
    purpose: 'Extended threshold volume. For athletes who have mastered 2x20.',
    execution_tips: [
      'Pacing is everything - don\'t go out hard',
      'Third interval is the test of fitness',
      'Reduced rest vs 2x20 adds challenge',
    ],
    common_mistakes: [
      'Attempting before mastering 2x20',
      'Going too hard on first interval',
    ],
    prerequisites: {
      min_ctl: 65,
      min_tsb: -10,
    },
    easier_alternative: 'threshold_2x20',
    tags: ['threshold', 'advanced', '3x15'],
  },
  {
    id: 'threshold_40min_tt',
    name: '40-Minute Time Trial',
    category: 'threshold',
    energy_systems: ['threshold'],
    suitable_phases: ['peak'],
    duration_minutes: 70,
    warmup_minutes: 15,
    cooldown_minutes: 15,
    intervals: [
      { sets: 1, duration_seconds: 2400, rest_seconds: 0, intensity_min: 95, intensity_max: 100 },
    ],
    target_tss_range: [90, 105],
    intensity_factor_range: [0.93, 0.98],
    description: '40-minute continuous effort at threshold. Race simulation.',
    purpose: 'Time trial simulation and FTP validation. Closest to actual race demands.',
    execution_tips: [
      'Pace conservatively in first 10 minutes',
      'Find your rhythm and hold it',
      'Use aero position to simulate race',
    ],
    common_mistakes: [
      'Going out too hard',
      'Losing focus mid-effort',
    ],
    prerequisites: {
      min_ctl: 60,
      min_tsb: -5,
    },
    easier_alternative: 'threshold_2x20',
    tags: ['time trial', 'race simulation', 'continuous', 'peak'],
  },
]

// ============================================
// VO2MAX WORKOUTS (5)
// ============================================

const vo2maxWorkouts: WorkoutTemplate[] = [
  {
    id: 'vo2max_6x3',
    name: 'VO2max 6x3',
    category: 'vo2max',
    energy_systems: ['vo2max'],
    suitable_phases: ['build', 'peak'],
    duration_minutes: 55,
    warmup_minutes: 15,
    cooldown_minutes: 10,
    intervals: [
      { sets: 6, duration_seconds: 180, rest_seconds: 180, intensity_min: 110, intensity_max: 120 },
    ],
    target_tss_range: [65, 80],
    intensity_factor_range: [0.85, 0.92],
    description: '6x3 minutes at 110-120% FTP with 3 min recovery.',
    purpose: 'Develop VO2max. Shorter intervals allow higher intensity.',
    execution_tips: [
      'First interval should feel hard but doable',
      'Focus on breathing - deep and rhythmic',
      'Power should be consistent across all intervals',
    ],
    common_mistakes: [
      'Going too hard on first intervals',
      'Inconsistent pacing',
    ],
    prerequisites: {
      min_ctl: 45,
      min_tsb: -15,
      min_days_since_intensity: 2,
    },
    harder_progression: 'vo2max_5x4',
    tags: ['vo2max', 'high intensity', 'intervals'],
  },
  {
    id: 'vo2max_5x4',
    name: 'VO2max 5x4',
    category: 'vo2max',
    energy_systems: ['vo2max'],
    suitable_phases: ['build', 'peak'],
    duration_minutes: 60,
    warmup_minutes: 15,
    cooldown_minutes: 10,
    intervals: [
      { sets: 5, duration_seconds: 240, rest_seconds: 240, intensity_min: 108, intensity_max: 115 },
    ],
    target_tss_range: [70, 85],
    intensity_factor_range: [0.86, 0.93],
    description: '5x4 minutes at VO2max intensity. Classic interval format.',
    purpose: 'Extended time at VO2max. 20 minutes total at high intensity.',
    execution_tips: [
      'Slightly lower power than 3-min intervals',
      'Last minute of each should be very hard',
      'Don\'t surge - stay controlled',
    ],
    common_mistakes: [
      'Starting too hard',
      'Giving up early in intervals',
    ],
    prerequisites: {
      min_ctl: 50,
      min_tsb: -15,
      min_days_since_intensity: 2,
    },
    easier_alternative: 'vo2max_6x3',
    harder_progression: 'vo2max_5x5',
    tags: ['vo2max', '5x4', 'classic'],
  },
  {
    id: 'vo2max_5x5',
    name: 'VO2max 5x5',
    category: 'vo2max',
    energy_systems: ['vo2max'],
    suitable_phases: ['build', 'peak'],
    duration_minutes: 75,
    warmup_minutes: 15,
    cooldown_minutes: 10,
    intervals: [
      { sets: 5, duration_seconds: 300, rest_seconds: 300, intensity_min: 106, intensity_max: 112 },
    ],
    target_tss_range: [80, 95],
    intensity_factor_range: [0.88, 0.94],
    description: '5x5 minutes at 106-112% FTP. The king of VO2max workouts.',
    purpose: 'Maximum VO2max development. 25 minutes at/near VO2max.',
    execution_tips: [
      'Target 108-110% FTP',
      'Start each interval smoothly',
      'Equal rest is important - don\'t shortchange it',
    ],
    common_mistakes: [
      'Going above 112% FTP',
      'Cutting rest short',
    ],
    prerequisites: {
      min_ctl: 55,
      min_tsb: -10,
      min_days_since_intensity: 2,
    },
    easier_alternative: 'vo2max_5x4',
    harder_progression: 'vo2max_4x8',
    tags: ['vo2max', '5x5', 'king', 'classic'],
  },
  {
    id: 'vo2max_4x8',
    name: 'VO2max 4x8',
    category: 'vo2max',
    energy_systems: ['vo2max', 'threshold'],
    suitable_phases: ['peak'],
    duration_minutes: 75,
    warmup_minutes: 15,
    cooldown_minutes: 10,
    intervals: [
      { sets: 4, duration_seconds: 480, rest_seconds: 480, intensity_min: 102, intensity_max: 108 },
    ],
    target_tss_range: [80, 95],
    intensity_factor_range: [0.88, 0.94],
    description: '4x8 minutes just above threshold. Extended VO2max stimulus.',
    purpose: 'Train ability to sustain high power for longer. Bridges VO2max and threshold.',
    execution_tips: [
      'Lower intensity than shorter intervals',
      '8 minutes is long - pace yourself',
      'Mental game becomes important',
    ],
    common_mistakes: [
      'Going too hard early',
      'Not recovering between intervals',
    ],
    prerequisites: {
      min_ctl: 60,
      min_tsb: -10,
      min_days_since_intensity: 2,
    },
    easier_alternative: 'vo2max_5x5',
    tags: ['vo2max', 'extended', 'advanced'],
  },
  {
    id: 'vo2max_pyramid',
    name: 'VO2max Pyramid',
    category: 'vo2max',
    energy_systems: ['vo2max', 'anaerobic'],
    suitable_phases: ['build', 'peak'],
    duration_minutes: 65,
    warmup_minutes: 15,
    cooldown_minutes: 10,
    intervals: [
      { sets: 1, duration_seconds: 120, rest_seconds: 120, intensity_min: 115, intensity_max: 125 },
      { sets: 1, duration_seconds: 180, rest_seconds: 180, intensity_min: 110, intensity_max: 118 },
      { sets: 1, duration_seconds: 240, rest_seconds: 240, intensity_min: 108, intensity_max: 115 },
      { sets: 1, duration_seconds: 300, rest_seconds: 300, intensity_min: 106, intensity_max: 112 },
      { sets: 1, duration_seconds: 240, rest_seconds: 240, intensity_min: 108, intensity_max: 115 },
      { sets: 1, duration_seconds: 180, rest_seconds: 180, intensity_min: 110, intensity_max: 118 },
      { sets: 1, duration_seconds: 120, rest_seconds: 120, intensity_min: 115, intensity_max: 125 },
    ],
    target_tss_range: [70, 85],
    intensity_factor_range: [0.87, 0.93],
    description: 'Pyramid: 2-3-4-5-4-3-2 minutes building to peak then back down.',
    purpose: 'Varied intensity keeps workout engaging while targeting VO2max throughout.',
    execution_tips: [
      'Higher power on shorter intervals',
      'Peak effort in the 5-min interval',
      'Descending side should match ascending',
    ],
    common_mistakes: [
      'Going too hard at start',
      'Having nothing left for final intervals',
    ],
    prerequisites: {
      min_ctl: 50,
      min_tsb: -15,
    },
    tags: ['vo2max', 'pyramid', 'variety'],
  },
]

// ============================================
// ANAEROBIC WORKOUTS (4)
// ============================================

const anaerobicWorkouts: WorkoutTemplate[] = [
  {
    id: 'anaerobic_30_30',
    name: '30/30 Intervals',
    category: 'anaerobic',
    energy_systems: ['anaerobic', 'vo2max'],
    suitable_phases: ['build', 'peak'],
    duration_minutes: 55,
    warmup_minutes: 15,
    cooldown_minutes: 10,
    intervals: [
      { sets: 2, duration_seconds: 600, rest_seconds: 300, intensity_min: 130, intensity_max: 150, notes: '20x (30s on/30s off)' },
    ],
    target_tss_range: [60, 75],
    intensity_factor_range: [0.82, 0.88],
    description: '2 sets of 20x30 seconds at 130-150% FTP with 30s recovery between.',
    purpose: 'Develop anaerobic capacity and repeatability. Great for racing fitness.',
    execution_tips: [
      'Hard efforts should be truly hard',
      'Recovery is active, not complete rest',
      'Consistency across all 20 intervals matters',
    ],
    common_mistakes: [
      'Going too hard early and fading',
      'Stopping during recovery portions',
    ],
    prerequisites: {
      min_ctl: 50,
      min_tsb: -15,
      min_days_since_intensity: 2,
    },
    tags: ['anaerobic', '30/30', 'racing', 'repeatability'],
  },
  {
    id: 'anaerobic_40_20',
    name: '40/20 Intervals',
    category: 'anaerobic',
    energy_systems: ['anaerobic', 'vo2max'],
    suitable_phases: ['build', 'peak'],
    duration_minutes: 55,
    warmup_minutes: 15,
    cooldown_minutes: 10,
    intervals: [
      { sets: 2, duration_seconds: 600, rest_seconds: 360, intensity_min: 125, intensity_max: 145, notes: '10x (40s on/20s off)' },
    ],
    target_tss_range: [60, 75],
    intensity_factor_range: [0.82, 0.88],
    description: '2 sets of 10x40 seconds hard with only 20s recovery.',
    purpose: 'Extreme anaerobic stress. Teaches body to work without recovery.',
    execution_tips: [
      'These are brutal - be mentally prepared',
      '20 seconds is not enough to recover',
      'Power will drop - focus on effort',
    ],
    common_mistakes: [
      'Not committing to hard efforts',
      'Giving up mid-set',
    ],
    prerequisites: {
      min_ctl: 55,
      min_tsb: -10,
      min_days_since_intensity: 2,
    },
    tags: ['anaerobic', '40/20', 'brutal', 'racing'],
  },
  {
    id: 'anaerobic_1min',
    name: '1-Minute Repeats',
    category: 'anaerobic',
    energy_systems: ['anaerobic'],
    suitable_phases: ['build', 'peak'],
    duration_minutes: 60,
    warmup_minutes: 15,
    cooldown_minutes: 10,
    intervals: [
      { sets: 8, duration_seconds: 60, rest_seconds: 180, intensity_min: 130, intensity_max: 150 },
    ],
    target_tss_range: [65, 80],
    intensity_factor_range: [0.83, 0.90],
    description: '8x1 minute at 130-150% FTP with 3 min recovery.',
    purpose: 'Pure anaerobic power. Develops ability to produce high power repeatedly.',
    execution_tips: [
      'First 30s should feel controlled',
      'Second 30s is survival',
      'Full recovery between - use it all',
    ],
    common_mistakes: [
      'Starting too hard',
      'Not enough rest between intervals',
    ],
    prerequisites: {
      min_ctl: 50,
      min_tsb: -15,
      min_days_since_intensity: 2,
    },
    harder_progression: 'anaerobic_2min',
    tags: ['anaerobic', '1-minute', 'power', 'repeats'],
  },
  {
    id: 'anaerobic_2min',
    name: '2-Minute Repeats',
    category: 'anaerobic',
    energy_systems: ['anaerobic', 'vo2max'],
    suitable_phases: ['build', 'peak'],
    duration_minutes: 60,
    warmup_minutes: 15,
    cooldown_minutes: 10,
    intervals: [
      { sets: 6, duration_seconds: 120, rest_seconds: 240, intensity_min: 120, intensity_max: 135 },
    ],
    target_tss_range: [65, 80],
    intensity_factor_range: [0.84, 0.91],
    description: '6x2 minutes at 120-135% FTP. The long anaerobic effort.',
    purpose: 'Extended anaerobic capacity. 2 minutes is long enough to be brutally hard.',
    execution_tips: [
      '2 minutes feels like an eternity at this power',
      'Pace yourself - don\'t go out too hard',
      'Mental toughness is key',
    ],
    common_mistakes: [
      'Going out too hard',
      'Giving up early',
    ],
    prerequisites: {
      min_ctl: 55,
      min_tsb: -10,
      min_days_since_intensity: 2,
    },
    easier_alternative: 'anaerobic_1min',
    tags: ['anaerobic', '2-minute', 'brutal', 'extended'],
  },
]

// ============================================
// SPRINT WORKOUTS (3)
// ============================================

const sprintWorkouts: WorkoutTemplate[] = [
  {
    id: 'sprint_neuromuscular',
    name: 'Neuromuscular Sprints',
    category: 'sprint',
    energy_systems: ['neuromuscular'],
    suitable_phases: ['build', 'peak'],
    duration_minutes: 50,
    warmup_minutes: 15,
    cooldown_minutes: 10,
    intervals: [
      { sets: 6, duration_seconds: 15, rest_seconds: 285, intensity_min: 200, intensity_max: 300, notes: 'All-out sprint' },
    ],
    target_tss_range: [35, 50],
    intensity_factor_range: [0.65, 0.75],
    description: '6x15 second all-out sprints with 5 min full recovery.',
    purpose: 'Develop peak power and neuromuscular recruitment. Quality over quantity.',
    execution_tips: [
      'Each sprint should be maximal',
      'Full recovery between - these require it',
      'Focus on explosive starts',
    ],
    common_mistakes: [
      'Not going truly all-out',
      'Insufficient recovery',
    ],
    prerequisites: {
      min_ctl: 40,
      min_days_since_intensity: 2,
    },
    tags: ['sprint', 'peak power', 'neuromuscular'],
  },
  {
    id: 'sprint_standing_starts',
    name: 'Standing Start Sprints',
    category: 'sprint',
    energy_systems: ['neuromuscular', 'anaerobic'],
    suitable_phases: ['build', 'peak'],
    duration_minutes: 55,
    warmup_minutes: 20,
    cooldown_minutes: 10,
    intervals: [
      { sets: 8, duration_seconds: 20, rest_seconds: 280, intensity_min: 180, intensity_max: 250, notes: 'Start from near standstill' },
    ],
    target_tss_range: [40, 55],
    intensity_factor_range: [0.68, 0.78],
    description: '8x20 second sprints from near standstill.',
    purpose: 'Develop explosive acceleration and race-start power.',
    execution_tips: [
      'Start from very slow roll (5 km/h)',
      'Big gear, explosive start',
      'Get out of saddle immediately',
    ],
    common_mistakes: [
      'Rolling start too fast',
      'Not committing to explosive start',
    ],
    prerequisites: {
      min_ctl: 40,
    },
    tags: ['sprint', 'starts', 'acceleration', 'racing'],
  },
  {
    id: 'sprint_race_simulation',
    name: 'Race Sprint Simulation',
    category: 'sprint',
    energy_systems: ['neuromuscular', 'anaerobic', 'vo2max'],
    suitable_phases: ['peak'],
    duration_minutes: 60,
    warmup_minutes: 20,
    cooldown_minutes: 10,
    intervals: [
      { sets: 4, duration_seconds: 180, rest_seconds: 180, intensity_min: 108, intensity_max: 115, notes: '3 min hard effort' },
      { sets: 4, duration_seconds: 20, rest_seconds: 40, intensity_min: 180, intensity_max: 250, notes: 'Sprint at end of each hard effort' },
    ],
    target_tss_range: [60, 75],
    intensity_factor_range: [0.80, 0.88],
    description: '4x(3 min hard + 20s sprint). Simulates racing breakaway with sprint finish.',
    purpose: 'Race-specific preparation. Combines sustained effort with finishing sprint.',
    execution_tips: [
      'Hard effort should be at VO2max intensity',
      'Sprint should be race-winning effort',
      'This simulates real racing demands',
    ],
    common_mistakes: [
      'Not going hard enough before sprint',
      'Holding back sprint effort',
    ],
    prerequisites: {
      min_ctl: 55,
      min_tsb: -10,
    },
    tags: ['sprint', 'race simulation', 'finishing', 'peak'],
  },
]

// ============================================
// EXPORT ALL WORKOUTS
// ============================================

export const workoutLibrary: WorkoutTemplate[] = [
  ...recoveryWorkouts,
  ...enduranceWorkouts,
  ...tempoWorkouts,
  ...sweetspotWorkouts,
  ...thresholdWorkouts,
  ...vo2maxWorkouts,
  ...anaerobicWorkouts,
  ...sprintWorkouts,
]

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getWorkoutById(id: string): WorkoutTemplate | undefined {
  return workoutLibrary.find(w => w.id === id)
}

export function getWorkoutsByCategory(category: WorkoutCategory): WorkoutTemplate[] {
  return workoutLibrary.filter(w => w.category === category)
}

export function getWorkoutsByPhase(phase: TrainingPhase): WorkoutTemplate[] {
  return workoutLibrary.filter(w =>
    w.suitable_phases.includes(phase) || w.suitable_phases.includes('any')
  )
}

export function getWorkoutsByEnergySystem(system: EnergySystem): WorkoutTemplate[] {
  return workoutLibrary.filter(w => w.energy_systems.includes(system))
}

export function searchWorkouts(query: string): WorkoutTemplate[] {
  const lowerQuery = query.toLowerCase()
  return workoutLibrary.filter(w =>
    w.name.toLowerCase().includes(lowerQuery) ||
    w.description.toLowerCase().includes(lowerQuery) ||
    w.tags.some(t => t.includes(lowerQuery))
  )
}

// Get count by category
export function getWorkoutCounts(): Record<WorkoutCategory, number> {
  const counts: Record<WorkoutCategory, number> = {
    recovery: 0,
    endurance: 0,
    tempo: 0,
    sweetspot: 0,
    threshold: 0,
    vo2max: 0,
    anaerobic: 0,
    sprint: 0,
    mixed: 0,
  }

  for (const workout of workoutLibrary) {
    counts[workout.category]++
  }

  return counts
}
