// Wiki article types and content
// All sources must be verified and from reputable sources

export type ConfidenceLevel = 'established' | 'strong_evidence' | 'emerging' | 'debated'
export type ArticleStatus = 'active' | 'under_review' | 'deprecated'
export type SourceType = 'peer_reviewed' | 'textbook' | 'industry' | 'meta_analysis'

export interface WikiSource {
  title: string
  url: string
  author?: string
  type: SourceType
  year?: number
}

export interface KnownDebate {
  topic: string
  positions: string[]
  recommendation: string
}

export interface WikiArticle {
  slug: string
  title: string
  category: 'fundamentals' | 'metrics' | 'concepts' | 'app-guide'
  excerpt: string
  readingTime: number // minutes
  content: string // HTML or markdown-like content
  keyTakeaways: string[]
  sources: WikiSource[]

  // Governance fields
  confidenceLevel: ConfidenceLevel
  consensusNote?: string
  status: ArticleStatus
  lastVerified: string // ISO date
  version: number
  knownDebates?: KnownDebate[]
}

export const categories = {
  fundamentals: { label: 'Fundamentals', description: 'Core training concepts' },
  metrics: { label: 'Metrics', description: 'Understanding training numbers' },
  concepts: { label: 'Training Concepts', description: 'Advanced training theory' },
  'app-guide': { label: 'Using This App', description: 'Getting the most from Training Analyst' },
}

