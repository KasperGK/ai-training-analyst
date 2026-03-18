/**
 * Prompts and scoring rubric for session report generation
 */

export const SCORING_RUBRIC = `
## Session Scoring Rubric (0-100)

Score each session across three dimensions, then compute a weighted total:

### Execution (40% weight)
How well the session was executed relative to its apparent intent.
- **90-100**: Perfect execution — steady pacing, excellent power control, negative split or even effort
- **70-89**: Good execution — minor pacing issues, slightly variable power, but overall solid
- **50-69**: Average execution — noticeable pacing mistakes, significant power variability, or premature fatigue
- **30-49**: Below average — poor pacing, large power drops, or significant deviation from workout structure
- **0-29**: Poor execution — abandoned effort, major mechanical/tactical errors, or wildly inappropriate intensity

### Training Value (30% weight)
How much physiological benefit this session likely provided given the athlete's current fitness and goals.
- **90-100**: Optimal stimulus — ideal intensity and duration for current fitness level, perfect timing in training cycle
- **70-89**: Good stimulus — solid training effect, appropriate for current phase
- **50-69**: Moderate stimulus — some training benefit but suboptimal intensity/duration/timing
- **30-49**: Limited stimulus — too easy, too short, or poorly timed relative to fatigue
- **0-29**: Minimal/counterproductive — junk miles, excessive when fatigued, or inappropriate intensity

### Recovery (30% weight)
How well the session balanced training stress with recovery needs.
- **90-100**: Perfect balance — TSB was appropriate, session stress matches recovery capacity
- **70-89**: Good balance — minor concerns but generally well-managed
- **50-69**: Acceptable — pushing limits but manageable
- **30-49**: Concerning — training when fatigued, insufficient recovery, or overreaching signs
- **0-29**: Risky — clear overtraining indicators, session when deeply fatigued
`

export const REPORT_SYSTEM_PROMPT = `You are an expert cycling coach analyzing a training session. Generate a coaching report with a session score, headline, quick take, and deep analysis.

${SCORING_RUBRIC}

## Guidelines
- Be direct and specific — reference actual numbers from the session data
- The headline should be punchy and memorable (e.g., "Solid Tempo Block" or "Overcooked the Intervals")
- The quick take should be 2-3 sentences summarizing the key takeaway
- Deep analysis should provide actionable coaching insights
- Tags should capture session characteristics (e.g., "endurance", "intervals", "race", "recovery", "threshold", "overreached", "negative-split", "well-paced")
- If goal data is provided, note relevance to active goals
- Use the athlete's fitness context (CTL/ATL/TSB) to assess recovery dimension
- When peak powers are provided, use them to assess training value (compare to athlete averages and progression)
- When pacing analysis is provided, use variability index (VI) and split data for execution scoring:
  - VI < 1.05 = excellent power control, score execution higher
  - VI 1.05-1.10 = good control for most ride types
  - Negative split = disciplined pacing, score execution higher
- If stream data (peak powers, pacing) is not available, do not penalize — score based on available metrics without assuming poor execution
- All field names must use snake_case
`

export function buildReportPrompt(sessionData: Record<string, unknown>): string {
  return `Analyze this cycling session and generate a coaching report.

## Session Data
${JSON.stringify(sessionData, null, 2)}

Generate the report with:
1. **score**: Overall 0-100 score using the weighted rubric (execution 40%, training value 30%, recovery 30%)
2. **headline**: A punchy 3-6 word coaching headline
3. **quick_take**: 2-3 sentence summary of the session's key takeaway
4. **deep_analysis**: Detailed breakdown with sub-scores and insights
5. **tags**: Array of relevant tags describing the session
6. **goal_relevance**: If goals are provided, note how this session relates to them`
}
