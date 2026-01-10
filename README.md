# AI Training Analyst

An AI-powered training analyst for cyclists that provides personalized, context-aware coaching insights based on training data.

## Features

- **Dashboard** with fitness metrics (CTL, ATL, TSB)
- **PMC Chart** showing fitness trends over time
- **Sessions Table** with clickable workouts showing date/time
- **Workout Detail Page** with power/HR charts, zone breakdowns
- **AI Coach** chat panel powered by Claude with function calling
- **AI Tools** for workout suggestions, trend analysis, goal tracking
- **intervals.icu Integration** for automatic data sync (auto-refresh every 5 min)
- **FIT File Upload** drag & drop with metrics calculation
- **Supabase Auth** login/signup with profile persistence
- **Events & Goals** management UI
- **Multi-user Database** schema ready (Supabase)

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **UI:** Shadcn/ui + Tailwind CSS
- **Charts:** Recharts
- **AI:** Claude API via AI SDK 6 (with tool calling)
- **Database:** Supabase (PostgreSQL)
- **Data Source:** intervals.icu OAuth API

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env.local` with your credentials:

```bash
# Anthropic API (for AI chat)
ANTHROPIC_API_KEY=your_key_here

# intervals.icu - API Key method (recommended)
INTERVALS_ICU_API_KEY=your_api_key
INTERVALS_ICU_ATHLETE_ID=i123456

# Supabase (for multi-user + persistence)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Setup Database (Optional)

Run the SQL migrations in your Supabase dashboard:
1. Go to SQL Editor
2. Run `supabase/migrations/001_schema.sql`
3. Run `supabase/migrations/002_rls.sql`
4. Run `supabase/migrations/003_triggers.sql`

### 4. Run Development Server

```bash
npm run dev
```

Open http://localhost:3000

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Main dashboard
│   ├── layout.tsx                  # Root layout
│   ├── events/page.tsx             # Events & Goals management
│   ├── settings/page.tsx           # User settings
│   ├── workouts/[id]/page.tsx      # Workout detail page
│   └── api/
│       ├── chat/route.ts           # AI chat endpoint with tools
│       ├── athletes/route.ts       # User profile CRUD
│       ├── events/route.ts         # Events CRUD
│       ├── goals/route.ts          # Goals CRUD
│       ├── sessions/[id]/route.ts  # Workout details + streams
│       ├── auth/intervals/         # OAuth flow
│       └── intervals/data/         # Fetch intervals.icu data
├── components/
│   ├── dashboard/
│   │   ├── fitness-metrics.tsx     # CTL/ATL/TSB display
│   │   ├── pmc-chart.tsx           # Performance Management Chart
│   │   ├── sessions-table.tsx      # Recent sessions list (clickable)
│   │   └── ai-coach-panel.tsx      # AI chat with tool rendering
│   ├── workouts/
│   │   ├── stream-chart.tsx        # Power/HR line charts
│   │   └── zone-bar.tsx            # Zone distribution bars
│   └── ui/                         # Shadcn components
├── hooks/
│   └── use-intervals-data.ts       # intervals.icu data hook (auto-refresh)
├── lib/
│   ├── db/                         # Data access layer
│   ├── ai/system-prompt.ts         # AI coaching prompt
│   ├── intervals-icu.ts            # intervals.icu API client
│   └── supabase/                   # Supabase clients
└── types/
    └── index.ts                    # TypeScript types
```

## AI Tools

The AI coach can use these tools to provide better analysis (queries intervals.icu directly):

- **getDetailedSession** - Fetch full workout data with zone analysis, decoupling
- **queryHistoricalTrends** - Analyze training patterns over time (week/month/3mo/6mo/year)
- **getAthleteGoals** - Get goals, events, periodization phase, and current fitness
- **suggestWorkout** - Generate structured workout recommendations based on current form

## Database Schema

7 tables with Row Level Security:
- `athletes` - User profiles (linked to Supabase auth)
- `sessions` - Training activities
- `fitness_history` - Daily CTL/ATL/TSB snapshots
- `events` - Races and target events
- `goals` - Training goals
- `chat_messages` - Persisted conversations
- `integrations` - OAuth tokens

## Key Metrics

- **CTL (Chronic Training Load):** 42-day fitness indicator
- **ATL (Acute Training Load):** 7-day fatigue indicator
- **TSB (Training Stress Balance):** Form = CTL - ATL
- **TSS (Training Stress Score):** Per-session load
- **IF (Intensity Factor):** Session intensity relative to FTP
- **NP (Normalized Power):** Weighted average power

## Data Sources

**intervals.icu** - Primary data source for training activities. Supports:
- Direct connections: UPLOAD (Zwift direct), GARMIN_CONNECT
- Note: STRAVA activities are blocked by Strava's API terms

Connect Zwift directly to intervals.icu (not via Strava) for best results.

## Future Enhancements

- [x] Supabase authentication
- [x] FIT file upload
- [x] Multi-user database schema
- [x] AI function calling (tools)
- [x] Settings page (profile, integrations)
- [x] Events/goals management UI
- [x] Workout detail page with charts
- [x] Auto-refresh data (5 min interval + tab focus)
- [ ] Chat history persistence (UI)
- [x] Dark mode toggle
- [ ] Mobile responsive
