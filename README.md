# AI Training Analyst

An AI-powered training analyst for cyclists that provides personalized, context-aware coaching insights based on training data.

## Features

- **Dashboard** with fitness metrics (CTL, ATL, TSB)
- **PMC Chart** showing fitness trends over time
- **Sessions Table** with recent training activities
- **AI Coach** chat panel powered by Claude with function calling
- **AI Tools** for workout suggestions, trend analysis, goal tracking
- **intervals.icu Integration** for automatic data sync
- **FIT File Upload** drag & drop with metrics calculation
- **Supabase Auth** optional login/signup (graceful fallback)
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
│   └── api/
│       ├── chat/route.ts           # AI chat endpoint with tools
│       ├── auth/intervals/         # OAuth flow
│       └── intervals/data/         # Fetch intervals.icu data
├── components/
│   ├── dashboard/
│   │   ├── fitness-metrics.tsx     # CTL/ATL/TSB display
│   │   ├── pmc-chart.tsx           # Performance Management Chart
│   │   ├── sessions-table.tsx      # Recent sessions list
│   │   └── ai-coach-panel.tsx      # AI chat with tool rendering
│   └── ui/                         # Shadcn components
├── hooks/
│   └── use-intervals-data.ts       # intervals.icu data hook
├── lib/
│   ├── db/                         # Data access layer
│   │   ├── athletes.ts             # User profiles
│   │   ├── sessions.ts             # Training sessions
│   │   ├── fitness.ts              # CTL/ATL/TSB history
│   │   ├── events.ts               # Races/events
│   │   ├── goals.ts                # Training goals
│   │   ├── chat.ts                 # Chat history
│   │   └── integrations.ts         # OAuth tokens
│   ├── ai/system-prompt.ts         # AI coaching prompt
│   └── supabase/                   # Supabase clients
└── types/
    └── index.ts                    # TypeScript types
```

## AI Tools

The AI coach can use these tools to provide better analysis:

- **getDetailedSession** - Fetch full workout data with zone analysis
- **queryHistoricalTrends** - Analyze training patterns over time
- **getAthleteGoals** - Get goals, events, and periodization phase
- **suggestWorkout** - Generate structured workout recommendations

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

## Demo Mode

The app works without database connection, showing sample data. Connect Supabase and intervals.icu for full functionality.

## Future Enhancements

- [x] Supabase authentication
- [x] FIT file upload
- [x] Multi-user database schema
- [x] AI function calling (tools)
- [ ] Settings page (profile, integrations)
- [ ] Events/goals management UI
- [ ] Chat history persistence (UI)
- [ ] Dark mode toggle
- [ ] Mobile responsive
