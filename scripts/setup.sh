#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}!${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

echo -e "${BOLD}AI Training Analyst — Setup${NC}"
echo ""

# 1. Check Node.js
if ! command -v node &>/dev/null; then
  error "Node.js is not installed. Install Node >= 18 and try again."
  exit 1
fi

NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  error "Node.js >= 18 required (found $(node -v))"
  exit 1
fi
info "Node.js $(node -v)"

# 2. Check npm
if ! command -v npm &>/dev/null; then
  error "npm is not installed."
  exit 1
fi
info "npm $(npm -v)"

# 3. Install dependencies
echo ""
echo -e "${BOLD}Installing dependencies...${NC}"
npm install
info "Dependencies installed"

# 4. Create .env.local from template
echo ""
if [ -f .env.local ]; then
  warn ".env.local already exists — skipping copy"
else
  cp .env.example .env.local
  info "Created .env.local from .env.example"
fi

# 5. Check required env vars
echo ""
REQUIRED_VARS=(
  ANTHROPIC_API_KEY
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  INTERVALS_ICU_API_KEY
  INTERVALS_ICU_ATHLETE_ID
)

MISSING=0
for var in "${REQUIRED_VARS[@]}"; do
  val=$(grep "^${var}=" .env.local 2>/dev/null | cut -d= -f2-)
  if [ -z "$val" ]; then
    warn "Missing: ${var}"
    MISSING=$((MISSING + 1))
  fi
done

if [ "$MISSING" -gt 0 ]; then
  echo ""
  echo -e "${YELLOW}Fill in the missing values in .env.local before starting the dev server.${NC}"
else
  info "All required env vars are set"
fi

# 6. Next steps
echo ""
echo -e "${BOLD}Next steps:${NC}"
echo "  1. Fill in .env.local with your API keys"
echo "  2. Run Supabase migrations (see supabase/migrations/)"
echo "  3. npm run dev"
echo ""
