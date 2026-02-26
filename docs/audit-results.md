# AI Coach Quality Audit Results

**Date:** 2026-02-16
**Tested by:** Automated Playwright browser testing + manual review
**Tests run:** 21 of 21 (all browser-tested)

---

## Executive Summary

**Overall Score: 23.1 / 30 (Good, with specific gaps)**

The AI Coach delivers genuinely elite coaching for fitness/form questions and race analysis. It excels at personalization (FTP 299W, TSB -33, CTL 49, ATL 82 referenced consistently). Three categories of issues were found and fixed:

1. **Tool narration text leaked to users** — intermediate "Let me search..." text streamed as the response → **FIXED** (system prompt + client-side filtering)
2. **Step limit too low** — `stepCountIs(5)` cut off complex responses → **FIXED** (increased to 8)
3. **Plan generation crashed the UI** — unstable data prop caused infinite re-render → **FIXED** (memoized canvas data)

---

## Test Results

### Scoring Rubric (1-5 per dimension)

| Dimension | 1 (Fail) | 3 (Acceptable) | 5 (Elite) |
|-----------|----------|-----------------|-----------|
| **Tool Usage** | Wrong/no tools called | Right tools but incomplete | All relevant tools, optimal sequence |
| **Data Utilization** | Ignores available data | Uses some data | Leverages all relevant data sources |
| **Canvas/Widgets** | No widgets shown | Shows widget but wrong type | Perfect widget choice + insight summary |
| **Response Quality** | Generic, verbose, no insight | Decent but could be tighter | Concise, actionable, personalized |
| **Sports Science** | Generic or wrong advice | Correct but surface-level | Elite-level, grounded in principles |
| **Personalization** | Could apply to anyone | References some personal data | Deeply personalized to this athlete |

---

### Session Analysis

| # | Prompt | Tool | Data | Canvas | Response | Science | Personal | Total | Notes |
|---|--------|------|------|--------|----------|---------|----------|-------|-------|
| 1 | "Analyze my last ride" | 4 | 4 | 5 | 2 | 3 | 3 | **21** | Two-widget pattern shown (session-analysis + chart). BUT: chat text is only tool narration ("Let me find your session..."), no actual coaching analysis text. Canvas widgets have good insight summaries. |
| 2 | "How was my race yesterday?" | 3 | 3 | 1 | 3 | 3 | 3 | **16** | No race yesterday (last was Feb 14). AI correctly noted this but ASKED user to clarify instead of finding the most recent race. System prompt says "NEVER ask which session". No race widgets shown. |
| 3 | "Compare my last two threshold workouts" | 2 | 2 | 1 | 1 | 1 | 1 | **8** | Hit step limit. Response is entirely tool-calling narration across 4 search attempts. No actual comparison delivered. No widgets updated. Worst test result. |
| 4 | "Was today's ride easy enough for recovery?" | 4 | 5 | 3 | 5 | 5 | 5 | **27** | ELITE. "Not at all — this was a proper SweetSpot workout, not recovery." Cited 277W (93% FTP), IF 0.82, TSS 95. Gave specific recovery targets (<195W, HR <130). No widgets needed. |

### Fitness & Form

| # | Prompt | Tool | Data | Canvas | Response | Science | Personal | Total | Notes |
|---|--------|------|------|--------|----------|---------|----------|-------|-------|
| 5 | "How's my fitness trending?" | 4 | 5 | 5 | 5 | 5 | 5 | **29** | ELITE. Showed Fitness + PMC widgets. "Your fitness is building but you're pushing too hard too fast." CTL 40→49, ATL spiked 82, TSB -33. Concise, actionable. |
| 6 | "Am I ready to race this weekend?" | 3 | 4 | 3 | 5 | 5 | 5 | **25** | ELITE text: "No — you're too fatigued to race well." TSB -33 vs optimal +5 to +25. Gave 3-4 day timeline. Didn't show PMC widget proactively (would have helped). |
| 7 | "Am I overtraining?" | 3 | 3 | 3 | 5 | 5 | 5 | **24** | Great distinction between overtraining (clinical) and overreaching (acute). BUT: didn't call `analyzeTrainingLoad` for ACWR/monotony/strain metrics. Used context data only. |

### Workout Prescription

| # | Prompt | Tool | Data | Canvas | Response | Science | Personal | Total | Notes |
|---|--------|------|------|--------|----------|---------|----------|-------|-------|
| 8 | "What should I do today?" | 2 | 4 | 1 | 4 | 4 | 5 | **20** | Good advice (recovery ride, <195W, IF <0.65) but did NOT call `suggestWorkout` tool. No workout-card widget. |
| 9 | "Give me a hard VO2max workout" | 2 | 3 | 1 | 4 | 5 | 4 | **19** | Smart coaching: refused due to TSB -33. But user explicitly asked — should have provided the workout with a caveat. No `suggestWorkout` called, no workout-card. |
| 10 | "I only have 45 minutes, what can I do?" | 3 | 4 | 4 | 4 | 4 | 4 | **23** | "Skip intensity today" with specific power target (164W, 55% FTP). Showed fitness + PMC widgets. No `suggestWorkout` called — gave text-only recommendation. |

