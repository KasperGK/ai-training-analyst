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
