# Project Learnings

Accumulated knowledge for AI Training Analyst development. Read this when starting a new session.

---

## Tech Stack Gotchas

### AI SDK 6
- Uses `inputSchema` not `parameters` for tool definitions
- Messages use `parts` array, not `content` string
- `convertToModelMessages()` is async - must await
- Tool states: `"done"` or `"output-available"`, not `"result"`

### Next.js 16 + Turbopack
- Dev server may show "middleware deprecated" warning - ignore (proxy.ts works)
- Build errors are more descriptive than dev errors - run `npm run build` to debug
- Turbopack caches aggressively - restart dev server after major changes

### Supabase
- Free tier projects auto-pause after 7 days of inactivity
- RLS policies use `auth.uid()` for row-level security
- pgvector requires `vector` extension enabled
- Migrations go in `supabase/migrations/` with sequential numbering (001_, 002_, etc.)

### shadcn/ui
- Add components with `npx shadcn@latest add <component>`
- Missing components will cause build errors (not dev errors)
- Components go in `src/components/ui/`

---

## Architecture Patterns

### API Routes
```typescript
// Standard pattern for authenticated endpoints
const supabase = await createClient()
if (!supabase) {
  return NextResponse.json({ error: 'Database not available' }, { status: 500 })
}

const { data: { user }, error: authError } = await supabase.auth.getUser()
if (authError || !user) {
  return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
}
```

### DB Helper Pattern
```typescript
// src/lib/db/<resource>.ts
// Transform DB rows to domain models
function rowToModel(row: DbRow): Model { ... }

// Export typed functions
export async function getResource(id: string): Promise<Model | null> { ... }
export async function createResource(data: CreateInput): Promise<Model | null> { ... }
```

### RAG Enrichment Pattern
```typescript
// Enrich search results with metadata from static definitions
const enrichedResults = dbResults.map(result => {
  const metadata = getMetadataBySlug(result.slug)
  return { ...result, ...metadata }
})
```

---

## Knowledge Governance System (Phase 0)

### Confidence Levels
- `established` - Scientific consensus (green badge)
- `strong_evidence` - Well-supported by research (blue badge)
- `emerging` - New research, not yet consensus (amber badge)
- `debated` - Active scientific disagreement (orange badge)

### Source Types
- `peer_reviewed` - Academic journals
- `textbook` - Published books
- `industry` - TrainingPeaks, TrainerRoad, etc.
- `meta_analysis` - Systematic reviews

### AI Transparency Rules
When citing knowledge, AI should:
- State `established` facts directly
- Prefix `strong_evidence` with "Research strongly supports..."
- Note `emerging` as "not yet consensus"
- Explain both sides for `debated` topics
- Mention `consensusNote` if present

### User Flagging
- Flag types: `inaccurate`, `outdated`, `misleading`, `needs_source`
- Users can only have one pending flag per article
- Flags stored in `knowledge_flags` table with RLS

---

## File Organization

### Key Directories
```
src/
├── app/api/          # API routes
├── components/
│   ├── ui/           # shadcn components + custom UI
│   ├── chat/         # Chat-specific components
│   └── dashboard/    # Dashboard widgets
├── lib/
│   ├── ai/           # System prompts, AI utilities
│   ├── db/           # Database helpers
│   ├── rag/          # RAG/vector search
│   └── wiki/         # Wiki articles and types
└── hooks/            # React hooks
```

### Naming Conventions
- Types: PascalCase (`WikiArticle`, `ConfidenceLevel`)
- DB helpers: `src/lib/db/<resource>.ts`
- API routes: `src/app/api/<resource>/route.ts`
- Components: PascalCase files (`ConfidenceBadge.tsx`)

---

## Migrations

### Current State
- 001-008: Core schema, RLS, sync, RAG, personalization, insights, sleep
- 009: Knowledge governance (flags, versions)

### Migration Pattern
```sql
-- Create table with proper constraints
CREATE TABLE public.tablename (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- foreign keys with CASCADE
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  -- CHECK constraints for enums
  status TEXT CHECK (status IN ('a', 'b', 'c')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes (including partial)
CREATE INDEX idx_name ON tablename(column) WHERE condition;

-- RLS
ALTER TABLE tablename ENABLE ROW LEVEL SECURITY;
CREATE POLICY "policy_name" ON tablename FOR SELECT USING (auth.uid() = user_id);
```

---

## Current Development Phase

### Masterplan: 52 → 88+ Score

**Original Masterplan (Phases 0-5):**
- [x] Phase 0: Knowledge Governance Foundation
- [x] Phase 1: Knowledge Content (16 wiki articles, expanded workout templates)
- [x] Phase 2: Analysis Tools (power curve, efficiency, training load)
- [x] Phase 3: Smart Workout Library (39 templates, intelligent prescription)
- [x] Phase 4: Plan Generation (5 plan templates, generateTrainingPlan tool)
- [x] Phase 5: Outcome Learning (pattern recognition, personalized recommendations)