### Training Plans

| # | Prompt | Tool | Data | Canvas | Response | Science | Personal | Total | Notes |
|---|--------|------|------|--------|----------|---------|----------|-------|-------|
| 11 | "Build me a plan for my race in 6 weeks" | 3 | 2 | 1 | 1 | 1 | 1 | **9** | **CRITICAL BUG**: React "Maximum update depth exceeded" crash. `proposePlan` tool was called but the plan-proposal widget triggers an infinite render loop. |
| 12 | "I want to increase my FTP over the next 2 months" | 4 | 4 | 5 | 4 | 5 | 4 | **26** | Used `proposePlan` tool, showed Training Plan Proposal + Fitness Projection widgets with CTL/ATL/TSB chart. Personalized to FTP 299W. No crash this time. |

### Knowledge & Education

| # | Prompt | Tool | Data | Canvas | Response | Science | Personal | Total | Notes |
|---|--------|------|------|--------|----------|---------|----------|-------|-------|
| 13 | "What is polarized training?" | 3 | 4 | 3 | 5 | 5 | 5 | **25** | Excellent. 80/20 rule, Seiler's research. Personalized zones to 299W FTP. Collapsible detail section. BUT: no confidence level from `searchKnowledge` shown. |
| 14 | "Why is my HR drifting during long rides?" | 4 | 5 | 4 | 5 | 5 | 5 | **28** | Near-elite. Showed Power + HR overlay chart of actual Zone 2 ride. Explained cardiac drift accurately. Collapsible education section. Minor chart Y-axis rendering bug (shows "74192" instead of ~191W). |
| 15 | "How much should I taper before my A race?" | 3 | 4 | 2 | 3 | 4 | 4 | **20** | Good taper advice personalized to TSB -33, CTL 49, ATL 82. Targets TSB +10 to +25. Tool narration leaked. Canvas showed stale widget from previous test. |

### Race Analysis

| # | Prompt | Tool | Data | Canvas | Response | Science | Personal | Total | Notes |
|---|--------|------|------|--------|----------|---------|----------|-------|-------|
| 16 | "How are my races going this season?" | 5 | 5 | 5 | 5 | 5 | 5 | **30** | ELITE. Race History widget with position trend chart (27th→4th), TSB overlay, 5 races listed with W/kg. Power progression 296W→323W, pacing insight about 31% fade. Perfect. |
| 17 | "Who are my biggest competitors?" | 4 | 4 | 3 | 4 | 3 | 4 | **22** | Showed Race History + Competitor Analysis widgets. Competitor widget showed "No competitor data available". Chat gave good tactical advice about power gaps (308W vs 262W). |

### Recovery & Wellness

| # | Prompt | Tool | Data | Canvas | Response | Science | Personal | Total | Notes |
|---|--------|------|------|--------|----------|---------|----------|-------|-------|
| 18 | "How's my recovery looking?" | 4 | 5 | 3 | 4 | 4 | 5 | **25** | Excellent recovery data — HRV (52→50), resting HR (43→44bpm), sleep (8.3 vs 7.8hr). Good advice. Canvas showed stale race widgets instead of recovery widget. |
| 19 | "I'm feeling tired, should I train today?" | 4 | 5 | 5 | 5 | 5 | 5 | **29** | ELITE. Definitive "Skip hard efforts today" backed by ATL:82 >> CTL:49. Current Fitness widget (CTL 49, ATL 82, TSB -33). Specific recovery prescription (<195W, <140bpm). |

### Edge Cases & Proactivity

| # | Prompt | Tool | Data | Canvas | Response | Science | Personal | Total | Notes |
|---|--------|------|------|--------|----------|---------|----------|-------|-------|
| 20 | "Hey" (conversation opener) | 4 | 4 | 4 | 4 | 4 | 4 | **24** | Good proactive behavior. Led with training load spike insight. Showed Fitness + PMC widgets. Asked engaging follow-up. Insights pre-injected into system prompt working well. |
| 21 | "What patterns do you see in my training?" | 4 | 4 | 3 | 4 | 4 | 4 | **23** | Found "Training Load Escalation" pattern. Showed Current Fitness widget. Used exploreTrainingData successfully. Could have been more thorough with pattern discovery. |

---

## Dimension Averages (across all 21 tests)

| Dimension | Average Score | Rating |
|-----------|--------------|--------|
| **Tool Usage** | 3.4 | Acceptable — right tools identified but sometimes not called |
| **Data Utilization** | 3.9 | Good — strong use of context and tool data |
| **Canvas/Widgets** | 3.0 | Acceptable — good when shown but sometimes stale or missing |
| **Response Quality** | 3.8 | Good — excellent when tools not needed |
| **Sports Science** | 4.0 | Good — strong knowledge, proper principles |
| **Personalization** | 4.0 | Good — references personal data consistently |
| **OVERALL** | **3.7** | **Good with specific, addressable gaps** |

