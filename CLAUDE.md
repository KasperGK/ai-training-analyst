# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Session Start
1. Read `docs/LEARNINGS.md` for tech gotchas and patterns
2. Read `docs/ARCHITECTURE_DECISIONS.md` for key design decisions
3. Check current phase below and work on next unchecked item
4. Update this file when phases complete
5. Document significant architecture decisions in `docs/ARCHITECTURE_DECISIONS.md`

## Project Overview
AI-powered training analyst for cyclists. Provides personalized coaching insights based on training data from intervals.icu.

## Tech Stack
- Next.js 16 (App Router, Turbopack)
- AI SDK 6 (`ai@6.0.6`) - uses `inputSchema` not `parameters`
- Anthropic Claude (claude-opus-4-5-20251101)
- Supabase (PostgreSQL + Auth + pgvector)
- shadcn/ui, Tailwind CSS, Recharts

## Commands
```bash
npm run dev    # Start dev server (localhost:3000)
npm run build  # Build for production
```

## Current Focus: Masterplan 52 → 85+

### Phase 0: Knowledge Governance ✅ Complete
- [x] WikiArticle schema with confidence levels
- [x] Database migration (009_knowledge_governance.sql)
- [x] RAG returns governance metadata
- [x] Flag submission API + DB helpers
- [x] AI transparency rules in system prompt
- [x] ConfidenceBadge + SourceDetails components
- [x] Flag button on wiki article pages

### Phase 1: Knowledge Content ✅ Complete
- [x] Add 10 new wiki articles with governance fields
- [x] Expand workout templates (5 → 15)
- [x] Wire outcome tracking tool (logWorkoutOutcome)

### Phase 2: Analysis Tools ✅ Complete
- [x] Power curve analysis tool (analyzePowerCurve)
- [x] Efficiency trends tool (analyzeEfficiency)
- [x] Training load tool (analyzeTrainingLoad - ACWR, monotony, strain)

### Phase 3: Smart Workout Library ✅ Complete
- [x] 34 workout templates across 8 categories
- [x] Intelligent selection logic (prescribe.ts)

### Phase 4: Plan Generation ✅ Complete
- [x] generateTrainingPlan tool
- [x] 5 plan templates (4-week base, 8-week FTP, 3-week taper, 12-week event prep, 4-week maintenance)
- [x] Database migration (010_training_plans.sql)

### Phase 5: Outcome Learning ✅ Complete
- [x] Outcome pattern analyzer (`src/lib/learning/outcome-analyzer.ts`)
- [x] Pattern-aware workout prescription (prescribe.ts updated)
- [x] Pattern-aware plan generation (generator.ts updated)
- [x] analyzePatterns AI tool

### Phase 6: Plan Persistence ✅ Complete (Masterplan Part 2)
- [x] Plans now persist to `training_plans` and `plan_days` tables
- [x] `getTrainingPlan` tool - retrieve active plan with schedule
- [x] `updatePlanDay` tool - mark workouts complete, track progress

### Phase 7: Pattern → Prescription Wiring ✅ Complete
- [x] `suggestWorkout` now fetches and uses athlete patterns
- [x] Day-of-week pattern matching active
- [x] TSB optimal zone scoring active

### Phase 8: Insights Auto-Generation ✅ Complete
- [x] Insights auto-generate after data sync
- [x] Active insights injected into chat system prompt
- [x] No need to explicitly call getActiveInsights at conversation start

### Phase 9: Feature Flag Cleanup ✅ Complete
- [x] All features now default to enabled
- [x] Set `FEATURE_X=false` to disable (instead of `=true` to enable)

---

## Next: AI-Coach & Canvas Enhancement

**Detailed Plan**: `/Users/kramme/.claude/plans/soft-sniffing-hinton.md`
**HTML Export**: `/Users/kramme/Desktop/AI-Coach-Enhancement-Plan.html`

### Vision
Transform the AI-Coach into a clarity-focused coaching experience where:
- Canvas displays data that supports the coaching conversation
- AI proactively analyzes sessions with sports science-backed insights
- Users set metric goals (e.g., "HR under 150bpm at 300W") and event goals
- AI proposes training plans with clear rationale, user reviews and accepts/modifies
- Daily insights tie directly to goal progression

### Architecture: Tool-Driven Canvas
Replace text-based `[CANVAS:fitness]` commands with structured `showOnCanvas` tool:
- AI calls tool to control canvas (reliable, typed)
- Tool returns `canvasAction` that frontend processes
- Keep text parsing as fallback during transition
- Widgets include `context.insightSummary` for AI explanations

