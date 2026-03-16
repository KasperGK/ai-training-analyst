/**
 * Prompts and scoring rubrics for session report generation
 *
 * Type-specific rubrics with concrete metric anchors to produce
 * meaningful, differentiated scores across session types.
 */

export type SessionType = 'race' | 'workout' | 'endurance' | 'recovery' | 'unknown'

const RACE_RUBRIC = `
## Scoring Rubric — RACE (weights: Execution 50%, Training Value 20%, Recovery 30%)

### Execution (50%)
How well the race was paced and managed tactically.
- **90-100**: Elite pacing — VI < 1.05, negative split or even effort, smart power management throughout
- **75-89**: Good pacing — VI 1.05-1.10, minor surges but controlled, solid power distribution
- **55-74**: Mediocre pacing — VI 1.10-1.15, went out too hard, faded in final quarter
- **35-54**: Poor pacing — VI > 1.15, significant fade, large power drops in second half
- **0-34**: Blown up — abandoned or wildly uneven effort, major tactical errors
HARD CAPS: VI > 1.15 → Execution CANNOT exceed 60. VI > 1.20 → cannot exceed 45.

### Training Value (20%)
Racing provides high training stimulus by nature.
- **90-100**: Max race effort at appropriate duration — IF > 0.95 for 1hr+
- **70-89**: Strong effort — IF 0.85-0.95, meaningful race stimulus
- **50-69**: Moderate effort — IF 0.75-0.85, held back or short event
- **30-49**: Soft race — IF < 0.75, didn't race hard
HARD FLOOR: IF > 0.90 for >1hr → Training Value CANNOT go below 70.

### Recovery (30%)
Was the athlete fresh enough to race well?
- **90-100**: Tapered and fresh — TSB > 5, ideal race readiness
- **70-89**: Reasonably fresh — TSB 0 to 5, acceptable form
- **50-69**: Slightly fatigued — TSB -10 to 0, compromised but manageable
- **30-49**: Fatigued — TSB -10 to -20, racing on tired legs
- **0-29**: Deeply fatigued — TSB < -20, racing risks injury/overtraining

**Calibration examples:**
- Score 92: VI=1.03, IF=0.96, TSB=+8, negative split, strong finish → near-perfect race execution
- Score 48: VI=1.18, IF=0.88, TSB=-15, faded badly last 20min → went out too hard while fatigued
`

const ENDURANCE_RUBRIC = `
## Scoring Rubric — ENDURANCE / ZONE 2 (weights: Execution 50%, Training Value 30%, Recovery 20%)

### Execution (50%)
Did the athlete maintain proper endurance intensity discipline?
- **90-100**: Perfect Z2 discipline — >90% time in Z1-Z2, decoupling <3%, rock-steady power
- **75-89**: Good discipline — 80-90% time in Z1-Z2, decoupling 3-5%, mostly steady
- **55-74**: Drifted above target — 70-80% in Z1-Z2, decoupling 5-8%, some Z3+ excursions
- **35-54**: Poor discipline — <70% in Z1-Z2, frequent tempo/threshold surges
- **0-34**: Not an endurance ride — majority of time above Z2, basically a tempo ride
HARD CAPS: >15% time above Z2 → Execution CANNOT exceed 60. Decoupling >10% → cannot exceed 65.

### Training Value (30%)
Endurance value comes from sustained duration at proper intensity.
- **90-100**: Long ride (2.5hr+) at perfect Z2 intensity — ideal aerobic development
- **75-89**: Good duration (1.5-2.5hr) at proper intensity
- **55-74**: Moderate ride (1-1.5hr) — some aerobic benefit but short for endurance gains
- **35-54**: Short ride (<1hr) — limited endurance stimulus
- **0-29**: Too short or wrong intensity to provide endurance benefit

### Recovery (20%)
Endurance rides are low-stress — recovery context matters less.
- **90-100**: Well-timed easy ride in recovery phase
- **70-89**: Appropriate placement in training week
- **50-69**: Acceptable but could be better timed
- **30-49**: Unnecessary volume when already fatigued

**Calibration examples:**
- Score 91: 3hr ride, 92% in Z1-Z2, decoupling 2.1%, steady power, TSB=-3 → textbook endurance ride
- Score 42: 45min ride, 65% in Z1-Z2, multiple Z4 surges, IF=0.78 → not endurance, too short and too hard
`