**Masterplan Part 2 (Phases 6-9):**
- [x] Phase 6: Plan Persistence (plans saved to DB, getTrainingPlan + updatePlanDay tools)
- [x] Phase 7: Pattern → Prescription Wiring (suggestWorkout now uses patterns)
- [x] Phase 8: Insights Auto-Generation (on sync + injected at chat start)
- [x] Phase 9: Feature Flag Cleanup (all features default to enabled)

**AI-Coach Enhancement (Phase 10):**
- [x] Phase 10: Canvas-Backed Coaching (showOnCanvas tool, InsightCard, context fields)

**Score: ~90/100** (Phase 10 adds tool-driven canvas control)

---

## Analysis Tools (Phase 2)

### analyzePowerCurve
Analyzes power at key durations (5s, 1min, 5min, 20min) to identify:
- Rider profile (sprinter, pursuiter, climber, TT specialist, all-rounder)
- Strengths and limiters
- Period-over-period comparison

### analyzeEfficiency
Tracks aerobic development through:
- Efficiency Factor (NP/HR) trends
- Decoupling analysis for long rides
- Weekly progression

### analyzeTrainingLoad
Monitors training load balance:
- ACWR (Acute:Chronic Workload Ratio) - sweet spot is 0.8-1.3
- Monotony (training variety)
- Strain (weekly load × monotony)
- TSB status interpretation

---

## Smart Workout Library (Phase 3)

### Workout Categories (39 total)
- **Recovery (3)**: Easy spin, flush ride, pre-event openers
- **Endurance (5)**: Zone 2 foundation to 3-hour long rides
- **Tempo (4)**: 3x10 through continuous 45min
- **Sweet Spot (5)**: 3x10 through 2x30, including over-unders
- **Threshold (5)**: 3x8 through 40-minute TT
- **VO2max (5)**: 6x3 through pyramid workouts
- **Anaerobic (4)**: 30/30, 40/20, 1-min and 2-min repeats
- **Sprint (3)**: Neuromuscular, standing starts, race simulation

### Intelligent Prescription
Located in `src/lib/workouts/prescribe.ts`:
- Scores workouts based on CTL, ATL, TSB, training phase
- Checks prerequisites (min fitness, freshness, recovery time)
- **Pattern-aware (Phase 7)**: Uses learned athlete patterns for scoring
  - Day-of-week matching (+15/-20 points)
  - TSB optimal zone matching (+15/-15 points)
  - Workout type success history (+10/-10 points)
- Personalizes descriptions with actual power targets
- Returns best match with alternatives and warnings

### Key Files
- `src/lib/workouts/library.ts` - 34 structured workout templates
- `src/lib/workouts/prescribe.ts` - Intelligent selection logic

---

## Plan Generation (Phase 4)

### Plan Templates (5 total)
- **4-Week Base Build** - Aerobic foundation, Zone 2 focus, progressive volume
- **8-Week FTP Build** - Sweet spot + threshold progression, 2 build blocks
- **3-Week Taper** - Pre-event load reduction while maintaining intensity
- **12-Week Event Prep** - Complete periodization: base → build → peak → taper
- **4-Week Maintenance** - Balanced training to hold fitness

### generateTrainingPlan Tool
Generates personalized multi-week plans based on:
- Current fitness (CTL/ATL)
- Training goal
- Available weekly hours
- Key workout days
- Target event date (for taper timing)

### Database Tables
- `training_plans` - Main plan with goal, dates, status
- `plan_days` - Individual days with workout assignments
- `power_bests` - Personal records at key durations

### Key Files
- `src/lib/plans/templates.ts` - Plan template definitions
- `src/lib/plans/generator.ts` - Plan generation logic
- `supabase/migrations/010_training_plans.sql` - Database schema

---

## Common Issues & Solutions

### "fetch failed" in dev
- Usually means Supabase project is paused or unreachable
- Check: `curl https://YOUR_PROJECT.supabase.co`
- Solution: Unpause project in Supabase dashboard

### Build fails but dev works
- shadcn component missing - add with `npx shadcn@latest add <component>`
- Type errors only caught at build time

### RLS blocking queries
- Check `auth.uid()` matches expected column
- Use Supabase dashboard SQL editor to test queries directly

---

## Outcome Learning (Phase 5)

### Pattern Analyzer
Located in `src/lib/learning/outcome-analyzer.ts`:
- Analyzes workout outcomes to detect personalized patterns
- Detects: recovery rate, optimal TSB, day preferences, volume/intensity response
- Auto-saves patterns as athlete memories with confidence levels

