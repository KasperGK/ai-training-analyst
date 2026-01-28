# AI Coach Validation Checklist

This document defines the core use cases for the AI Coach and provides a validation checklist to ensure reliable operation.

## AI Coach Capabilities (19 Tools)

| Tool | Purpose | Critical? |
|------|---------|-----------|
| `findSessions` | Search sessions by date/type/intensity | Yes |
| `getDetailedSession` | Deep session analysis | Yes |
| `queryHistoricalTrends` | Training patterns over time | Yes |
| `getAthleteGoals` | Goals and upcoming events | Yes |
| `suggestWorkout` | Personalized workout recommendations | Yes |
| `getRecoveryTrends` | Sleep, HRV, resting HR analysis | Yes |
| `getActiveInsights` | Auto-generated alerts | Yes |
| `searchKnowledge` | RAG for training science | Medium |
| `getAthleteMemory` / `saveAthleteMemory` | Personalization | Medium |
| `generateChart` | Data visualization | Medium |
| `analyzePowerCurve` | Rider profile analysis | Yes |
| `analyzeEfficiency` | EF and decoupling trends | Yes |
| `analyzeTrainingLoad` | ACWR, monotony, strain | Yes |
| `generateTrainingPlan` | Multi-week structured plans | Yes |
| `analyzePatterns` | Discover what works for athlete | Medium |
| `getTrainingPlan` | Retrieve active plan | Yes |
| `updatePlanDay` | Track workout completion | Medium |
| `logWorkoutOutcome` | Record workout feedback | Medium |
| `showOnCanvas` | Display widgets in UI | Yes |

---

## Validation Checklist

### Tier 1: Daily Use Cases (Must Work Perfectly)

| # | User Request | Expected Behavior | Tools Used | Status |
|---|--------------|-------------------|------------|--------|
| 1 | "Show my fitness" | Displays fitness widget with CTL/ATL/TSB | `showOnCanvas` | [x] |
| 2 | "How's my form?" | Text summary + fitness widget | `showOnCanvas` | [x] |
| 3 | "Analyze my last session" | Finds recent session, shows chart, provides analysis | `findSessions`, `getDetailedSession`, `showOnCanvas` | [x] |
| 4 | "What should I do today?" | Workout suggestion based on fitness/goals | `suggestWorkout`, `getAthleteGoals` | [x] |
| 5 | "Am I overtraining?" | Training load analysis with ACWR | `analyzeTrainingLoad` | [x] |
| 6 | "Show my power curve" | Power curve widget with rider profile | `showOnCanvas`, `analyzePowerCurve` | [x] |

### Tier 2: Weekly Use Cases (Should Work Reliably)

| # | User Request | Expected Behavior | Tools Used | Status |
|---|--------------|-------------------|------------|--------|
| 7 | "Analyze Saturday's race" | Deep race analysis with pacing, peaks, zones | `findSessions`, `getDetailedSession`, `showOnCanvas` | [x] |
| 8 | "Compare this week to last week" | Volume, TSS, intensity comparison | `queryHistoricalTrends` | [x] |
| 9 | "How's my aerobic fitness progressing?" | EF and decoupling trends | `analyzeEfficiency` | [x] |
| 10 | "Create a training plan for [event]" | Multi-week structured plan | `generateTrainingPlan`, `getAthleteGoals` | [x] |
| 11 | "What's my training plan for this week?" | Current week schedule | `getTrainingPlan` | [x] |
| 12 | "Why am I feeling tired?" | Recovery + training load analysis | `getRecoveryTrends`, `analyzeTrainingLoad` | [x] |

### Tier 3: Periodic Use Cases (Should Work)

| # | User Request | Expected Behavior | Tools Used | Status |
|---|--------------|-------------------|------------|--------|
| 13 | "What type of rider am I?" | Power profile analysis | `analyzePowerCurve` | [x] |
| 14 | "What training works best for me?" | Pattern analysis | `analyzePatterns` | [x] |
| 15 | "Show my recent sessions" | Sessions list widget | `showOnCanvas` | [x] |
| 16 | "Explain [training concept]" | Knowledge search + explanation | `searchKnowledge` | [x] |

---

## Validation Criteria

For each test case, verify:

1. **Response time** - Under 30 seconds (60s for complex analysis)
2. **Tool calls** - Correct tools invoked
3. **Canvas display** - Appropriate widgets shown
4. **Insight quality** - Actionable, specific, grounded in data
5. **No errors** - No crashes or "overloaded" failures

---

## Validation Process

### Option A: Manual Testing (Current)

Run through checklist periodically:

1. Open AI Coach panel
2. Execute each request in order
3. Mark status: `[x]` pass, `[!]` partial, `[-]` fail
4. Document any failures with details
5. Fix issues before moving to next tier

### Option B: Automated Test Suite (Implemented)

Run the automated test suite with:

```bash
npm run test:run           # Run all tests
npm run test               # Watch mode
npm run test:ui            # Interactive UI
npm run test:coverage      # With coverage report
```

**Test Coverage (65 tests):**

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `tests/tools/calculations.test.ts` | 33 | Calculation verification |
| `tests/tools/analysis-tools.test.ts` | 20 | Tool integration tests |
| `tests/tools/explore-training-data.test.ts` | 12 | Exploratory data tool tests |

**Validated Calculations:**
- [x] ACWR = sum(last 7 days TSS)/7 ÷ sum(last 28 days TSS)/28
- [x] Monotony = mean(weekTSS) / stddev(weekTSS)
- [x] Strain = weeklyTSS × monotony
- [x] EF = NP / avgHR
- [x] Intensity distribution sums to 100%
- [x] CTL change = endCTL - startCTL
- [x] EF trend detection (>3% improving, <-3% declining)
- [x] ACWR risk zones (0.8-1.3 sweet spot, >1.5 danger)
- [x] Decoupling assessment (<3% excellent, <5% good)

**Tool Integration Tests:**
- [x] `analyzeTrainingLoad` - ACWR, monotony, strain, TSB status
- [x] `analyzeEfficiency` - EF calculation, trend detection, weekly progression
- [x] `queryHistoricalTrends` - Session stats, intensity distribution, fitness data
- [x] `exploreTrainingData` - Weekly summaries, day-of-week stats, race data
- [x] Data source selection (local first, intervals.icu fallback)
- [x] Edge cases (null values, large values, insufficient data)

### Option C: Interactive Validation UI (Future)

Add a `/validate` command in the coach:

- Runs through checklist automatically
- Reports pass/fail for each case
- Generates validation report

---

## Common Failure Modes

| Failure | Symptoms | Resolution |
|---------|----------|------------|
| Tool not called | AI responds with text only, no widget | Check system prompt tool instructions |
| Wrong tool | Different tool invoked than expected | Clarify tool descriptions |
| Timeout | Request hangs > 60s | Check API rate limits, optimize queries |
| Empty results | "No data found" when data exists | Check date ranges, data sync |
| Widget error | Canvas shows error state | Check widget props, data shape |

---

## Last Validated

| Date | Tier 1 | Tier 2 | Tier 3 | Automated | Notes |
|------|--------|--------|--------|-----------|-------|
| 2026-01-27 | 6/6 | 6/6 | 4/4 | 65/65 | Added automated test suite. All manual and automated tests pass. |