const WORKOUT_RUBRIC = `
## Scoring Rubric — WORKOUT / INTERVALS (weights: Execution 50%, Training Value 30%, Recovery 20%)

### Execution (50%)
Did the athlete execute the structured work as intended?
- **90-100**: Nailed it — hit all target powers, consistent across sets, clean recovery between reps
- **75-89**: Good execution — slight fade in later sets (<5%), mostly on target
- **55-74**: Partial execution — noticeable fade (5-10%), missed some targets, inconsistent reps
- **35-54**: Poor execution — significant fade (>10%), abandoned intervals early, or wildly off target
- **0-34**: Failed workout — couldn't complete the structure, major undershoot on targets
HARD CAPS: Power fade >10% across sets → Execution CANNOT exceed 65. All targets hit → Execution CANNOT go below 85.

### Training Value (30%)
Did this workout provide the right physiological stimulus?
- **90-100**: Perfect match — appropriate zone targeting for goals, ideal interval structure
- **75-89**: Good stimulus — right ballpark intensity, meaningful training stress
- **55-74**: Moderate stimulus — slightly off-target zones or suboptimal structure
- **35-54**: Limited stimulus — wrong intensity for stated goals, or junk volume between zones
- **0-29**: Counterproductive — inappropriate intensity, no clear training target

### Recovery (20%)
Was the athlete ready for this hard session?
- **90-100**: Fresh and ready — TSB > 0, primed for quality work
- **70-89**: Acceptable freshness — TSB -5 to 0, slightly fatigued but manageable
- **50-69**: Fatigued — TSB -5 to -15, compromised quality likely
- **30-49**: Overreaching — TSB < -15, hard session on very tired legs
- **0-29**: Red flag — deeply fatigued, this session risks overtraining

**Calibration examples:**
- Score 88: 5x5min VO2max intervals, hit 105-108% FTP on all reps, <3% fade, TSB=+2 → sharp execution when fresh
- Score 39: 4x8min threshold, faded from 100% to 82% FTP by set 3, abandoned set 4, TSB=-18 → too fatigued to execute
`

const RECOVERY_RUBRIC = `
## Scoring Rubric — RECOVERY (weights: Execution 60%, Training Value 10%, Recovery 30%)

### Execution (60%)
The #1 job of a recovery ride is to stay EASY. This dimension dominates.
- **90-100**: Perfectly easy — IF < 0.55, avg HR well below Z2 ceiling, zero power spikes, short duration (30-60min)
- **75-89**: Mostly easy — IF 0.55-0.62, brief minor excursions but quickly corrected
- **55-74**: Too hard for recovery — IF 0.62-0.68, crept into tempo territory
- **35-54**: Not recovery — IF 0.68-0.75, this was a light endurance ride, not recovery
- **0-34**: Counterproductive — IF > 0.75, this added fatigue instead of aiding recovery
HARD CAPS: IF > 0.70 → Execution CANNOT exceed 50. Any Z4+ time → Execution CANNOT exceed 60. Duration > 90min → cannot exceed 75 (too long for recovery).

### Training Value (10%)
Recovery rides have minimal training stimulus — that's the point.
- **90-100**: Recovery ride when genuinely fatigued (TSB < -5) — the body needs this
- **70-89**: Recovery ride at moderate fatigue (TSB -5 to 0) — reasonable choice
- **50-69**: Recovery ride when somewhat fresh (TSB 0 to 10) — okay but could have trained
- **30-49**: Recovery ride when very fresh (TSB > 10) — wasted training opportunity
HARD CAP: TSB > 10 → Training Value CANNOT exceed 40 (should have trained harder).

### Recovery (30%)
Is the recovery ride serving its purpose in the training cycle?
- **90-100**: Perfect recovery timing — after a hard block, body clearly needs easy spinning
- **70-89**: Good timing — reasonable placement after hard work
- **50-69**: Neutral timing — not harmful but not especially needed
- **30-49**: Questionable — no clear recovery need, could have been more productive

**Calibration examples:**
- Score 93: 40min spin, IF=0.50, avg HR 115, zero spikes, TSB=-12 after hard race week → perfect recovery execution
- Score 35: 75min ride, IF=0.72, avg HR 145, several Z4 surges, TSB=+8 → too hard to be recovery, too easy to be training, wasted session
`

