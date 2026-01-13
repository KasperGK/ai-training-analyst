# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Session Start
1. Read `docs/LEARNINGS.md` for tech gotchas and patterns
2. Read `~/.claude/plans/calm-sleeping-llama.md` for the 52→85+ masterplan
3. Check current phase below and work on next unchecked item
4. Update this file when phases complete

## Project Overview
AI-powered training analyst for cyclists. Provides personalized coaching insights based on training data from intervals.icu.

## Tech Stack
- Next.js 16 (App Router, Turbopack)
- AI SDK 6 (`ai@6.0.6`) - uses `inputSchema` not `parameters`
- Anthropic Claude (claude-sonnet-4-20250514)
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

## Architecture

### Data Flow
1. intervals.icu → Sync to Supabase (background, every 15 min)
2. User query → AI Coach → Tools query local Supabase first
3. Fallback to live intervals.icu if local data missing

### Key Files
- `src/app/api/chat/route.ts` - AI endpoint with tools
- `src/lib/wiki/articles.ts` - Wiki articles with governance fields
- `src/lib/rag/vector-store.ts` - RAG search with metadata
- `src/lib/ai/system-prompt.ts` - AI personality + transparency rules
- `src/components/dashboard/ai-coach-panel.tsx` - Chat UI

### AI Tools (in route.ts)
- `getDetailedSession` - Fetch workout details
- `queryHistoricalTrends` - Analyze training patterns
- `getAthleteGoals` - Get goals, events, periodization
- `suggestWorkout` - Generate workout recommendations (34 templates)
- `searchKnowledge` - RAG search with confidence metadata
- `getAthleteMemory` / `saveAthleteMemory` - Personalization
- `analyzePowerCurve` - Power profile and rider type analysis
- `analyzeEfficiency` - Aerobic efficiency (EF, decoupling)
- `analyzeTrainingLoad` - ACWR, monotony, strain analysis
- `generateTrainingPlan` - Multi-week structured plans (now pattern-aware)
- `logWorkoutOutcome` - Record workout outcomes for learning
- `analyzePatterns` - Discover and save training patterns from outcome history

### Feature Flags
```bash
FEATURE_LOCAL_DATA=true   # Query Supabase first
FEATURE_RAG=true          # Enable RAG search
FEATURE_MEMORY=true       # Enable athlete memory
FEATURE_INSIGHTS=true     # Enable proactive insights
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
