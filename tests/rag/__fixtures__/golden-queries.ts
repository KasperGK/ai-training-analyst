/**
 * Golden Query Test Set for RAG Validation
 *
 * These curated queries represent realistic user questions and their
 * expected article matches. Used to validate search quality.
 *
 * Categories:
 * - fundamentals: Core training concepts every cyclist should know
 * - metrics: Understanding training numbers and calculations
 * - concepts: Advanced training theory and methodology
 * - edge-cases: Boundary testing (short queries, gibberish, off-topic)
 * - typos: Common misspellings that should still match
 * - negative: Queries that should return no results
 * - ambiguous: Queries that could match multiple topics
 * - multi-match: Queries expected to return multiple relevant articles
 */

export interface GoldenQuery {
  /** The user's search query */
  query: string
  /** Expected article slugs that should be returned */
  expected: string[]
  /** Category for grouping test results */
  category:
    | 'fundamentals'
    | 'metrics'
    | 'concepts'
    | 'edge-cases'
    | 'typos'
    | 'negative'
    | 'ambiguous'
    | 'multi-match'
  /** Minimum similarity score expected (default 0.4) */
  minSimilarity?: number
  /** Description of what this test validates */
  description?: string
}

export const goldenQueries: GoldenQuery[] = [
  // ============================================
  // FUNDAMENTALS - Core Training Concepts
  // ============================================
  {
    query: 'how to improve FTP',
    expected: ['what-is-ftp', 'threshold-training'],
    category: 'fundamentals',
  },
  {
    query: 'what is functional threshold power',
    expected: ['what-is-ftp'],
    category: 'fundamentals',
  },
  {
    query: 'power zones cycling explained',
    expected: ['power-zones-explained'],
    category: 'fundamentals',
  },
  {
    query: 'building aerobic base training',
    expected: ['base-building'],
    category: 'fundamentals',
  },
  {
    query: 'how to recover between workouts',
    expected: ['recovery-principles'],
    category: 'fundamentals',
  },
  {
    query: 'what is zone 2 training',
    expected: ['power-zones-explained', 'base-building'],
    category: 'fundamentals',
  },
  {
    query: 'lactate threshold cycling',
    expected: ['what-is-ftp', 'threshold-training'],
    category: 'fundamentals',
  },

  // ============================================
  // METRICS - Understanding Training Numbers
  // ============================================
  {
    query: 'what is TSS training stress score',
    expected: ['tss-training-stress-score'],
    category: 'metrics',
  },
  {
    query: 'CTL ATL TSB explained',
    expected: ['ctl-atl-tsb-explained'],
    category: 'metrics',
  },
  {
    query: 'normalized power vs average power',
    expected: ['normalized-power'],
    category: 'metrics',
  },
  {
    query: 'what is ACWR training load',
    expected: ['training-load-management'],
    category: 'metrics',
  },
  {
    query: 'fitness fatigue form model',
    expected: ['ctl-atl-tsb-explained'],
    category: 'metrics',
  },
  {
    query: 'how to read PMC chart',
    expected: ['reading-pmc-chart', 'ctl-atl-tsb-explained'],
    category: 'metrics',
  },
  {
    query: 'performance management chart interpretation',
    expected: ['reading-pmc-chart'],
    category: 'metrics',
  },
  {
    query: 'intensity factor calculation',
    expected: ['normalized-power', 'tss-training-stress-score'],
    category: 'metrics',
  },

  // ============================================
  // CONCEPTS - Advanced Training Theory
  // ============================================
  {
    query: 'am I overtraining symptoms prevention',
    expected: ['overtraining-prevention', 'recovery-principles'],
    category: 'concepts',
  },
  {
    query: 'polarized vs sweet spot training',
    expected: ['polarized-training', 'sweet-spot-training'],
    category: 'concepts',
  },
  {
    query: 'how to taper for race',
    expected: ['tapering-for-events'],
    category: 'concepts',
  },
  {
    query: 'VO2max intervals how to',
    expected: ['vo2max-development'],
    category: 'concepts',
  },
  {
    query: 'block periodization explained',
    expected: ['block-periodization'],
    category: 'concepts',
  },
  {
    query: 'threshold intervals FTP workouts',
    expected: ['threshold-training', 'what-is-ftp'],
    category: 'concepts',
  },
  {
    query: '80/20 training intensity distribution',
    expected: ['polarized-training'],
    category: 'concepts',
    description: 'Polarized training is often called 80/20',
  },
  {
    query: 'when to take rest days cycling',
    expected: ['recovery-principles', 'overtraining-prevention'],
    category: 'concepts',
  },

  // ============================================
  // EDGE CASES - Boundary Testing
  // ============================================
  {
    query: 'xyzabc123',
    expected: [], // Gibberish should return no results
    category: 'edge-cases',
  },
  {
    query: 'marathon running training plan',
    expected: [], // Off-topic (cycling-focused content)
    category: 'edge-cases',
  },
  {
    query: 'z2',
    expected: ['power-zones-explained'], // Short query should still match
    category: 'edge-cases',
    minSimilarity: 0.35, // Lower threshold for short queries
  },
  {
    query: 'FTP',
    expected: ['what-is-ftp'],
    category: 'edge-cases',
    minSimilarity: 0.35, // Short query
  },
  {
    query: 'NP',
    expected: ['normalized-power'],
    category: 'edge-cases',
    minSimilarity: 0.3, // Very short acronym
    description: 'NP is common shorthand for normalized power',
  },
  {
    query: 'IF',
    expected: ['normalized-power', 'tss-training-stress-score'],
    category: 'edge-cases',
    minSimilarity: 0.3,
    description: 'IF (Intensity Factor) should match related metrics',
  },

  // ============================================
  // TYPOS - Common Misspellings
  // ============================================
  {
    query: 'what is FPT',
    expected: ['what-is-ftp'],
    category: 'typos',
    minSimilarity: 0.35,
    description: 'Common letter swap typo for FTP',
  },
  {
    query: 'TTS score cycling',
    expected: ['tss-training-stress-score'],
    category: 'typos',
    minSimilarity: 0.35,
    description: 'TSS misspelled as TTS',
  },
  {
    query: 'treshhold training',
    expected: ['threshold-training'],
    category: 'typos',
    description: 'Threshold commonly misspelled',
  },
  {
    query: 'periodizaton cycling',
    expected: ['block-periodization'],
    category: 'typos',
    description: 'Periodization missing letter',
  },
  {
    query: 'recoverey principles',
    expected: ['recovery-principles'],
    category: 'typos',
    description: 'Recovery with extra letter',
  },
  {
    query: 'overtraning syndrome',
    expected: ['overtraining-prevention'],
    category: 'typos',
    description: 'Overtraining missing letter',
  },
  {
    query: 'V02max training',
    expected: ['vo2max-development'],
    category: 'typos',
    description: 'VO2max with zero instead of O',
  },
  {
    query: 'sweat spot training',
    expected: ['sweet-spot-training'],
    category: 'typos',
    minSimilarity: 0.35,
    description: 'Sweet spot homophone error',
  },

  // ============================================
  // NEGATIVE - Should Return No Results
  // ============================================
  {
    query: 'basketball training drills',
    expected: [],
    category: 'negative',
    description: 'Completely off-topic sport',
  },
  {
    query: 'stock market investment tips',
    expected: [],
    category: 'negative',
    description: 'Non-training topic',
  },
  {
    query: 'python programming tutorial',
    expected: [],
    category: 'negative',
    description: 'Technology topic unrelated to cycling',
  },
  {
    query: 'healthy dinner recipes',
    expected: [],
    category: 'negative',
    description: 'Tangentially related but not training science',
  },
  {
    query: '!!!@@@###',
    expected: [],
    category: 'negative',
    description: 'Special characters only',
  },

  // ============================================
  // AMBIGUOUS - Could Match Multiple Topics
  // ============================================
  {
    query: 'zones',
    expected: ['power-zones-explained'],
    category: 'ambiguous',
    minSimilarity: 0.3,
    description: 'Ambiguous but power zones most relevant',
  },
  {
    query: 'training load',
    expected: ['training-load-management', 'tss-training-stress-score'],
    category: 'ambiguous',
    description: 'Could match TSS or ACWR/load management',
  },
  {
    query: 'intervals',
    expected: ['threshold-training', 'vo2max-development'],
    category: 'ambiguous',
    minSimilarity: 0.35,
    description: 'Generic interval query should match interval-focused articles',
  },
  {
    query: 'threshold',
    expected: ['threshold-training', 'what-is-ftp'],
    category: 'ambiguous',
    minSimilarity: 0.35,
    description: 'Threshold concept spans FTP and threshold training',
  },
  {
    query: 'fatigue',
    expected: ['ctl-atl-tsb-explained', 'overtraining-prevention', 'recovery-principles'],
    category: 'ambiguous',
    minSimilarity: 0.3,
    description: 'Fatigue is discussed in multiple contexts',
  },
  {
    query: 'fitness',
    expected: ['ctl-atl-tsb-explained'],
    category: 'ambiguous',
    minSimilarity: 0.3,
    description: 'CTL represents fitness in the PMC model',
  },

  // ============================================
  // MULTI-MATCH - Should Return Multiple Articles
  // ============================================
  {
    query: 'training stress and recovery balance',
    expected: ['tss-training-stress-score', 'recovery-principles', 'ctl-atl-tsb-explained'],
    category: 'multi-match',
    description: 'Comprehensive query touching multiple topics',
  },
  {
    query: 'power based training metrics',
    expected: ['normalized-power', 'tss-training-stress-score', 'what-is-ftp'],
    category: 'multi-match',
    description: 'General power metrics query',
  },
  {
    query: 'how to structure training season',
    expected: ['block-periodization', 'base-building', 'tapering-for-events'],
    category: 'multi-match',
    description: 'Season planning spans multiple concepts',
  },
  {
    query: 'high intensity interval training cycling',
    expected: ['vo2max-development', 'threshold-training', 'polarized-training'],
    category: 'multi-match',
    description: 'HIIT covered across several articles',
  },
  {
    query: 'prevent burnout and overreaching',
    expected: ['overtraining-prevention', 'recovery-principles', 'training-load-management'],
    category: 'multi-match',
    description: 'Burnout prevention spans recovery and load management',
  },
  {
    query: 'race preparation final weeks',
    expected: ['tapering-for-events', 'ctl-atl-tsb-explained'],
    category: 'multi-match',
    description: 'Tapering and managing form for events',
  },
]

