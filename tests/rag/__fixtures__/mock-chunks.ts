/**
 * Mock Wiki Chunks and Sessions for Testing
 *
 * Pre-computed test data that simulates Supabase responses.
 * Used to enable offline testing without a real database.
 */

import type { WikiChunk, SessionEmbedding } from '@/lib/rag/vector-store'

/**
 * Mock wiki chunks with realistic data and governance metadata
 */
export const mockWikiChunks: WikiChunk[] = [
  {
    id: 'chunk-ftp-1',
    article_slug: 'what-is-ftp',
    title: 'What is FTP?',
    content:
      'FTP (Functional Threshold Power) is the highest average power you can sustain for approximately one hour. It represents your lactate threshold and is the foundation of power-based training zones.',
    similarity: 0.85,
    confidenceLevel: 'established',
    consensusNote: undefined,
    sourceCount: 5,
    lastVerified: '2024-01-15',
  },
  {
    id: 'chunk-ftp-2',
    article_slug: 'what-is-ftp',
    title: 'What is FTP?',
    content:
      'To test your FTP, perform a 20-minute all-out effort and multiply the average power by 0.95. This accounts for the difference between 20-minute and 60-minute sustainable power.',
    similarity: 0.78,
    confidenceLevel: 'established',
    consensusNote: undefined,
    sourceCount: 5,
    lastVerified: '2024-01-15',
  },
  {
    id: 'chunk-tss-1',
    article_slug: 'tss-training-stress-score',
    title: 'TSS - Training Stress Score',
    content:
      'Training Stress Score (TSS) quantifies the physiological cost of a workout. It considers both intensity and duration, normalized to your FTP. 100 TSS equals one hour at FTP.',
    similarity: 0.82,
    confidenceLevel: 'established',
    consensusNote: undefined,
    sourceCount: 4,
    lastVerified: '2024-01-10',
  },
  {
    id: 'chunk-ctl-1',
    article_slug: 'ctl-atl-tsb-explained',
    title: 'CTL, ATL, TSB Explained',
    content:
      'CTL (Chronic Training Load) represents your fitness level as a 42-day exponentially weighted average of TSS. ATL (Acute Training Load) is your fatigue using a 7-day average.',
    similarity: 0.80,
    confidenceLevel: 'established',
    consensusNote: undefined,
    sourceCount: 3,
    lastVerified: '2024-01-12',
  },
  {
    id: 'chunk-polarized-1',
    article_slug: 'polarized-training',
    title: 'Polarized Training',
    content:
      'Polarized training distributes volume with approximately 80% low intensity (Zone 1-2) and 20% high intensity (Zone 4-5), avoiding the middle Zone 3.',
    similarity: 0.75,
    confidenceLevel: 'strong_evidence',
    consensusNote: 'While highly effective for elite athletes, optimal distribution for recreational cyclists is still being studied.',
    sourceCount: 6,
    lastVerified: '2024-01-08',
  },
  {
    id: 'chunk-sweet-spot-1',
    article_slug: 'sweet-spot-training',
    title: 'Sweet Spot Training',
    content:
      'Sweet spot training targets 88-94% of FTP, balancing training stress with recovery demands. It offers efficient fitness gains for time-crunched athletes.',
    similarity: 0.72,
    confidenceLevel: 'strong_evidence',
    consensusNote: undefined,
    sourceCount: 4,
    lastVerified: '2024-01-05',
  },
  {
    id: 'chunk-recovery-1',
    article_slug: 'recovery-principles',
    title: 'Recovery Principles',
    content:
      'Recovery is when adaptation occurs. Key factors include sleep (7-9 hours), nutrition timing, active recovery rides, and managing training load progression.',
    similarity: 0.70,
    confidenceLevel: 'established',
    consensusNote: undefined,
    sourceCount: 5,
    lastVerified: '2024-01-14',
  },
  {
    id: 'chunk-overtraining-1',
    article_slug: 'overtraining-prevention',
    title: 'Overtraining Prevention',
    content:
      'Overtraining syndrome results from chronic imbalance between training stress and recovery. Early signs include persistent fatigue, elevated resting heart rate, and declining performance despite continued training.',
    similarity: 0.68,
    confidenceLevel: 'established',
    consensusNote: undefined,
    sourceCount: 4,
    lastVerified: '2024-01-11',
  },
  {
    id: 'chunk-zones-1',
    article_slug: 'power-zones-explained',
    title: 'Power Zones Explained',
    content:
      'Power zones are training intensity bands based on FTP. Zone 2 (55-75% FTP) builds aerobic base. Zone 4 (91-105% FTP) develops threshold. Zone 5 (106-120% FTP) targets VO2max.',
    similarity: 0.76,
    confidenceLevel: 'established',
    consensusNote: undefined,
    sourceCount: 4,
    lastVerified: '2024-01-09',
  },
  {
    id: 'chunk-threshold-1',
    article_slug: 'threshold-training',
    title: 'Threshold Training',
    content:
      'Threshold intervals at 95-105% FTP improve lactate clearance and sustainable power. Classic workouts include 2x20 minutes and 3x15 minutes at threshold.',
    similarity: 0.74,
    confidenceLevel: 'established',
    consensusNote: undefined,
    sourceCount: 4,
    lastVerified: '2024-01-06',
  },
  {
    id: 'chunk-debated-1',
    article_slug: 'training-load-management',
    title: 'Training Load Management',
    content:
      'ACWR (Acute:Chronic Workload Ratio) compares recent to long-term training load. A ratio between 0.8-1.3 is often cited as optimal, though individual variation exists.',
    similarity: 0.71,
    confidenceLevel: 'debated',
    consensusNote: 'The ACWR "sweet spot" of 0.8-1.3 has been questioned in recent research. Individual baselines may be more relevant than universal thresholds.',
    sourceCount: 8,
    lastVerified: '2024-01-13',
  },
  {
    id: 'chunk-emerging-1',
    article_slug: 'vo2max-development',
    title: 'VO2max Development',
    content:
      'VO2max intervals (3-8 minutes at 106-120% FTP) stress aerobic capacity. Recent research suggests shorter intervals (30/30s) may be equally effective with less perceived effort.',
    similarity: 0.69,
    confidenceLevel: 'emerging',
    consensusNote: 'Short-short intervals are showing promise in recent studies but long-term effectiveness compared to traditional protocols needs more research.',
    sourceCount: 3,
    lastVerified: '2024-01-07',
  },
]