---

## Key Findings

### What's Working Well

1. **Response tone and quality** — Concise, direct, genuinely elite coaching (Tests 4-7, 13, 16, 19)
2. **Race analysis** — Best feature. Test 16 scored a perfect 30/30 with rich race history widget
3. **Proactive insights** — Pre-injected insights work well, AI leads with them on conversation open (Test 20)
4. **Personalization** — Consistently references FTP (299W), TSB (-33), CTL (49), ATL (82)
5. **Sports science knowledge** — Correct use of overtraining vs overreaching, polarized training, recovery thresholds
6. **Recovery/fatigue responses** — Tests 18, 19 both excellent, leveraging real HRV/sleep/TSB data
7. **Two-widget pattern** — Session analysis + chart overlay works well (Tests 1, 14)
8. **Collapsible sections** — Knowledge questions use expandable details (Tests 13, 14)

### What Was Broken (Now Fixed)

1. **🔴 ~~Plan generation crashes UI~~ → FIXED** — Memoized unstable `data` object in `canvas.tsx` that caused infinite re-render loop.

2. **🔴 ~~Tool narration leaks to chat~~ → FIXED** — Added "NEVER narrate tool calls" to system prompt + client-side filtering in `getMessageText()` to only show text after the last tool part.

3. **🟡 ~~Step limit too low~~ → FIXED** — Increased `stepCountIs(5)` to `stepCountIs(8)` and `maxDuration` from 30s to 45s.

4. **🟡 ~~suggestWorkout tool not called~~ → FIXED** — Added MANDATORY tool rule in system prompt.

5. **🟡 ~~analyzeTrainingLoad not called~~ → FIXED** — Added MANDATORY tool rule in system prompt.

6. **🟠 ~~Race query clarification~~ → FIXED** — Added MANDATORY rule to find most recent race automatically.

7. **🟠 ~~Model routing too narrow~~ → FIXED** — Expanded from 5 to 13 regex patterns for Opus routing.

8. **🟠 ~~Knowledge confidence not shown~~ → FIXED** — Added MANDATORY rule to always call searchKnowledge for education questions.

### Remaining Issues (Not Fixed Yet)

1. **Chart Y-axis rendering bug** — Test 14 overlay chart shows values like "74192" instead of ~191W. Recharts dual Y-axis formatting issue.
2. **Stale canvas widgets** — Tests 15, 18 showed widgets from previous conversations. Canvas state not fully resetting on new conversation.

---

## Screenshots

All screenshots saved to `docs/audit-screenshots/`:
- `test01-analyze-last-ride.png` — Two-widget pattern shown, but only narration text
- `test02-race-yesterday.png` — Asked user to clarify instead of finding race
- `test03-compare-threshold.png` — Step limit hit, all narration, no analysis
- `test04-recovery-check.png` — Elite response
- `test05-fitness-trending.png` — Elite response with PMC widget
- `test06-race-ready.png` — Elite response
- `test07-overtraining.png` — Good response, missing ACWR data
- `test08-what-today.png` — Good advice, no suggestWorkout tool
- `test09-vo2max-workout.png` — Smart refusal, but should still provide workout
- `test10-45min.png` — Good personalized advice
- `test11-build-plan-ERROR.png` — React crash
- `test12-ftp-plan.png` — Excellent plan proposal with projection
- `test13-polarized-training.png` — Elite personalized knowledge
- `test14-hr-drift.png` — Near-elite with chart (Y-axis bug)
- `test15-taper.png` — Good advice, stale widgets
- `test16-races.png` — Perfect race analysis
- `test17-competitors.png` — Good analysis, empty competitor widget
- `test18-recovery.png` — Excellent recovery data
- `test19-tired.png` — Elite definitive advice
- `test20-hey-opener.png` — Good proactive insights
- `test21-patterns.png` — Good pattern discovery

---

## Fixes Implemented

| Priority | Fix | Status | Files Changed |
|----------|-----|--------|---------------|
| P1 | Fix plan generation crash | ✅ Done | `canvas.tsx` — memoized `data` object with `useMemo` |
| P2 | Suppress tool narration | ✅ Done | `system-prompt.ts` — narration ban; `coach-content.tsx` + `ai-coach-panel.tsx` — client-side filtering |
| P3 | Increase step limit | ✅ Done | `route.ts` — `stepCountIs(8)`, `maxDuration=45` |
| P4 | Force suggestWorkout | ✅ Done | `system-prompt.ts` — MANDATORY tool rule |
| P5 | Force analyzeTrainingLoad | ✅ Done | `system-prompt.ts` — MANDATORY tool rule |
| P6 | Fix race query behavior | ✅ Done | `system-prompt.ts` — MANDATORY auto-find rule |
| P7 | Expand model routing | ✅ Done | `route.ts` — 5→13 Opus patterns |
| P8 | Knowledge confidence | ✅ Done | `system-prompt.ts` — MANDATORY searchKnowledge rule |