const UNKNOWN_RUBRIC = `
## Scoring Rubric — GENERAL (weights: Execution 40%, Training Value 30%, Recovery 30%)

Session type could not be determined. Score based on general quality indicators.

### Execution (40%)
- **90-100**: Steady, well-paced effort appropriate to the apparent intent
- **70-89**: Good execution with minor inconsistencies
- **50-69**: Average — noticeable pacing issues or power variability
- **30-49**: Below average — poor power control or inappropriate intensity
- **0-29**: Poor — abandoned effort or wildly inappropriate execution

### Training Value (30%)
- **90-100**: Clear physiological benefit — right intensity and duration
- **70-89**: Solid training effect
- **50-69**: Some benefit but suboptimal
- **30-49**: Limited value
- **0-29**: Minimal or counterproductive

### Recovery (30%)
- **90-100**: Perfect training-recovery balance
- **70-89**: Good balance
- **50-69**: Acceptable
- **30-49**: Concerning fatigue indicators
- **0-29**: Clear overtraining risk

**Calibration examples:**
- Score 85: Well-structured ride with clear purpose, good intensity management, appropriate freshness
- Score 45: Aimless ride with no clear objective, variable intensity, added fatigue without clear benefit
`

function getRubricForType(sessionType: SessionType): string {
  switch (sessionType) {
    case 'race': return RACE_RUBRIC
    case 'endurance': return ENDURANCE_RUBRIC
    case 'workout': return WORKOUT_RUBRIC
    case 'recovery': return RECOVERY_RUBRIC
    default: return UNKNOWN_RUBRIC
  }
}

export const REPORT_SYSTEM_PROMPT = `You are an expert cycling coach analyzing a training session. Generate a coaching report with a session score, headline, quick take, and deep analysis.

You score sessions based on their TYPE and OBJECTIVE — a recovery ride is scored on whether it was truly easy, an endurance ride on zone discipline, a race on pacing and tactics. The scoring rubric will be provided with the session data.

## CRITICAL: Score Distribution
Use the FULL 0-100 range. Most sessions should NOT score 70-85.
- A perfectly executed session of its type: 88-95
- A well-executed session with minor issues: 75-87
- An average session with clear shortcomings: 55-74
- A poorly executed session: 35-54
- A failed or counterproductive session: 0-34

DO NOT cluster scores. A sloppy recovery ride that went too hard should score 35-50, not 70. A flawlessly paced race should score 90+, not 82.

## Guidelines
- Be direct and specific — reference actual numbers from the session data
- The headline should be punchy and memorable (e.g., "Textbook Zone 2" or "Recovery? More Like Tempo")
- The quick take should be 2-3 sentences summarizing the key takeaway
- Deep analysis should provide actionable coaching insights
- Tags should capture session characteristics (e.g., "endurance", "intervals", "race", "recovery", "threshold", "overreached", "negative-split", "well-paced", "too-hard", "zone-discipline")
- If goal data is provided, note relevance to active goals
- Use the athlete's fitness context (CTL/ATL/TSB) to assess recovery dimension
- RESPECT the HARD CAPS and HARD FLOORS in the rubric — these are non-negotiable
- All field names must use snake_case
`

export function buildReportPrompt(sessionData: Record<string, unknown>, sessionType: SessionType): string {
  const rubric = getRubricForType(sessionType)

  return `Analyze this cycling session and generate a coaching report.

## Session Type: ${sessionType.toUpperCase()}

${rubric}

## Session Data
${JSON.stringify(sessionData, null, 2)}

Generate the report with:
1. **score**: Overall 0-100 score using the type-specific weighted rubric above. Apply HARD CAPS and FLOORS.
2. **headline**: A punchy 3-6 word coaching headline that reflects the session type
3. **quick_take**: 2-3 sentence summary — what went well, what didn't, relative to the session's objective
4. **deep_analysis**: Detailed breakdown with sub-scores per dimension and specific metric references
5. **tags**: Array of relevant tags describing the session
6. **goal_relevance**: If goals are provided, note how this session relates to them`
}