/**
 * Mock session embeddings for athlete history testing
 */
export const mockSessionEmbeddings: SessionEmbedding[] = [
  {
    id: 'session-1',
    session_id: 'sess-001',
    summary: 'Threshold workout: 2x20 at 280W, RPE 7, felt strong in second interval. HR stayed controlled at 165bpm.',
    similarity: 0.78,
  },
  {
    id: 'session-2',
    session_id: 'sess-002',
    summary: 'Recovery ride: 45 min Z1, avg 150W. Legs felt tired from yesterday. Good for clearing lactate.',
    similarity: 0.65,
  },
  {
    id: 'session-3',
    session_id: 'sess-003',
    summary: 'VO2max intervals: 5x4min at 320W. Struggled on intervals 4-5, cut last one short. May need more recovery.',
    similarity: 0.72,
  },
  {
    id: 'session-4',
    session_id: 'sess-004',
    summary: 'Sweet spot: 3x15 at 265W. Smooth session, maintained power well. Good aerobic conditioning.',
    similarity: 0.75,
  },
  {
    id: 'session-5',
    session_id: 'sess-005',
    summary: 'Endurance ride: 2.5 hours Z2, avg 185W. Beautiful weather, felt sustainable throughout.',
    similarity: 0.60,
  },
]

/**
 * Filter mock wiki chunks by similarity threshold and count
 */
export function filterMockWikiChunks(
  query: string,
  options: { matchThreshold?: number; matchCount?: number } = {}
): WikiChunk[] {
  const { matchThreshold = 0.4, matchCount = 5 } = options

  // Simple keyword-based filtering for deterministic test results
  const queryLower = query.toLowerCase()

  let filtered = mockWikiChunks.filter((chunk) => {
    // Check if query terms appear in content or title
    const contentLower = chunk.content.toLowerCase()
    const titleLower = chunk.title.toLowerCase()
    const slugLower = chunk.article_slug.toLowerCase()

    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2)

    // Match if any significant term matches
    const hasMatch = queryTerms.some(
      (term) =>
        contentLower.includes(term) ||
        titleLower.includes(term) ||
        slugLower.includes(term)
    )

    return hasMatch && (chunk.similarity || 0) >= matchThreshold
  })

  // Sort by similarity descending
  filtered.sort((a, b) => (b.similarity || 0) - (a.similarity || 0))

  return filtered.slice(0, matchCount)
}

/**
 * Filter mock session embeddings by athlete ID and options
 */
export function filterMockSessionEmbeddings(
  query: string,
  athleteId: string,
  options: { matchThreshold?: number; matchCount?: number } = {}
): SessionEmbedding[] {
  const { matchThreshold = 0.4, matchCount = 5 } = options

  // For testing, we'll return sessions based on query keywords
  const queryLower = query.toLowerCase()

  let filtered = mockSessionEmbeddings.filter((session) => {
    const summaryLower = session.summary.toLowerCase()
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2)

    const hasMatch = queryTerms.some((term) => summaryLower.includes(term))
    return hasMatch && (session.similarity || 0) >= matchThreshold
  })

  // Sort by similarity descending
  filtered.sort((a, b) => (b.similarity || 0) - (a.similarity || 0))

  return filtered.slice(0, matchCount)
}

/**
 * Get a chunk by article slug (for targeted tests)
 */
export function getMockChunkBySlug(slug: string): WikiChunk | undefined {
  return mockWikiChunks.find((chunk) => chunk.article_slug === slug)
}

/**
 * Get all unique article slugs from mock data
 */
export function getMockArticleSlugs(): string[] {
  return [...new Set(mockWikiChunks.map((chunk) => chunk.article_slug))]
}