### Pattern Types Detected
- **Recovery Pattern**: How fast athlete recovers from intensity (fast/average/slow)
- **TSB Pattern**: What form level produces best outcomes (optimal vs risk zones)
- **Day of Week**: Best/worst days for intensity workouts
- **Volume/Intensity**: Whether athlete responds better to volume or intensity focus
- **Workout Types**: Completion rates and RPE by workout category

### Integration Points
1. **Workout Prescription** (`prescribe.ts`)
   - Scores adjusted based on day-of-week patterns
   - TSB patterns inform workout intensity recommendations
   - Recovery patterns adjust intensity spacing
   - Workout type success rates influence suggestions

2. **Plan Generation** (`generator.ts`)
   - Key workout days suggested from patterns
   - Weekly hours adjusted to athlete's sweet spot
   - Volume/intensity emphasis matched to preference
   - Recovery warnings for slow recoverers

3. **AI Tool** (`analyzePatterns`)
   - Analyzes last 90 days of outcomes
   - Returns structured pattern data
   - Auto-saves discoveries as memories
   - Used automatically by plan generation

### Key Files
- `src/lib/learning/outcome-analyzer.ts` - Core pattern detection
- `src/lib/learning/index.ts` - Module exports
- `src/lib/workouts/prescribe.ts` - Pattern-aware prescription
- `src/lib/plans/generator.ts` - Pattern-aware plan generation

---

## Canvas-Backed Coaching (Phase 10)

### Overview
AI now controls the canvas via the `showOnCanvas` tool instead of text-based `[CANVAS:X]` commands.
This provides structured, type-safe canvas control with AI-generated insights.

### showOnCanvas Tool
Located in `src/app/api/chat/tools/show-on-canvas.ts`:
- **Actions**: `show` (replace), `add` (append), `compare` (side-by-side)
- **Widget types**: fitness, pmc-chart, sessions, sleep, power-curve, workout-card, chart
- **Insight field**: Required - AI must explain what the user should notice
- **Returns**: `canvasAction` payload processed by frontend

### Widget Context
Widgets now have optional `context` field:
- `insightSummary`: AI-generated explanation of what matters
- `sourceReference`: Wiki article slug for sports science citation
- `expandable`: Whether widget collapses to show insight-only view

### Key Components
- `InsightCard` (`src/components/coach/insight-card.tsx`) - Insight-first card wrapper
- `useCanvasState` (`src/hooks/use-canvas-state.ts`) - Canvas state management with reducer
- `Canvas` (`src/components/coach/canvas.tsx`) - Updated to use InsightCard when context present

### Processing Flow
1. AI calls `showOnCanvas` tool with widgets and insights
2. Tool returns `canvasAction` payload in result
3. `coach-content.tsx` extracts action from message parts
4. `useCanvasState` hook processes action and updates state
5. Canvas renders widgets with InsightCard wrapper if context present

### Fallback
Text commands `[CANVAS:fitness]` still work as fallback during transition

---

## Overlay Charts (Phase 11)

### Overview
Chart widget now supports dual Y-axis overlay visualizations for analyzing session data
with multiple metrics (power + HR, power + cadence, etc.).

### Chart Widget Configuration
When using `showOnCanvas` with `type: 'chart'`, include `chartConfig`:
```typescript
chartConfig: {
  chartType: 'overlay',          // 'line' | 'area' | 'overlay'
  sessionId: 'latest',           // Session ID or 'latest' for most recent
  metrics: ['power', 'heartRate'], // Metrics to display
  timeRange?: { start: 0, end: 3600 }  // Optional: specific time range in seconds
}
```

### Available Metrics
- `power` - Displays on left Y-axis (blue)
- `heartRate` - Displays on right Y-axis (red)
- `cadence` - Displays on right Y-axis (green)
- `speed` - Displays on right Y-axis (yellow)
- `altitude` - Displays on right Y-axis (purple)

### Use Cases
- **Aerobic decoupling analysis**: Power + HR overlay to detect cardiac drift
- **Efficiency analysis**: Power + cadence to analyze pedaling patterns
- **Pacing analysis**: Power + speed to analyze race execution

### Key Components
- `OverlayChart` (`src/components/charts/overlay-chart.tsx`) - Dual Y-axis Recharts component
- `ChartWidget` (`src/components/coach/chart-widget.tsx`) - Canvas widget wrapper
- `useSessionChart` (`src/hooks/use-session-chart.ts`) - Hook for fetching session stream data
- `ChartConfig` type (`src/lib/widgets/types.ts`) - Type definitions

### Data Flow
1. AI calls `showOnCanvas` with `type: 'chart'` and `chartConfig`
2. Canvas renders `ChartWidget` component
3. `useSessionChart` hook fetches `/api/sessions/[id]` for stream data
4. `OverlayChart` renders dual Y-axis visualization with requested metrics
