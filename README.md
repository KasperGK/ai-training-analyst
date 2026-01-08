# AI Training Analyst

An AI-powered training analyst for cyclists that provides personalized, context-aware coaching insights based on training data.

## Features

- **Dashboard** with fitness metrics (CTL, ATL, TSB)
- **PMC Chart** showing fitness trends over time
- **Sessions Table** with recent training activities
- **AI Coach** chat panel powered by Claude
- **intervals.icu Integration** for automatic data sync

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

Copy `.env.local.example` to `.env.local` and add your credentials:

```bash
# Anthropic API (for AI chat)
ANTHROPIC_API_KEY=your_key_here

# intervals.icu OAuth (optional, for real data)
INTERVALS_ICU_CLIENT_ID=your_client_id
INTERVALS_ICU_CLIENT_SECRET=your_client_secret
INTERVALS_ICU_REDIRECT_URI=http://localhost:3001/api/auth/intervals/callback
```

### 3. Run Development Server

```bash
npm run dev
```

Open http://localhost:3001

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

1. Go to https://intervals.icu/settings
2. Create an OAuth application
3. Set redirect URI: `http://localhost:3001/api/auth/intervals/callback`
4. Copy Client ID and Secret to `.env.local`

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

- [ ] Supabase authentication
- [ ] Multi-user support
- [ ] FIT file upload
- [ ] Event countdown mode
- [ ] Proactive alerts
- [ ] Dark mode
