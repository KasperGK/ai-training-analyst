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

### Phase 1: Knowledge Content (Next)
- [ ] Add 10 new wiki articles with governance fields
- [ ] Expand workout templates (5 → 15)
- [ ] Wire outcome tracking tool

### Phase 2: Analysis Tools
- [ ] Power curve analysis tool
- [ ] Efficiency trends tool
- [ ] Training load tool (ACWR, monotony)

### Phase 3: Smart Workout Library
- [ ] 30+ workout templates
- [ ] Intelligent selection logic

### Phase 4: Plan Generation
- [ ] generateTrainingPlan tool
- [ ] Plan templates (base build, FTP build, taper)

### Phase 5: Outcome Learning
- [ ] Outcome pattern analyzer
- [ ] Pattern-aware recommendations

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
- `suggestWorkout` - Generate workout recommendations
- `searchKnowledge` - RAG search with confidence metadata
- `getAthleteMemory` / `saveAthleteMemory` - Personalization

### Feature Flags
```bash
FEATURE_LOCAL_DATA=true   # Query Supabase first
FEATURE_RAG=true          # Enable RAG search
FEATURE_MEMORY=true       # Enable athlete memory
FEATURE_INSIGHTS=true     # Enable proactive insights
```

## Migrations
Latest: `009_knowledge_governance.sql` (knowledge_flags, knowledge_versions)

Run pending: `npx supabase migration up`
