# AI Training Analyst

An AI-powered training analyst for cyclists that provides personalized, context-aware coaching insights based on training data.

## Features

- **Dashboard** with fitness metrics (CTL, ATL, TSB)
- **PMC Chart** showing fitness trends over time
- **Sessions Table** with recent training activities
- **AI Coach** chat panel powered by Claude (streaming)
- **intervals.icu Integration** for automatic data sync
- **FIT File Upload** drag & drop with metrics calculation
- **Supabase Auth** optional login/signup (graceful fallback)

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **UI:** Shadcn/ui + Tailwind CSS
- **Charts:** Recharts
- **AI:** Claude API via AI SDK
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

# Supabase (optional - for authentication)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### 3. Run Development Server

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
│       ├── chat/route.ts           # AI chat endpoint
│       ├── auth/intervals/         # OAuth flow
│       │   ├── connect/route.ts
│       │   └── callback/route.ts
│       └── intervals/
│           └── data/route.ts       # Fetch intervals.icu data
├── components/
│   ├── dashboard/
│   │   ├── metric-card.tsx         # Fitness metric cards
│   │   ├── fitness-metrics.tsx     # CTL/ATL/TSB display
│   │   ├── pmc-chart.tsx           # Performance Management Chart
│   │   ├── sessions-table.tsx      # Recent sessions list
│   │   └── ai-coach-panel.tsx      # AI chat interface
│   └── ui/                         # Shadcn components
├── hooks/
│   └── use-intervals-data.ts       # intervals.icu data hook
├── lib/
│   ├── intervals-icu.ts            # API client
│   ├── ai/system-prompt.ts         # AI coaching prompt
│   └── supabase/                   # Supabase client (for future)
└── types/
    └── index.ts                    # TypeScript types
```

## intervals.icu Setup

1. Go to https://intervals.icu → Settings → Developer Settings
2. Copy your **API Key**
3. Note your **Athlete ID** (format: `i123456`)
4. Add both to `.env.local`

## Key Metrics

- **CTL (Chronic Training Load):** 42-day fitness indicator
- **ATL (Acute Training Load):** 7-day fatigue indicator
- **TSB (Training Stress Balance):** Form = CTL - ATL
- **TSS (Training Stress Score):** Per-session load
- **IF (Intensity Factor):** Session intensity relative to FTP
- **NP (Normalized Power):** Weighted average power

## Demo Mode

The app works without intervals.icu connection, showing sample data. Connect your account to see real training data.

## Future Enhancements

- [x] Supabase authentication
- [x] FIT file upload
- [ ] Multi-user support (database storage)
- [ ] Event countdown mode
- [ ] Proactive alerts
- [ ] Dark mode
- [ ] Mobile responsive