/**
 * Queries to test coverage gaps - these log results rather than fail
 * Used to identify content needs for future phases (e.g., Zwift content)
 */
export const coverageGapQueries: string[] = [
  // Nutrition - partial coverage
  'nutrition for cyclists during rides',
  'carbohydrate loading before race',
  'hydration strategy cycling',
  'post workout protein timing',
  'fueling for long rides',

  // Heat/Environment - likely gaps
  'heat adaptation training',
  'altitude training benefits',
  'cold weather cycling tips',
  'training in humidity',

  // Zwift/Indoor - known gap (Phase 2)
  'zwift racing tactics',
  'e-racing strategy tips',
  'virtual cycling power gaming',
  'zwift race categories explained',
  'indoor trainer workouts',
  'smart trainer calibration',

  // Mental/Psychology - potential gap
  'mental training for cyclists',
  'race day anxiety management',
  'motivation during hard training',
  'dealing with performance plateau',

  // Strength - potential gap
  'strength training for cyclists',
  'core exercises cycling performance',
  'leg strength off-bike workouts',
  'gym routine for cyclists',

  // Equipment/Tech - potential gap
  'power meter accuracy',
  'heart rate monitor vs power',
  'bike fit for performance',

  // Special populations - potential gap
  'training as masters cyclist',
  'returning after injury',
  'training with limited time',
]

/**
 * All article slugs in the wiki for completeness checking
 */
export const allArticleSlugs = [
  'what-is-ftp',
  'tss-training-stress-score',
  'ctl-atl-tsb-explained',
  'normalized-power',
  'tapering-for-events',
  'reading-pmc-chart',
  'polarized-training',
  'sweet-spot-training',
  'vo2max-development',
  'base-building',
  'recovery-principles',
  'threshold-training',
  'block-periodization',
  'power-zones-explained',
  'training-load-management',
  'overtraining-prevention',
]

/**
 * Get queries by category
 */
export function getQueriesByCategory(
  category: GoldenQuery['category']
): GoldenQuery[] {
  return goldenQueries.filter((q) => q.category === category)
}

/**
 * Get count of queries per category
 */
export function getQueryCountByCategory(): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const query of goldenQueries) {
    counts[query.category] = (counts[query.category] || 0) + 1
  }
  return counts
}

/**
 * Validate that all expected slugs are valid article slugs
 */
export function validateExpectedSlugs(): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const slugSet = new Set(allArticleSlugs)

  for (const query of goldenQueries) {
    for (const slug of query.expected) {
      if (!slugSet.has(slug)) {
        errors.push(`Query "${query.query}" expects unknown slug: ${slug}`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}