### Phase 10: Canvas-Backed Coaching ✅ Complete
- [x] Add `showOnCanvas` tool (`src/app/api/chat/tools/show-on-canvas.ts`)
- [x] Enhance `WidgetConfig` with context fields (insightSummary, sourceReference, expandable)
- [x] Create `useCanvasState` hook for state management
- [x] Process tool results for canvas in `coach-content.tsx`
- [x] Create `InsightCard` component with expand/collapse
- [x] Update system prompt with tool instructions
- [x] Keep text fallback `[CANVAS:X]` during transition

### Phase 11: Overlay Charts ✅ Complete
- [x] Add `chart` widget type with dual Y-axis support
- [x] Power + HR overlay visualization
- [x] Session data fetching for charts (`useSessionChart` hook)

### Phase 12: Goal Tracking System
- [ ] Enhanced goal schema (metric goals, event goals)
- [ ] Auto-detect goal progress from activities
- [ ] Goal-aware insight generation

### Phase 13: Training Plan Proposals
- [ ] Plan proposal canvas (calendar + rationale + projection views)
- [ ] Accept/modify flow with AI
- [ ] Calendar integration

---

## Architecture

### Data Flow
1. intervals.icu → Sync to Supabase (background, every 15 min)
2. User query → AI Coach → Tools query local Supabase first
3. Fallback to live intervals.icu if local data missing

### Key Files
- `src/app/api/chat/route.ts` - AI endpoint (uses Opus 4.5)
- `src/app/api/chat/tools/` - Modular AI tool definitions
- `src/lib/features.ts` - Centralized feature flags
- `src/lib/wiki/articles.ts` - Wiki articles with governance fields
- `src/lib/rag/vector-store.ts` - RAG search with metadata
- `src/lib/ai/system-prompt.ts` - AI personality + transparency rules
- `src/components/dashboard/ai-coach-panel.tsx` - Chat UI

### AI Tools (in src/app/api/chat/tools/)
- `getDetailedSession` - Fetch workout details
- `queryHistoricalTrends` - Analyze training patterns
- `getAthleteGoals` - Get goals, events, periodization
- `suggestWorkout` - Generate workout recommendations (39 templates, pattern-aware)
- `searchKnowledge` - RAG search with confidence metadata
- `getAthleteMemory` / `saveAthleteMemory` - Personalization
- `getActiveInsights` - Get proactive training insights
- `analyzePowerCurve` - Power profile and rider type analysis
- `analyzeEfficiency` - Aerobic efficiency (EF, decoupling)
- `analyzeTrainingLoad` - ACWR, monotony, strain analysis
- `generateTrainingPlan` - Multi-week structured plans (persisted to DB)
- `getTrainingPlan` - Retrieve active plan with schedule and progress
- `updatePlanDay` - Mark workouts complete, track compliance
- `logWorkoutOutcome` - Record workout outcomes for learning
- `analyzePatterns` - Discover and save training patterns from outcome history

### Feature Flags
All features are enabled by default. Set to `false` to disable:
```bash
FEATURE_LOCAL_DATA=false  # Disable local Supabase queries
FEATURE_RAG=false         # Disable RAG search
FEATURE_MEMORY=false      # Disable athlete memory
FEATURE_INSIGHTS=false    # Disable proactive insights
```

## Naming Conventions

All data fields use **snake_case** throughout the application:
- `max_hr` (not `maxHr` or `max_heartrate`)
- `sleep_seconds` (not `sleepSecs`)
- `normalized_power` (not `normalizedPower` or `np`)
- `resting_hr` (not `restingHR`)

intervals.icu uses mixed conventions (camelCase, snake_case). Use shared transforms in `src/lib/transforms/` to normalize on import:
- `getNormalizedPower(activity)` - handles `icu_weighted_avg_watts` / `weighted_average_watts` fallback
- `getAveragePower(activity)` - handles `icu_average_watts` / `average_watts` fallback
- `transformActivity()` - convert IntervalsActivity → Session
- `transformAthlete()` - extract metrics from sportSettings

## Data Access Layer

All database operations go through `src/lib/db/`:
- `athletes.ts` - Athlete CRUD
- `sessions.ts` - Session queries
- `fitness.ts` - CTL/ATL/TSB history
- `events.ts` - Event management
- `goals.ts` - Goal tracking
- `training-plans.ts` - Training plans and plan days (Phase 4)
- `power-bests.ts` - Power curve personal bests (Phase 4)
- `integrations.ts` - OAuth integrations

## Migrations
Latest: `010_training_plans.sql` (training_plans, plan_days, power_bests)

Run pending: `npx supabase migration up`
