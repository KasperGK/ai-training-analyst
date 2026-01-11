# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Session Start
1. Read `~/.claude/plans/ancient-churning-snowglobe.md` for current architecture plan
2. Check "Current Phase" section for what to work on
3. Update plan when phases complete

## Project Overview
AI-powered training analyst for cyclists. Provides personalized coaching insights based on training data from intervals.icu.

## Tech Stack
- Next.js 16 (App Router, Turbopack)
- AI SDK 6 (`ai@6.0.6`) - uses `inputSchema` not `parameters`
- Anthropic Claude (claude-sonnet-4-20250514)
- Supabase (PostgreSQL + Auth)
- shadcn/ui, Tailwind CSS, Recharts

## Commands
```bash
npm run dev    # Start dev server (localhost:3000)
npm run build  # Build for production
```

## Architecture

### Data Flow
1. intervals.icu → Sync to Supabase (background, every 15 min)
2. User query → AI Coach → Tools query local Supabase first
3. Fallback to live intervals.icu if local data missing

### Key Files
- `src/app/api/chat/route.ts` - AI endpoint with 4 tools
- `src/app/api/sync/route.ts` - Sync trigger/status API
- `src/lib/sync/intervals-sync.ts` - Core sync logic
- `src/hooks/use-sync.ts` - Auto-sync hook
- `src/hooks/use-intervals-data.ts` - Live data hook
- `src/components/dashboard/ai-coach-panel.tsx` - Chat UI
- `src/app/settings/page.tsx` - Settings with sync UI

### AI Tools (in route.ts)
- `getDetailedSession` - Fetch workout details
- `queryHistoricalTrends` - Analyze training patterns
- `getAthleteGoals` - Get goals, events, periodization
- `suggestWorkout` - Generate workout recommendations

### Feature Flags
```bash
FEATURE_LOCAL_DATA=true   # Query Supabase first (Phase 1)
FEATURE_RAG=true          # Enable RAG search (Phase 3)
FEATURE_MEMORY=true       # Enable athlete memory (Phase 4)
FEATURE_INSIGHTS=true     # Enable proactive insights (Phase 5)
```

## Current Architecture Phase
See `~/.claude/plans/ancient-churning-snowglobe.md` for full plan.
- Phase 1: Data Sync ✅ Complete
- Phase 2: Chat Persistence ✅ Complete
- Phase 3: RAG/Knowledge System ✅ Complete
- Phase 4: Personalization Layer ✅ Complete
- Phase 5: Proactive Insights ✅ Complete

**All phases complete!** 🎉
