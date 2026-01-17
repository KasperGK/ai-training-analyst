# Project Knowledge Base

Living documentation of decisions, domain knowledge, and system understanding. This captures institutional knowledge that's important when working on the system.

**How to use this document:**
- Read relevant sections before working on a feature
- Add new knowledge as you learn it
- Update existing entries when things change
- Link to this from code comments when relevant

---

## Table of Contents
1. [Domain Knowledge](#domain-knowledge)
2. [Design Decisions](#design-decisions)
3. [Data Architecture](#data-architecture)
4. [API Contracts](#api-contracts)
5. [Gotchas & Pitfalls](#gotchas--pitfalls)
6. [Business Rules](#business-rules)

---

## Domain Knowledge

### Training Metrics (Critical to understand)

| Metric | What it is | Range | Notes |
|--------|-----------|-------|-------|
| **CTL** | Chronic Training Load ("fitness") | 0-150+ | Rolling 42-day weighted avg of TSS. Higher = more fit |
| **ATL** | Acute Training Load ("fatigue") | 0-200+ | Rolling 7-day weighted avg of TSS. Higher = more tired |
| **TSB** | Training Stress Balance ("form") | -50 to +30 | CTL - ATL. Negative = fatigued, Positive = fresh |
| **TSS** | Training Stress Score | 0-500+ | Single workout load. 100 = 1hr at FTP |
| **FTP** | Functional Threshold Power | 100-400W | Max sustainable power for ~1hr |
| **IF** | Intensity Factor | 0.5-1.3 | NP/FTP. 1.0 = threshold effort |
| **NP** | Normalized Power | watts | Adjusted avg power accounting for variability |

### TSB Interpretation (Business Logic)
```
TSB < -30  → Very fatigued, injury risk
TSB -30 to -10 → Building fitness, accumulated fatigue
TSB -10 to +5 → Optimal for racing/peak performance
TSB +5 to +15 → Fresh but losing fitness
TSB > +15 → Detrained, significant fitness loss
```

### Workout Types by Intensity Factor
```
IF < 0.65  → Recovery
IF 0.65-0.75 → Endurance (Zone 2)
IF 0.76-0.87 → Tempo (Zone 3)
IF 0.88-0.94 → Sweet Spot
IF 0.95-1.05 → Threshold (Zone 4)
IF 1.06-1.20 → VO2max (Zone 5)
IF > 1.20 → Anaerobic/Sprint
```

### intervals.icu Data Quirks
- **IF storage**: Can be decimal (0.65) or percentage (65). Always normalize: `if > 2 ? if/100 : if`
- **Date field**: Wellness uses `id` for date, not `date` field
- **STRAVA filter**: We exclude STRAVA-sourced activities (API terms restriction)
- **Wellness always 90 days**: Sync always fetches 90 days for accurate CTL/ATL calculation

---

## Design Decisions

### DD-001: Separate Training Load from Recovery Data
**Date:** 2025-01-17 | **Importance:** High

**What:** PMC data (CTL/ATL/TSB) and Recovery data (sleep/HRV) are separate pipelines.

**Why:** They're conceptually different:
- PMC = training load over time (for charts, trend analysis)
- Recovery = current physiological state (for widgets, daily decisions)

**Implementation:**
- `buildPMCData()` returns only `{ date, ctl, atl, tsb }`
- `getCurrentRecovery()` returns `{ sleepSeconds, sleepScore, hrv, ... }`
- API response has separate `currentFitness` and `recovery` objects
- Components consume only what they need

**Files:** `src/lib/transforms/recovery.ts`, `src/lib/transforms/intervals.ts`

---

### DD-002: Local-First Data Architecture
**Date:** 2025-01-17 | **Importance:** High

**What:** Local Supabase database is source of truth; intervals.icu is fallback.

**Why:**
- Faster page loads (no network latency)
- Works when intervals.icu is down
- Reduces API rate limiting concerns
- Enables future offline support

**Pattern:**
```typescript
const localData = await getFromLocalDB()
if (localData && isRecent(localData, 2)) { // 2 days
  return { source: 'local', ...localData }
}
return { source: 'intervals_icu', ...fetchLive() }
```

**User must sync** to populate local data (Settings → Integrations → Sync Now).

---

### DD-003: Feature Flags Default to Enabled
**Date:** 2025-01-13 | **Importance:** Medium

**What:** All features are ON by default. Set `FEATURE_X=false` to disable.

**Why:** Previous approach (opt-in) meant features were often accidentally disabled.

**Current flags:**
```bash
FEATURE_LOCAL_DATA=false  # Disable local Supabase queries
FEATURE_RAG=false         # Disable RAG search
FEATURE_MEMORY=false      # Disable athlete memory
FEATURE_INSIGHTS=false    # Disable proactive insights
```

---

### DD-004: Snake Case Everywhere
**Date:** 2025-01-10 | **Importance:** Medium

**What:** All data fields use snake_case throughout the application.

**Why:** intervals.icu uses mixed conventions. We normalize on import to avoid confusion.

**Examples:**
- `max_hr` (not `maxHr` or `max_heartrate`)
- `sleep_seconds` (not `sleepSecs`)
- `normalized_power` (not `normalizedPower`)

**Transform layer:** `src/lib/transforms/` handles conversion from intervals.icu formats.

---

## Data Architecture

### Data Flow Overview
```
intervals.icu API
       ↓
   [Sync Process]  ←── Manual trigger from Settings
       ↓
  Supabase (local DB)
       ↓
   [API Routes]  ←── Local-first, fallback to live
       ↓
  React Hooks (useIntervalsData)
       ↓
   Components
```

### Key Database Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `athletes` | User profile & metrics | id, ftp, max_hr, weight_kg |
| `sessions` | Training activities | date, duration, power metrics, zones |
| `fitness_history` | Daily CTL/ATL/TSB + sleep | date, ctl, atl, tsb, sleep_seconds |
| `training_plans` | Multi-week plans | goal, start_date, status |
| `plan_days` | Individual workout days | date, workout_id, completed |
| `insights` | AI-generated insights | title, insight_type, priority |
| `athlete_memories` | Personalization data | key, value, confidence |
| `session_embeddings` | RAG for session search | session_id, embedding |
| `wiki_chunks` | RAG for knowledge search | article_slug, embedding |

### Sync Process
1. **Trigger:** Manual from Settings page (`POST /api/sync`)
2. **Activities:** Fetches new activities since last sync
3. **Wellness:** Always fetches last 90 days (CTL/ATL accuracy)
4. **Embeddings:** Generates embeddings for new sessions (if RAG enabled)
5. **Insights:** Auto-generates insights after sync (if new data)

---

## API Contracts

### GET /api/intervals/data
Main dashboard data endpoint.

**Response structure:**
```typescript
{
  connected: boolean,
  source: 'local' | 'intervals_icu',
  athlete: { id, name, ftp, max_hr, lthr, weight_kg, resting_hr },
  currentFitness: { ctl, atl, tsb, ctl_trend, ctl_change },  // Training load only
  recovery: { sleepSeconds, sleepScore, hrv, restingHR, ... }, // Separate!
  sessions: Session[],
  pmcData: { date, ctl, atl, tsb }[],
  ctlTrend: number
}
```

### GET /api/fitness
Fitness data with local-first logic. Similar to above but focused on fitness metrics.

### POST /api/sync
Triggers data sync from intervals.icu.

**Body:** `{ force?: boolean, since?: string, until?: string }`
**Response:** `{ activitiesSynced, wellnessSynced, errors, duration_ms }`

---

## Gotchas & Pitfalls

### Critical
- **RLS Context:** When passing Supabase client through functions, you MUST pass the authenticated client to preserve RLS context. Creating new client loses auth.
- **IF Normalization:** Always check if IF > 2 before using. Database stores as percentage (65), code expects decimal (0.65).
- **Sync Required:** Dashboard shows nothing until user syncs. New users need onboarding to sync.

### Important
- **STRAVA Exclusion:** Activities with `source: 'STRAVA'` are filtered out during sync (API terms).
- **Wellness Date Field:** intervals.icu wellness uses `id` field for date, not `date`.
- **Navbar Z-Index:** Fixed navbar at top needs `pt-20` on content to avoid overlap.
- **Build vs Dev Errors:** TypeScript errors may only show in `npm run build`, not dev server.

### Nice to Know
- **PMC Sampling:** For >42 days, PMC data is sampled (every 3rd day for 90d, etc.)
- **Insights Cooldown:** Auto-generation has 6-hour cooldown between runs.
- **Session Embeddings:** Only last 90 days of sessions are embedded for RAG.

---

## Business Rules

### Workout Prescription
1. Check TSB before recommending intensity:
   - TSB < -20: Recovery only
   - TSB -20 to -5: Endurance/tempo max
   - TSB > -5: Any intensity OK
2. Pattern matching: Use athlete's historical success patterns
3. Day-of-week preferences: Some athletes train better on specific days

### Plan Generation
1. Respect weekly hours constraint
2. Build weeks should not exceed ACWR 1.3 (injury risk)
3. Always include rest day(s)
4. Taper: Reduce volume 40-60%, maintain some intensity

### Insights
- Priority 1-3: 1 = critical (show prominently), 3 = informational
- Auto-dismiss after 7 days if not acted on
- Max 5 active insights shown at once

---

## Adding New Knowledge

When you learn something important, add it here:

1. **Domain concept?** → Add to Domain Knowledge
2. **Design choice?** → Add to Design Decisions (use DD-XXX format)
3. **Data structure?** → Add to Data Architecture
4. **API behavior?** → Add to API Contracts
5. **Something that tripped you up?** → Add to Gotchas
6. **Feature behavior rule?** → Add to Business Rules