export const articles: WikiArticle[] = [
  {
    slug: 'what-is-ftp',
    title: 'What is FTP (Functional Threshold Power)?',
    category: 'fundamentals',
    excerpt: 'FTP is the maximum power you can sustain for approximately one hour. It\'s the foundation for all power-based training.',
    readingTime: 4,
    content: `
## What is FTP?

Functional Threshold Power (FTP) is defined as the highest average power output you can maintain for approximately one hour. It represents the boundary between sustainable aerobic exercise and unsustainable high-intensity efforts.

## Why FTP Matters

FTP serves as the cornerstone of power-based training because:

- **Training Zones**: All power zones are calculated as percentages of your FTP
- **Progress Tracking**: Changes in FTP indicate fitness improvements or declines
- **Workout Prescription**: Interval targets are set relative to FTP
- **Performance Prediction**: FTP correlates with cycling performance

## Typical FTP Values

| Level | FTP (Watts) | W/kg (70kg rider) |
|-------|-------------|-------------------|
| Recreational | 150-200 | 2.1-2.9 |
| Enthusiast | 200-250 | 2.9-3.6 |
| Competitive Amateur | 250-300 | 3.6-4.3 |
| Cat 1/2 Racer | 300-350 | 4.3-5.0 |
| Professional | 350-450+ | 5.0-6.5+ |

## How to Test FTP

The most common protocols are:

1. **20-Minute Test**: Ride as hard as you can for 20 minutes, then multiply average power by 0.95
2. **Ramp Test**: Progressive increase in power until failure, uses algorithms to estimate FTP
3. **60-Minute Test**: The gold standard but very demanding

## How Often to Test

Test your FTP every 4-8 weeks, or after a significant training block. Your FTP will naturally fluctuate with training load and fatigue.
    `.trim(),
    keyTakeaways: [
      'FTP is the maximum power you can hold for ~1 hour',
      'All training zones are based on FTP percentages',
      'Test every 4-8 weeks to track progress',
      'FTP naturally fluctuates with training and fatigue',
    ],
    sources: [
      {
        title: 'Training and Racing with a Power Meter',
        url: 'https://www.trainingpeaks.com/learn/articles/what-is-threshold-power/',
        author: 'Dr. Andrew Coggan',
        type: 'textbook',
        year: 2019,
      },
      {
        title: 'What is FTP in Cycling?',
        url: 'https://www.trainerroad.com/blog/what-is-ftp-in-cycling/',
        author: 'TrainerRoad',
        type: 'industry',
        year: 2023,
      },
    ],
    confidenceLevel: 'established',
    status: 'active',
    lastVerified: '2025-01-13',
    version: 1,
  },
  {
    slug: 'tss-training-stress-score',
    title: 'Understanding TSS (Training Stress Score)',
    category: 'metrics',
    excerpt: 'TSS quantifies the training load of a workout by combining duration and intensity into a single number.',
    readingTime: 5,
    content: `
## What is TSS?

Training Stress Score (TSS) is a composite metric that quantifies the overall training load of a workout. It accounts for both how long and how hard you trained.

## The TSS Formula

TSS = (Duration × NP × IF) / (FTP × 3600) × 100

Where:
- **Duration** is in seconds
- **NP** is Normalized Power
- **IF** is Intensity Factor (NP/FTP)
- **FTP** is your Functional Threshold Power

## TSS Reference Points

| TSS | Example | Recovery Time |
|-----|---------|---------------|
| <150 | Low intensity, short | Recovered by next day |
| 150-300 | Moderate | Some lingering fatigue |
| 300-450 | High | Tired for 2+ days |
| >450 | Very high | Extended recovery needed |

A workout at FTP for exactly one hour produces TSS of 100. This serves as a reference point for all other values.

## Daily TSS Targets

Your sustainable daily TSS depends on your fitness level (CTL):

- **CTL 50**: ~50-70 TSS/day sustainable
- **CTL 80**: ~80-100 TSS/day sustainable
- **CTL 100+**: ~100-130 TSS/day sustainable

## Limitations of TSS

TSS doesn't tell you:
- **Type of stress**: 100 TSS could be endurance or intervals
- **Neuromuscular demands**: Sprints produce low TSS but high stress
- **Individual recovery capacity**: Same TSS affects athletes differently
    `.trim(),
    keyTakeaways: [
      '1 hour at FTP = TSS of 100',
      'TSS combines duration and intensity into one number',
      'Sustainable daily TSS depends on your fitness level (CTL)',
      'TSS doesn\'t distinguish between types of training stress',
    ],
    sources: [
      {
        title: 'Training Stress Scores Explained',
        url: 'https://help.trainingpeaks.com/hc/en-us/articles/204071944-Training-Stress-Scores-TSS-Explained',
        author: 'TrainingPeaks',
        type: 'industry',
        year: 2020,
      },
      {
        title: 'What is TSS and How to Use It',
        url: 'https://www.trainerroad.com/blog/tss-what-it-is-what-its-good-for-and-why-it-can-be-misleading/',
        author: 'TrainerRoad',
        type: 'industry',
        year: 2022,
      },
    ],
    confidenceLevel: 'established',
    status: 'active',
    lastVerified: '2025-01-13',
    version: 1,
  },
  {
    slug: 'ctl-atl-tsb-explained',
    title: 'CTL, ATL, and TSB Explained',
    category: 'metrics',
    excerpt: 'The three metrics that power the Performance Management Chart: Fitness, Fatigue, and Form.',
    readingTime: 6,
    content: `
## The Performance Management Model

CTL, ATL, and TSB are the three pillars of the Performance Management Chart (PMC). They model how your body responds to training over time.

## CTL - Chronic Training Load ("Fitness")

CTL is an exponentially weighted average of your daily TSS over the past 42 days.

**What it represents:** Your accumulated training adaptations—your "fitness"

**Characteristics:**
- Rises slowly with consistent training
- Falls slowly during rest periods
- Higher CTL = better prepared for sustained efforts

**Typical CTL values:**
- 20-40: Recreational cyclist
- 50-70: Regular trainer
- 80-100: Serious amateur
- 100+: Competitive athlete

## ATL - Acute Training Load ("Fatigue")

ATL is an exponentially weighted average of your daily TSS over the past 7 days.

**What it represents:** Your recent training stress—your "fatigue"

**Characteristics:**
- Rises quickly with hard training
- Falls quickly with rest
- Higher ATL = more accumulated fatigue

## TSB - Training Stress Balance ("Form")

TSB = CTL - ATL

**What it represents:** The balance between fitness and fatigue—your "form" or readiness

**TSB Zones:**
| Range | State | Meaning |
|-------|-------|---------|
| Below -25 | Very Tired | High overtraining risk |
| -25 to -10 | Tired | Building fitness, normal training |
| -10 to +5 | Neutral | Good training zone |
| +5 to +25 | Fresh | Ready for racing/key workouts |
| Above +25 | Very Fresh | May be losing fitness |

## Using the PMC for Racing

For optimal race performance:
1. Build CTL during base/build phases
2. Allow TSB to go negative during hard training
3. Taper before events to raise TSB while minimizing CTL loss
4. Target TSB of +10 to +25 on race day
    `.trim(),
    keyTakeaways: [
      'CTL (42-day average) represents your fitness',
      'ATL (7-day average) represents your fatigue',
      'TSB = CTL - ATL represents your form/readiness',
      'Target TSB of +10 to +25 for optimal race performance',
    ],
    sources: [
      {
        title: 'The Science of the Performance Manager',
        url: 'https://www.trainingpeaks.com/learn/articles/the-science-of-the-performance-manager/',
        author: 'TrainingPeaks',
        type: 'industry',
        year: 2019,
      },
      {
        title: 'A Coach\'s Guide to ATL, CTL & TSB',
        url: 'https://www.trainingpeaks.com/coach-blog/a-coachs-guide-to-atl-ctl-tsb/',
        author: 'TrainingPeaks',
        type: 'industry',
        year: 2021,
      },
    ],
    confidenceLevel: 'established',
    status: 'active',
    lastVerified: '2025-01-13',
    version: 1,
  },
  {
    slug: 'normalized-power',
    title: 'What is Normalized Power?',
    category: 'metrics',
    excerpt: 'Normalized Power accounts for the variability in your ride to give a better estimate of physiological cost.',
    readingTime: 4,
    content: `
## The Problem with Average Power

Average power can be misleading. Consider two rides:

**Ride A:** Steady 200W for 1 hour = 200W average
**Ride B:** Alternating 400W/0W every minute for 1 hour = 200W average

Both have the same average power, but Ride B is much harder! The surges to 400W create significantly more metabolic stress than steady-state riding.

## What is Normalized Power?

Normalized Power (NP) is an algorithm developed by Dr. Andrew Coggan that estimates the power you could have maintained if your effort was perfectly steady.

## How NP is Calculated

1. Calculate a 30-second rolling average of power
2. Raise each value to the 4th power (emphasizes high efforts)
3. Take the average of these values
4. Take the 4th root of the result

The 4th power weighting means hard efforts count disproportionately more than easy ones, better reflecting physiological stress.

## NP vs Average Power

| Ride Type | Average Power | NP | Difference |
|-----------|---------------|-----|------------|
| Steady endurance | 180W | 185W | +3% |
| Varied group ride | 180W | 220W | +22% |
| Criterium | 150W | 250W | +67% |
| Zwift race | 200W | 260W | +30% |

## Using NP Effectively

- Compare NP to FTP using Intensity Factor (IF = NP/FTP)
- Use NP for calculating TSS, not average power
- A high NP:Average ratio indicates a variable ride
    `.trim(),
    keyTakeaways: [
      'NP estimates equivalent steady-state power for variable rides',
      'Hard efforts are weighted more heavily than easy ones',
      'Use NP (not average) for training load calculations',
      'Large NP:Average gap indicates high variability',
    ],
    sources: [
      {
        title: 'Normalized Power, Intensity Factor and Training Stress Score',
        url: 'https://www.trainingpeaks.com/learn/articles/normalized-power-intensity-factor-training-stress/',
        author: 'Dr. Andrew Coggan',
        type: 'textbook',
        year: 2019,
      },
      {
        title: 'What is Normalized Power',
        url: 'https://www.trainerroad.com/blog/what-is-normalized-power/',
        author: 'TrainerRoad',
        type: 'industry',
        year: 2022,
      },
    ],
    confidenceLevel: 'established',
    status: 'active',
    lastVerified: '2025-01-13',
    version: 1,
  },
  {
    slug: 'tapering-for-events',
    title: 'Tapering for Events',
    category: 'concepts',
    excerpt: 'How to reduce training before an event to arrive fresh and ready to perform.',
    readingTime: 5,
    content: `
## What is Tapering?

Tapering is the strategic reduction of training volume and intensity before an important event. The goal is to shed fatigue while maintaining fitness.

## The Science of Tapering

When you taper:
- Muscle glycogen stores replenish
- Muscle damage repairs
- Hormonal balance restores
- Mental freshness returns

Research shows a proper taper can improve performance by 2-3%.

## Taper Duration

| Event Priority | Taper Length |
|---------------|--------------|
| C Race | 2-3 days |
| B Race | 5-7 days |
| A Race | 10-14 days |

## How to Taper

**Reduce volume, maintain intensity:**
- Cut training volume by 40-60%
- Keep some intensity to maintain sharpness
- Include 2-3 "opener" sessions in the final days

**TSB Targets:**
- Start of taper: TSB around -10 to -20
- Race day: TSB around +10 to +25

## Common Taper Mistakes

1. **Tapering too long**: Fitness (CTL) drops too much
2. **Not tapering enough**: Arrive fatigued (low TSB)
3. **Adding intensity**: Getting nervous and training too hard
4. **Changing too much**: New equipment, nutrition, or routines

## Monitoring Your Taper

Use the PMC chart to track:
- CTL should drop slightly (5-10 points is normal)
- ATL should drop significantly
- TSB should rise into positive territory
    `.trim(),
    keyTakeaways: [
      'Taper length depends on event priority (2 days to 2 weeks)',
      'Reduce volume 40-60% but maintain some intensity',
      'Target TSB of +10 to +25 on race day',
      'A proper taper can improve performance 2-3%',
    ],
    sources: [
      {
        title: 'The Art and Science of Tapering',
        url: 'https://www.trainingpeaks.com/learn/articles/the-art-and-science-of-tapering/',
        author: 'TrainingPeaks',
        type: 'industry',
        year: 2020,
      },
      {
        title: 'How to Taper for Peak Performance',
        url: 'https://trainright.com/how-to-taper-for-peak-performance/',
        author: 'CTS',
        type: 'industry',
        year: 2021,
      },
    ],
    confidenceLevel: 'strong_evidence',
    consensusNote: 'Taper duration recommendations vary; some coaches prefer shorter tapers',
    status: 'active',
    lastVerified: '2025-01-13',
    version: 1,
  },
  {
    slug: 'reading-pmc-chart',
    title: 'Reading the PMC Chart',
    category: 'app-guide',
    excerpt: 'How to interpret the Performance Management Chart in Training Analyst.',
    readingTime: 4,
    content: `
## Understanding the PMC Chart

The Performance Management Chart (PMC) visualizes three key metrics over time:

- **Blue line (CTL)**: Your fitness level
- **Orange line (ATL)**: Your fatigue level
- **Green line (TSB)**: Your form/freshness

## Reading the Lines

**CTL (Fitness)**
- Rising = fitness improving
- Falling = fitness declining
- Aim for gradual, sustainable increases

**ATL (Fatigue)**
- Spikes after hard training blocks
- Drops quickly during rest
- Watch for consistently high ATL (overtraining risk)

**TSB (Form)**
- Negative = fatigued from training
- Positive = fresh and ready to perform
- Zero line is the balance point

## Common Patterns

**Building Phase:**
- CTL trending upward
- TSB mostly negative (-10 to -30)
- ATL fluctuating with training weeks

**Taper Phase:**
- CTL stable or slightly dropping
- ATL dropping quickly
- TSB rising toward positive

**Detraining:**
- CTL dropping steadily
- ATL very low
- TSB high (+20 or more)

## Using the Time Range Selector

- **6 Weeks**: See recent training details
- **3 Months**: View a training block
- **6 Months**: Track seasonal progression
- **1 Year**: Analyze annual periodization

## Tips for Success

1. Don't chase high CTL too fast (max ~5-7 points/week)
2. Plan recovery weeks every 3-4 weeks
3. Match TSB peaks with your key events
4. Use the reference zones to guide training decisions
    `.trim(),
    keyTakeaways: [
      'Blue = fitness, Orange = fatigue, Green = form',
      'Negative TSB means training hard, positive means fresh',
      'Use longer time ranges to see the big picture',
      'Match your TSB peaks with important events',
    ],
    sources: [
      {
        title: 'Performance Management Chart',
        url: 'https://support.myprocoach.net/hc/en-us/articles/360040589772-Performance-Management-Chart',
        author: 'MyProCoach',
        type: 'industry',
        year: 2022,
      },
      {
        title: 'Understanding Your PMC',
        url: 'https://www.trainingpeaks.com/learn/articles/the-science-of-the-performance-manager/',
        author: 'TrainingPeaks',
        type: 'industry',
        year: 2019,
      },
    ],
    confidenceLevel: 'established',
    status: 'active',
    lastVerified: '2025-01-13',
    version: 1,
  },
  // ============================================
  // NEW ARTICLES - Phase 1 Knowledge Content
  // ============================================
  {
    slug: 'polarized-training',
    title: 'Polarized Training: The 80/20 Approach',
    category: 'concepts',
    excerpt: 'Polarized training distributes volume mostly at low intensity with hard efforts at high intensity, minimizing time in the middle zones.',
    readingTime: 6,
    content: `
## What is Polarized Training?

Polarized training is an intensity distribution model where approximately 80% of training time is spent at low intensity (Zone 1-2) and 20% at high intensity (Zone 4-5), with minimal time in the moderate "threshold" zone (Zone 3).

## The Science Behind Polarization

Research by Dr. Stephen Seiler analyzed the training patterns of elite endurance athletes across multiple sports. Key findings:

- Elite athletes across sports naturally gravitate toward polarized distributions
- The "threshold" zone (Zone 3) creates significant fatigue without maximizing adaptation
- Low-intensity training builds aerobic capacity while allowing recovery
- High-intensity work drives peak adaptations when properly recovered

## Why Avoid the Middle?

Zone 3 (tempo/sweetspot) is sometimes called "no man's land" because:
- **Too hard to recover from quickly** - creates systemic fatigue
- **Not hard enough to maximize adaptations** - doesn't stress VO2max or anaerobic systems
- **Compromises training quality** - fatigue impacts subsequent high-intensity sessions

## Implementing Polarized Training

**Weekly Structure Example (10 hours):**
- 8 hours Zone 1-2 (endurance rides, easy spinning)
- 2 hours Zone 4-5 (intervals, hard group rides)
- Minimal Zone 3

**Key Principles:**
1. Keep easy days truly easy (conversational pace)
2. Make hard days genuinely hard (above threshold)
3. Avoid "moderate" efforts that feel productive but compromise recovery
4. Monitor intensity distribution weekly/monthly

## Who Benefits Most?

Polarized training works particularly well for:
- Athletes with limited training time (quality over quantity)
- Those prone to overtraining or burnout
- Endurance athletes preparing for long events
- Experienced athletes looking to break plateaus

## Caveats and Considerations

- Requires discipline to keep easy days easy
- May feel "too easy" initially for athletes used to harder training
- Some athletes respond better to pyramidal or threshold-focused approaches
- Periodization phase matters - build phases may warrant more threshold work
    `.trim(),
    keyTakeaways: [
      '80% low intensity, 20% high intensity, minimal middle zone',
      'Elite athletes naturally gravitate toward polarized distributions',
      'Zone 3 creates fatigue without maximizing adaptations',
      'Requires discipline to keep easy days truly easy',
    ],
    sources: [
      {
        title: 'What is Best Practice for Training Intensity and Duration Distribution in Endurance Athletes?',
        url: 'https://pubmed.ncbi.nlm.nih.gov/20024292/',
        author: 'Seiler S',
        type: 'peer_reviewed',
        year: 2010,
      },
      {
        title: 'Polarized Training Has Greater Impact on Key Endurance Variables Than Threshold, High Intensity, or High Volume Training',
        url: 'https://pubmed.ncbi.nlm.nih.gov/24728927/',
        author: 'Stöggl T, Sperlich B',
        type: 'peer_reviewed',
        year: 2014,
      },
      {
        title: 'Intervals, Thresholds, and Long Slow Distance: The Role of Intensity and Duration in Endurance Training',
        url: 'https://pubmed.ncbi.nlm.nih.gov/19017872/',
        author: 'Seiler S, Tønnessen E',
        type: 'peer_reviewed',
        year: 2009,
      },
    ],
    confidenceLevel: 'strong_evidence',
    consensusNote: 'Some coaches prefer pyramidal distribution with more Zone 3 work; individual response varies',
    status: 'active',
    lastVerified: '2025-01-13',
    version: 1,
    knownDebates: [
      {
        topic: 'Polarized vs Sweet Spot Training',
        positions: [
          'Polarized maximizes adaptation while minimizing fatigue',
          'Sweet spot provides more time-efficient fitness gains for time-crunched athletes',
          'Individual response and goals should determine approach',
        ],
        recommendation: 'Consider polarized for high-volume athletes; sweet spot may suit time-limited athletes',
      },
    ],
  },
  {
    slug: 'sweet-spot-training',
    title: 'Sweet Spot Training: Efficient Power Building',
    category: 'concepts',
    excerpt: 'Sweet spot training targets 84-97% of FTP, offering a balance between training stress and recovery demands.',
    readingTime: 5,
    content: `
## What is Sweet Spot Training?

Sweet spot training targets the intensity zone between 84-97% of FTP (approximately 88-93% for most athletes). This zone is called the "sweet spot" because it's theorized to provide the best return on investment: significant training stress with manageable recovery demands.

## The Theory Behind Sweet Spot

The concept was popularized by coach Frank Overton and is based on the idea that:

- **High enough to stress aerobic system** - meaningfully challenges your FTP
- **Low enough to accumulate volume** - can do longer intervals and more total work
- **Recovery manageable** - allows consistent training day after day

## Sweet Spot vs Threshold

| Aspect | Sweet Spot (84-97%) | Threshold (95-105%) |
|--------|---------------------|---------------------|
| Duration | 20-90 minutes | 8-30 minutes |
| Recovery | 24-48 hours | 48-72 hours |
| TSS/hour | 75-90 | 90-100+ |
| RPE | 6-7/10 | 8-9/10 |

## Common Sweet Spot Workouts

**Progressive Sweet Spot:**
- 2x20 min @ 88% FTP (beginner)
- 3x20 min @ 90% FTP (intermediate)
- 2x30 min @ 92% FTP (advanced)

**Over-Unders:**
- 3x15 min alternating 2 min @ 95% / 1 min @ 85%
- Teaches body to clear lactate while maintaining power

## Benefits of Sweet Spot Training

1. **Time efficient** - high TSS per hour
2. **Builds muscular endurance** - key for sustained efforts
3. **Raises FTP** - targets the aerobic system effectively
4. **Sustainable** - can train consistently without excessive fatigue

## Criticisms and Limitations

Sweet spot has vocal critics who argue:

- Creates "gray zone" fatigue without maximizing adaptations
- May not develop top-end power (VO2max)
- Can lead to plateau if overused
- Polarized approach may be superior for long-term development

## When to Use Sweet Spot

**Good applications:**
- Time-crunched athletes (< 8 hours/week)
- Base building phases
- Maintaining fitness during busy periods
- Building muscular endurance

**Consider alternatives when:**
- Training > 12 hours/week (may create too much fatigue)
- Peaking for events (need more specificity)
- Feeling stale or plateaued
    `.trim(),
    keyTakeaways: [
      'Sweet spot is 84-97% of FTP - hard but sustainable',
      'Provides high TSS per hour for time-efficient training',
      'Creates more fatigue than easy riding but less than threshold',
      'Debate exists whether polarized training is superior long-term',
    ],
    sources: [
      {
        title: 'Training and Racing with a Power Meter',
        url: 'https://www.velopress.com/books/training-and-racing-with-a-power-meter/',
        author: 'Hunter Allen, Andrew Coggan',
        type: 'textbook',
        year: 2019,
      },
      {
        title: 'Sweet Spot Training Explained',
        url: 'https://www.trainerroad.com/blog/sweet-spot-training-explained/',
        author: 'TrainerRoad',
        type: 'industry',
        year: 2023,
      },
    ],
    confidenceLevel: 'debated',
    consensusNote: 'Effective for time-crunched athletes but may not be optimal for high-volume training',
    status: 'active',
    lastVerified: '2025-01-13',
    version: 1,
    knownDebates: [
      {
        topic: 'Sweet Spot vs Polarized Training',
        positions: [
          'Sweet spot is time-efficient and builds FTP effectively',
          'Polarized training creates less fatigue and may be superior long-term',
          'Sweet spot creates "gray zone" stress without maximizing adaptations',
        ],
        recommendation: 'Use sweet spot for time-limited training; consider polarized if training 10+ hours/week',
      },
    ],
  },
  {
    slug: 'vo2max-development',
    title: 'Developing VO2max: High-Intensity Interval Training',
    category: 'concepts',
    excerpt: 'VO2max intervals are the most effective way to improve your maximal aerobic capacity and top-end power.',
    readingTime: 6,
    content: `
## What is VO2max?

VO2max (maximal oxygen uptake) is the maximum rate at which your body can consume oxygen during exercise. It's one of the most important predictors of endurance performance and represents your aerobic ceiling.

## Why VO2max Matters

- **Performance predictor**: Strong correlation with race performance
- **Trainable**: Can improve 15-25% with proper training
- **Determines ceiling**: Your FTP is typically 70-85% of power at VO2max

## VO2max Training Zone

VO2max intervals are performed at 106-120% of FTP (Power Zone 5), targeting:
- Heart rate: 95-100% of max HR
- RPE: 9-10/10 (very hard)
- Breathing: Maximum ventilation, can't speak

## Classic VO2max Workouts

**The Research-Backed Standards:**

| Workout | Structure | Time at VO2max |
|---------|-----------|----------------|
| 5x5 min | 5 min on / 5 min off | 15-20 min |
| 4x4 min | 4 min on / 3 min off | 12-16 min |
| 6x3 min | 3 min on / 3 min off | 12-15 min |
| 8x2 min | 2 min on / 2 min off | 10-12 min |

**Target: 12-20 minutes of total time at VO2max per session**

## The Science of VO2max Intervals

Research by Véronique Billat and others shows:

1. **Time at VO2max matters** - adaptations driven by time spent near max oxygen uptake
2. **Interval length flexibility** - 2-5 minute intervals all effective
3. **Recovery periods crucial** - too short impairs subsequent intervals
4. **Frequency** - 2-3 sessions per week maximum during build phases

## Execution Tips

**Starting the interval:**
- Begin hard to elevate oxygen consumption quickly
- Takes 60-90 seconds to reach VO2max

**During the interval:**
- Maintain power even as HR rises
- Focus on breathing rhythm
- Accept discomfort - this should be hard

**Recovery between intervals:**
- Active recovery (50-60% FTP)
- Long enough to partially recover (not fully)
- HR should drop to ~70% max before next interval

## Programming VO2max Work

**When to include:**
- Build and peak phases
- 6-12 weeks before target event
- When FTP progress has stalled

**When to reduce/avoid:**
- Base phase (focus on aerobic foundation)
- Race week (taper)
- When fatigued or under-recovered

**Progression:**
- Start with shorter intervals (3 min)
- Progress to longer intervals (4-5 min)
- Increase total time at VO2max gradually
    `.trim(),
    keyTakeaways: [
      'VO2max is trainable and strongly predicts endurance performance',
      'Target 12-20 minutes at VO2max per session with intervals',
      'Classic formats: 5x5, 4x4, or 6x3 minute intervals',
      'Include 2-3 VO2max sessions per week during build phases',
    ],
    sources: [
      {
        title: 'Interval Training for Performance: A Scientific and Empirical Practice',
        url: 'https://pubmed.ncbi.nlm.nih.gov/11219498/',
        author: 'Billat VL',
        type: 'peer_reviewed',
        year: 2001,
      },
      {
        title: 'Scientific Basis for High-Intensity Interval Training',
        url: 'https://pubmed.ncbi.nlm.nih.gov/26481101/',
        author: 'Buchheit M, Laursen PB',
        type: 'peer_reviewed',
        year: 2013,
      },
      {
        title: 'Optimizing Interval Training at Power Associated with VO2max',
        url: 'https://pubmed.ncbi.nlm.nih.gov/10694134/',
        author: 'Billat VL, et al',
        type: 'peer_reviewed',
        year: 2000,
      },
    ],
    confidenceLevel: 'established',
    status: 'active',
    lastVerified: '2025-01-13',
    version: 1,
  },
  {
    slug: 'base-building',
    title: 'Building Your Aerobic Base',
    category: 'fundamentals',
    excerpt: 'Base training develops the aerobic foundation that supports all other training. It\'s the most important phase for long-term development.',
    readingTime: 6,
    content: `
## What is Base Training?

Base training is a period of predominantly low-intensity, high-volume training that develops your aerobic foundation. It's typically the first phase in a periodized training plan and can last 8-16 weeks.

## Why Base Training Matters

Your aerobic base determines:
- **Recovery capacity** - how quickly you recover between hard efforts
- **Fat oxidation** - ability to use fat as fuel, sparing glycogen
- **Capillary density** - oxygen delivery to working muscles
- **Mitochondrial density** - cellular energy production
- **Sustainable power** - foundation for threshold and VO2max

## The Physiology of Base Building

Low-intensity training creates specific adaptations:

| Adaptation | Benefit |
|------------|---------|
| Increased capillaries | Better oxygen delivery |
| More mitochondria | More aerobic energy |
| Enhanced fat oxidation | Glycogen sparing |
| Improved stroke volume | More blood per heartbeat |
| Type I fiber development | Fatigue resistance |

## Base Training Intensity

**Target Zone: Zone 1-2 (55-75% FTP)**
- Heart rate: 60-75% of max
- RPE: 2-4/10 (easy, conversational)
- Breathing: Can speak in full sentences

**Common mistake:** Going too hard. If you can't maintain a conversation, you're above Zone 2.

## How Long Should Base Phase Last?

| Training Age | Recommended Base |
|--------------|------------------|
| Beginner (< 2 years) | 12-16 weeks |
| Intermediate (2-5 years) | 8-12 weeks |
| Advanced (5+ years) | 6-8 weeks |

## Weekly Structure During Base

**Example: 10 hours/week base phase**
- 4x 2-hour Zone 2 rides
- 1x 2-hour ride with tempo efforts (optional)
- Emphasis on consistency over intensity

## Common Base Training Mistakes

1. **Going too hard** - Zone 2 should feel easy
2. **Cutting it short** - insufficient time to build foundation
3. **Adding intensity too soon** - patience is key
4. **Inconsistency** - regular training matters more than occasional long rides

## Signs Your Base is Solid

- Can ride for hours without significant fatigue
- Heart rate stays stable at given power
- Low decoupling on long rides (< 5%)
- Good recovery between training days
- Efficiency Factor (NP/HR) improving

## When to Progress from Base

Move to build phase when:
- Completed planned base duration
- Aerobic efficiency metrics stable or improving
- Ready for more intensity mentally
- Target event is 8-12 weeks away
    `.trim(),
    keyTakeaways: [
      'Base training builds the aerobic foundation for all other training',
      'Keep intensity low (Zone 1-2) - it should feel easy',
      'Base phase typically lasts 8-16 weeks depending on experience',
      'Patience is key - don\'t add intensity too soon',
    ],
    sources: [
      {
        title: 'The Cyclist\'s Training Bible',
        url: 'https://www.velopress.com/books/the-cyclists-training-bible/',
        author: 'Joe Friel',
        type: 'textbook',
        year: 2018,
      },
      {
        title: 'Training and Racing with a Power Meter',
        url: 'https://www.velopress.com/books/training-and-racing-with-a-power-meter/',
        author: 'Hunter Allen, Andrew Coggan',
        type: 'textbook',
        year: 2019,
      },
      {
        title: 'Endurance Training and Elite Performance',
        url: 'https://pubmed.ncbi.nlm.nih.gov/32096113/',
        author: 'Seiler S',
        type: 'peer_reviewed',
        year: 2019,
      },
    ],
    confidenceLevel: 'established',
    status: 'active',
    lastVerified: '2025-01-13',
    version: 1,
  },
  {
    slug: 'recovery-principles',
    title: 'Recovery Principles for Endurance Athletes',
    category: 'fundamentals',
    excerpt: 'Recovery is when adaptation happens. Understanding and optimizing recovery is essential for training progress.',
    readingTime: 6,
    content: `
## The Principle of Supercompensation

Training creates stress that temporarily reduces performance. During recovery, your body adapts and returns stronger than before. This is supercompensation.

**The cycle:**
1. Training stress → temporary performance decrease
2. Recovery → body repairs and adapts
3. Supercompensation → performance above baseline
4. Next training session → build on new baseline

## Key Recovery Factors

### Sleep
The most important recovery tool:
- **Target: 7-9 hours** for most athletes
- Growth hormone released during deep sleep
- Muscle repair and glycogen replenishment occur overnight
- Sleep quality matters as much as quantity

### Nutrition
Post-workout recovery window:
- **0-30 min**: 0.8-1.2g carbs/kg + 0.3-0.4g protein/kg
- **2-4 hours**: Full meal with balanced macros
- **Daily**: Adequate overall protein (1.6-2.2g/kg)

### Active Recovery
Low-intensity movement aids recovery:
- 30-60 min Zone 1 (very easy)
- Increases blood flow without adding stress
- Can accelerate recovery vs complete rest

### Stress Management
Training is a stressor; life stress adds to the total:
- Mental stress impacts physical recovery
- High life stress = reduce training load
- Recovery includes mental/emotional rest

## Recovery Timeline by Workout Type

| Workout Type | Recovery Time |
|--------------|---------------|
| Easy endurance | 12-24 hours |
| Tempo/Sweet spot | 24-48 hours |
| Threshold intervals | 48-72 hours |
| VO2max intervals | 48-72 hours |
| Race effort | 72-120 hours |

## Signs of Under-Recovery

**Early warning signs:**
- Elevated resting heart rate (+5-10 bpm)
- Decreased HRV
- Persistent fatigue
- Mood changes, irritability
- Disrupted sleep despite being tired

**Later signs (overtraining):**
- Performance decline
- Increased illness frequency
- Loss of motivation
- Hormonal disruption

## Periodizing Recovery

**Weekly structure:**
- Include 1-2 recovery/easy days per week
- Place recovery days after hardest sessions

**Block structure:**
- Every 3-4 weeks: recovery week (40-60% volume)
- Allows accumulated adaptations to consolidate

## Recovery Modalities

**Well-supported:**
- Sleep
- Nutrition
- Easy active recovery
- Compression garments (modest benefit)

**Limited evidence:**
- Ice baths (may blunt adaptation)
- Massage (feels good, minimal performance impact)
- Supplements (most ineffective)

## Individual Recovery Capacity

Recovery ability varies based on:
- Training age (more experience = faster recovery)
- Chronological age (older = longer recovery)
- Sleep quality
- Life stress
- Genetics
    `.trim(),
    keyTakeaways: [
      'Adaptation happens during recovery, not during training',
      'Sleep is the most powerful recovery tool (7-9 hours)',
      'Recovery time varies by workout intensity (24-120 hours)',
      'Watch for under-recovery signs: elevated HR, mood changes, persistent fatigue',
    ],
    sources: [
      {
        title: 'Recovery Techniques for Athletes',
        url: 'https://pubmed.ncbi.nlm.nih.gov/24993578/',
        author: 'Halson SL',
        type: 'peer_reviewed',
        year: 2014,
      },
      {
        title: 'Sleep and Athletic Performance',
        url: 'https://pubmed.ncbi.nlm.nih.gov/25028798/',
        author: 'Fullagar HHK, et al',
        type: 'peer_reviewed',
        year: 2015,
      },
      {
        title: 'Nutrition for Recovery in Aquatic Sports',
        url: 'https://pubmed.ncbi.nlm.nih.gov/24149841/',
        author: 'Burke LM',
        type: 'peer_reviewed',
        year: 2014,
      },
    ],
    confidenceLevel: 'established',
    status: 'active',
    lastVerified: '2025-01-13',
    version: 1,
  },
  {
    slug: 'threshold-training',
    title: 'Threshold Training: Building FTP',
    category: 'concepts',
    excerpt: 'Threshold training targets your FTP directly, building the sustainable power that matters most for cycling performance.',
    readingTime: 5,
    content: `
## What is Threshold Training?

Threshold training targets the intensity at or near your Functional Threshold Power (FTP) - approximately 95-105% of FTP. This zone represents the boundary between sustainable aerobic exercise and rapidly fatiguing anaerobic work.

## The Physiology of Threshold

At threshold intensity:
- Lactate production equals clearance rate
- Maximum sustainable aerobic output
- High carbohydrate utilization
- Significant cardiovascular and metabolic stress

## Threshold Training Zones

| Zone | % of FTP | Purpose |
|------|----------|---------|
| Sub-threshold | 91-95% | Build toward threshold with less stress |
| Threshold | 96-100% | Target FTP directly |
| Supra-threshold | 101-105% | Push FTP higher |

## Classic Threshold Workouts

**Foundation Workouts:**
- 2x20 min @ 95-100% FTP (classic)
- 3x15 min @ 95-100% FTP
- 4x10 min @ 100% FTP

**Progression:**
- Start with shorter intervals
- Increase duration as fitness improves
- Progress from 95% toward 100% FTP

**Advanced Variations:**
- 1x40-60 min @ 95% FTP (sustained)
- Over-unders: alternating 2 min @ 105% / 2 min @ 95%
- Threshold + VO2max combo sessions

## Execution Guidelines

**Pacing:**
- Start conservatively - don't go out too hard
- Power should be steady throughout
- Last interval should feel hard but completable

**Recovery Between Intervals:**
- 5-10 minutes at Zone 1-2
- HR should drop to 60-65% max
- Longer rest = better interval quality

**Cadence:**
- 85-95 rpm typical
- Higher cadence reduces muscular strain
- Lower cadence builds strength (advanced)

## Programming Threshold Work

**Frequency:**
- 1-2 threshold sessions per week during build phase
- Allow 48-72 hours recovery between sessions
- Balance with endurance and VO2max work

**Progression Over Time:**
Week 1-2: 2x15 min @ 95%
Week 3-4: 2x20 min @ 95%
Week 5-6: 2x20 min @ 97%
Week 7-8: 3x15 min @ 100%

## When Threshold Work is Most Effective

**Best times:**
- Build phase (8-12 weeks before event)
- When FTP improvement is the goal
- After solid base is established

**Reduce threshold work:**
- During base phase (focus on aerobic foundation)
- Peak/taper phase (maintain, don't build)
- When fatigued or under-recovered
    `.trim(),
    keyTakeaways: [
      'Threshold training targets 95-105% of FTP',
      'Classic format: 2x20 minutes at threshold',
      'Include 1-2 threshold sessions per week during build phase',
      'Allow 48-72 hours recovery between threshold sessions',
    ],
    sources: [
      {
        title: 'Training and Racing with a Power Meter',
        url: 'https://www.velopress.com/books/training-and-racing-with-a-power-meter/',
        author: 'Hunter Allen, Andrew Coggan',
        type: 'textbook',
        year: 2019,
      },
      {
        title: 'The Science and Application of High-Intensity Interval Training',
        url: 'https://www.humankinetics.com/products/all-products/science-and-application-of-high-intensity-interval-training',
        author: 'Laursen PB, Buchheit M',
        type: 'textbook',
        year: 2019,
      },
    ],
    confidenceLevel: 'strong_evidence',
    status: 'active',
    lastVerified: '2025-01-13',
    version: 1,
  },
  {
    slug: 'block-periodization',
    title: 'Block Periodization: Concentrated Training Loads',
    category: 'concepts',
    excerpt: 'Block periodization concentrates specific training stimuli into focused blocks, potentially accelerating adaptation for trained athletes.',
    readingTime: 6,
    content: `
## What is Block Periodization?

Block periodization organizes training into concentrated blocks (typically 2-4 weeks) that focus on developing one or two specific qualities. This contrasts with traditional periodization that develops multiple qualities simultaneously.

## Traditional vs Block Periodization

**Traditional (Linear/Concurrent):**
- Develops multiple qualities simultaneously
- Gradual progression over long periods
- Works well for beginners/intermediate athletes

**Block Periodization:**
- Focuses on 1-2 qualities per block
- Higher concentration of specific training
- Better for advanced athletes with limited adaptation potential

## The Three Block Types

### Accumulation Block (2-4 weeks)
- **Focus:** Aerobic base, volume
- **Intensity:** Low-moderate (Zone 1-3)
- **Volume:** High
- **Goal:** Build work capacity and aerobic foundation

### Transmutation Block (2-4 weeks)
- **Focus:** Convert base into specific fitness
- **Intensity:** Moderate-high (Zone 3-5)
- **Volume:** Moderate
- **Goal:** Develop race-specific qualities

### Realization Block (1-2 weeks)
- **Focus:** Peak performance
- **Intensity:** Race-specific with reduced volume
- **Volume:** Low
- **Goal:** Shed fatigue while maintaining fitness

## Example Block Periodization Plan

**12-Week Event Preparation:**

| Weeks | Block | Focus |
|-------|-------|-------|
| 1-3 | Accumulation | Volume, Zone 2 |
| 4-6 | Transmutation 1 | Threshold development |
| 7-9 | Transmutation 2 | VO2max/race-specific |
| 10-11 | Realization | Taper, race prep |
| 12 | Race | Event execution |

## Benefits of Block Periodization

1. **Concentrated stimulus** - strong signal for adaptation
2. **Better recovery** - not all systems stressed simultaneously
3. **Measurable progression** - clear goals for each block
4. **Flexibility** - can adjust blocks based on response

## Drawbacks and Considerations

1. **Complexity** - requires careful planning
2. **Temporary detraining** - unused qualities may decline
3. **Not for beginners** - concurrent training works better initially
4. **Individual response** - some athletes don't respond well

## Implementing Block Periodization

**Planning guidelines:**
- Each block: 2-4 weeks (shorter for more advanced athletes)
- Recovery between blocks: 3-5 days reduced volume
- Test/assess at end of each block
- Adjust subsequent blocks based on response

**Block transitions:**
- Accumulation → Transmutation: reduce volume 20-30%, increase intensity
- Transmutation → Realization: reduce both volume and intensity, maintain sharpness
    `.trim(),
    keyTakeaways: [
      'Block periodization concentrates training focus into 2-4 week blocks',
      'Three block types: Accumulation (base), Transmutation (specific), Realization (peak)',
      'Better suited for advanced athletes than beginners',
      'Allows strong adaptation signal while managing fatigue',
    ],
    sources: [
      {
        title: 'Block Periodization: Breakthrough in Sport Training',
        url: 'https://www.amazon.com/Block-Periodization-Breakthrough-Sports-Training/dp/0880140100',
        author: 'Issurin VB',
        type: 'textbook',
        year: 2008,
      },
      {
        title: 'New Horizons for the Methodology and Physiology of Training Periodization',
        url: 'https://pubmed.ncbi.nlm.nih.gov/20445167/',
        author: 'Issurin VB',
        type: 'peer_reviewed',
        year: 2010,
      },
      {
        title: 'The Block Training System in Endurance Running',
        url: 'https://pubmed.ncbi.nlm.nih.gov/28515611/',
        author: 'Rønnestad BR, et al',
        type: 'peer_reviewed',
        year: 2017,
      },
    ],
    confidenceLevel: 'strong_evidence',
    status: 'active',
    lastVerified: '2025-01-13',
    version: 1,
  },
  {
    slug: 'power-zones-explained',
    title: 'Understanding Power Training Zones',
    category: 'fundamentals',
    excerpt: 'Power zones provide a framework for targeting specific physiological adaptations. Understanding them is essential for structured training.',
    readingTime: 7,
    content: `
## What are Power Zones?

Power zones are ranges of power output, expressed as percentages of FTP, that target different physiological systems. They provide a common language for prescribing and executing workouts.

## The Coggan Power Zone System

Dr. Andrew Coggan's 7-zone system is the most widely used:

| Zone | Name | % FTP | RPE | Primary Adaptation |
|------|------|-------|-----|-------------------|
| Z1 | Active Recovery | <55% | 1-2 | Recovery |
| Z2 | Endurance | 56-75% | 2-3 | Aerobic efficiency |
| Z3 | Tempo | 76-87% | 3-4 | Muscular endurance |
| Z4 | Threshold | 88-95% | 4-5 | Lactate clearance |
| Z5 | VO2max | 96-120% | 6-7 | Maximal oxygen uptake |
| Z6 | Anaerobic | 121-150% | 7-8 | Anaerobic capacity |
| Z7 | Neuromuscular | Max | 9-10 | Peak power |

## Zone Details

### Zone 1: Active Recovery (<55% FTP)
- **Feel:** Very easy, could go all day
- **Use:** Recovery rides, warm-up/cool-down
- **Duration:** 30-90 minutes
- **Benefit:** Promotes blood flow without adding stress

### Zone 2: Endurance (56-75% FTP)
- **Feel:** Easy, conversational pace
- **Use:** Long rides, base building
- **Duration:** 1-6+ hours
- **Benefit:** Builds aerobic foundation, fat oxidation

### Zone 3: Tempo (76-87% FTP)
- **Feel:** Moderate, focused but sustainable
- **Use:** Muscular endurance, group rides
- **Duration:** 20-90 minutes
- **Benefit:** Builds stamina, time efficiency

### Zone 4: Threshold (88-95% FTP)
- **Feel:** Hard, focused concentration required
- **Use:** FTP development
- **Duration:** 8-30 minutes intervals
- **Benefit:** Raises lactate threshold, FTP

### Zone 5: VO2max (96-120% FTP)
- **Feel:** Very hard, labored breathing
- **Use:** Maximal aerobic power
- **Duration:** 2-8 minute intervals
- **Benefit:** Increases VO2max, top-end power

### Zone 6: Anaerobic Capacity (121-150% FTP)
- **Feel:** Extremely hard, burning sensation
- **Use:** Short power, attacks
- **Duration:** 30 seconds - 2 minutes
- **Benefit:** Anaerobic energy system, repeatability

### Zone 7: Neuromuscular Power (Max)
- **Feel:** All-out, maximum effort
- **Use:** Sprints, peak power
- **Duration:** <30 seconds
- **Benefit:** Recruitment, peak power

## Using Zones in Training

**Polarized approach:** Mostly Z1-2, some Z5-6, minimal Z3-4
**Pyramidal approach:** Z2 base, progressively less time in higher zones
**Threshold-focused:** More Z3-4, less Z1-2

## Zone Misconceptions

**"Higher zones are better"**
- False. Each zone has a purpose; balance is key

**"Zone 2 is too easy"**
- Common mistake is riding Zone 2 too hard

**"I should always train in threshold zone"**
- Overtraining risk; need variety for balanced development

## Setting Accurate Zones

Zones depend on accurate FTP:
1. Test FTP regularly (every 4-8 weeks)
2. Use 20-min test × 0.95 or ramp test
3. Validate with real-world efforts
4. Adjust if zones don't match perceived effort
    `.trim(),
    keyTakeaways: [
      '7 zones target different physiological systems',
      'Zone 2 builds base, Zone 4 builds FTP, Zone 5 builds VO2max',
      'Accurate FTP is essential for meaningful zones',
      'Training should include multiple zones in appropriate proportions',
    ],
    sources: [
      {
        title: 'Training and Racing with a Power Meter',
        url: 'https://www.velopress.com/books/training-and-racing-with-a-power-meter/',
        author: 'Hunter Allen, Andrew Coggan',
        type: 'textbook',
        year: 2019,
      },
      {
        title: 'Power Zone Training',
        url: 'https://www.trainingpeaks.com/learn/articles/power-training-levels/',
        author: 'TrainingPeaks',
        type: 'industry',
        year: 2021,
      },
    ],
    confidenceLevel: 'established',
    status: 'active',
    lastVerified: '2025-01-13',
    version: 1,
  },
  {
    slug: 'training-load-management',
    title: 'Managing Training Load: ACWR and Beyond',
    category: 'metrics',
    excerpt: 'Proper training load management balances fitness development with injury and overtraining prevention.',
    readingTime: 6,
    content: `
## What is Training Load?

Training load is the cumulative stress from training. Managing it well means applying enough stress to adapt while avoiding injury and overtraining.

## Key Training Load Metrics

### CTL (Chronic Training Load)
- 42-day exponentially weighted average of TSS
- Represents long-term training load ("fitness")
- Changes slowly; indicates training history

### ATL (Acute Training Load)
- 7-day exponentially weighted average of TSS
- Represents short-term load ("fatigue")
- Changes quickly with recent training

### TSB (Training Stress Balance)
- TSB = CTL - ATL
- Represents "form" or readiness
- Negative = fatigued, Positive = fresh

### ACWR (Acute:Chronic Workload Ratio)
- ACWR = ATL / CTL
- Compares recent load to historical load
- Used for injury risk assessment

## ACWR Guidelines

| ACWR | Status | Risk |
|------|--------|------|
| <0.8 | Under-training | Detraining risk |
| 0.8-1.3 | Sweet spot | Low injury risk |
| 1.3-1.5 | Caution zone | Moderate injury risk |
| >1.5 | Danger zone | High injury risk |

**The "sweet spot":** ACWR between 0.8-1.3 balances adaptation with injury prevention.

## Training Load Principles

### Progressive Overload
- Gradually increase training load over time
- Aim for 3-7% weekly increase in CTL
- Allows adaptation without overwhelming system

### Load-Recovery Balance
- Every 3-4 weeks: recovery week (50-60% normal load)
- Hard days followed by easy days
- Watch TSB - extended negative periods risky

### Monotony and Strain
**Monotony** = average daily load / standard deviation
- High monotony (>2.0) = too repetitive, risk of staleness
- Vary training day to day

**Strain** = weekly load × monotony
- High strain periods need extra recovery

## Practical Load Management

### Week-to-Week Planning
- Build weeks: increase volume 5-10%
- Recovery weeks: reduce to 50-60%
- 3:1 or 2:1 build:recovery ratio

### Day-to-Day Planning
- Alternate hard and easy days
- Group intense sessions (e.g., back-to-back threshold days, then 2 easy days)
- Monitor fatigue signals

### Signs of Excessive Load
- Performance decline despite training
- Elevated resting HR
- Decreased HRV
- Poor sleep quality
- Mood disturbances
- Increased illness

## Using PMC for Load Management

**Monitor these trends:**
1. CTL trajectory (gradual increase during build)
2. ATL spikes (watch for excessive jumps)
3. TSB valleys (don't stay below -30 for long)
4. ACWR (keep in 0.8-1.3 range)

**Adjusting based on data:**
- CTL rising too fast: add recovery days
- TSB chronically negative: reduce volume
- ACWR >1.5: reduce this week's load
    `.trim(),
    keyTakeaways: [
      'ACWR sweet spot is 0.8-1.3 for balancing adaptation and injury risk',
      'Increase CTL gradually (3-7% per week maximum)',
      'Include recovery weeks every 3-4 weeks',
      'Monitor for signs of excessive load: elevated HR, poor sleep, mood changes',
    ],
    sources: [
      {
        title: 'Monitoring Training Load to Understand Fatigue in Athletes',
        url: 'https://pubmed.ncbi.nlm.nih.gov/24442571/',
        author: 'Halson SL',
        type: 'peer_reviewed',
        year: 2014,
      },
      {
        title: 'The Training-Injury Prevention Paradox',
        url: 'https://pubmed.ncbi.nlm.nih.gov/26592419/',
        author: 'Gabbett TJ',
        type: 'peer_reviewed',
        year: 2016,
      },
      {
        title: 'Modeling Human Performance in Running',
        url: 'https://pubmed.ncbi.nlm.nih.gov/2022559/',
        author: 'Banister EW',
        type: 'peer_reviewed',
        year: 1991,
      },
    ],
    confidenceLevel: 'established',
    status: 'active',
    lastVerified: '2025-01-13',
    version: 1,
  },
  {
    slug: 'overtraining-prevention',
    title: 'Preventing Overtraining Syndrome',
    category: 'fundamentals',
    excerpt: 'Overtraining syndrome is a serious condition that can take months to recover from. Prevention through monitoring and load management is essential.',
    readingTime: 6,
    content: `
## What is Overtraining Syndrome?

Overtraining Syndrome (OTS) is a maladapted response to excessive training without adequate recovery. It results in long-term performance decrements that persist despite rest.

**Important distinction:**
- **Overreaching:** Short-term performance decline that resolves with rest (days to weeks)
- **Overtraining:** Severe, persistent decline requiring months to recover

## Overtraining Continuum

1. **Functional Overreaching** - Temporary decline, supercompensation with rest (normal)
2. **Non-Functional Overreaching** - Decline requiring weeks to recover (warning sign)
3. **Overtraining Syndrome** - Severe decline requiring months to recover (serious)

## Signs and Symptoms

### Performance Indicators
- Decreased performance despite training
- Inability to complete normal workouts
- Extended time to recover between sessions
- Loss of competitive drive

### Physiological Signs
- Elevated resting heart rate (+5-10 bpm)
- Decreased heart rate variability
- Hormonal disruption (cortisol, testosterone)
- Increased susceptibility to illness
- Persistent muscle soreness

### Psychological Signs
- Mood disturbances (irritability, depression)
- Loss of motivation
- Decreased concentration
- Sleep disturbances
- Anxiety about training

## Risk Factors

**Training factors:**
- Rapid increase in training load
- Insufficient recovery between sessions
- Monotonous training (high monotony score)
- High-intensity training without adequate base

**Lifestyle factors:**
- Poor sleep quality/quantity
- High life stress (work, relationships)
- Inadequate nutrition
- Illness or injury while training through

## Prevention Strategies

### Load Management
- Progressive overload (max 5-10% weekly increase)
- Regular recovery weeks (every 3-4 weeks)
- Periodized training plan
- Monitor ACWR (keep 0.8-1.3)

### Recovery Optimization
- Prioritize sleep (7-9 hours)
- Adequate nutrition and hydration
- Manage life stress
- Active recovery days

### Monitoring
- Track resting heart rate daily
- Use HRV if available
- Note mood and motivation
- Log sleep quality
- Watch for warning signs

## Warning Signs to Act On

**Reduce training if you notice:**
- Resting HR elevated 5+ bpm for several days
- Performance declining despite feeling rested
- Getting sick more frequently
- Persistent fatigue not relieved by rest
- Loss of enthusiasm for training

## Recovery from Overtraining

If OTS occurs:
1. **Complete rest** - No training until symptoms resolve
2. **Address all stressors** - Sleep, nutrition, life stress
3. **Gradual return** - Very slow reintroduction of training
4. **Patience** - Full recovery may take 3-6 months
5. **Learn from it** - Identify what went wrong

## The Coach's Role

- Build in mandatory recovery weeks
- Monitor athlete feedback and metrics
- Be willing to reduce planned training
- Consider total life stress, not just training
- Foster open communication about fatigue
    `.trim(),
    keyTakeaways: [
      'Overtraining syndrome requires months to recover - prevention is essential',
      'Watch for warning signs: elevated HR, mood changes, performance decline',
      'Key prevention: progressive load, regular recovery weeks, sleep, nutrition',
      'If symptoms appear, reduce training immediately - don\'t push through',
    ],
    sources: [
      {
        title: 'Prevention, Diagnosis and Treatment of the Overtraining Syndrome',
        url: 'https://pubmed.ncbi.nlm.nih.gov/22561606/',
        author: 'Meeusen R, et al',
        type: 'peer_reviewed',
        year: 2013,
      },
      {
        title: 'Overtraining Syndrome',
        url: 'https://pubmed.ncbi.nlm.nih.gov/28035585/',
        author: 'Kreher JB, Schwartz JB',
        type: 'peer_reviewed',
        year: 2012,
      },
      {
        title: 'Markers for Detection of Overreaching and Overtraining',
        url: 'https://pubmed.ncbi.nlm.nih.gov/15730338/',
        author: 'Halson SL, Jeukendrup AE',
        type: 'peer_reviewed',
        year: 2004,
      },
    ],
    confidenceLevel: 'established',
    status: 'active',
    lastVerified: '2025-01-13',
    version: 1,
  },
]

export function getArticleBySlug(slug: string): WikiArticle | undefined {
  return articles.find(a => a.slug === slug)
}

export function getArticlesByCategory(category: WikiArticle['category']): WikiArticle[] {
  return articles.filter(a => a.category === category)
}

export function searchArticles(query: string): WikiArticle[] {
  const lowerQuery = query.toLowerCase()
  return articles.filter(a =>
    a.title.toLowerCase().includes(lowerQuery) ||
    a.excerpt.toLowerCase().includes(lowerQuery) ||
    a.content.toLowerCase().includes(lowerQuery)
  )
}
