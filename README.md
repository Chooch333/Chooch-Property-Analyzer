<!-- test commit from Claude Code -->
# Indy Property Analyzer

Indianapolis residential investment property analysis tool. **Zoning feasibility first** — determine how many units a lot can support under the Jan 2025 Consolidated Zoning Ordinance, then run full financial analysis on the deal.

## Stack

- **Frontend:** Next.js 14 (App Router) + Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Property Data:** US Census Geocoder (free, no API key)
- **Hosting:** Vercel

## Features

### Zoning Feasibility (Primary)
- Full Jan 2025 Indianapolis Zoning Ordinance data (D-A through D-11, MU districts)
- Tiered FAR calculator (1-3, 4-5, 6-11, 12-23, 24+ floors)
- LSR constraint analysis with binding constraint identification
- Permitted use matrix (duplex, triplex, fourplex, multi-family, ADU)
- Parking requirement estimation (TCR)
- Building type warnings (Small/Medium/Large Apartment thresholds)
- Collapsible district quick reference
- One-click "Apply to Financial" bridges zoning → financial analysis

### Financial Analysis
- Multi-unit property analysis (SFR through ground-up)
- Indiana county auto-fill (tax rates, insurance, market rents)
- Cash-out refinance / BRRRR analysis
- Year-by-year projections with rent growth, appreciation, expense inflation
- IRR, CoC, Cap Rate, DSCR, GRM calculations
- Save/load analyses to Supabase

## Setup

### 1. Clone and install

```bash
git clone https://github.com/Chooch333/indy-property-analyzer.git
cd indy-property-analyzer
npm install
```

### 2. Set up Supabase

1. Go to your Supabase project: https://wejflvxwqpiyfavhcepf.supabase.co
2. Open SQL Editor → New Query
3. Paste the contents of `supabase/schema.sql` and run it
4. Go to Settings → API and copy your anon key

### 3. Configure environment

```bash
cp .env.example .env.local
```

Fill in your Supabase anon key. The URL is already set.

### 4. Run locally

```bash
npm run dev
```

Open http://localhost:3000

### 5. Deploy to Vercel

1. Push to GitHub: `git push origin main`
2. Import the repo at vercel.com
3. Add environment variables in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

## Project Structure

```
src/
  app/
    page.tsx                      # Dashboard — list saved analyses
    layout.tsx                    # Root layout
    globals.css                   # Tailwind + custom styles
    analysis/[id]/page.tsx        # Full analysis UI (zoning + financial tabs)
    api/property/route.ts         # Address lookup via Census Geocoder
  components/
    ZoningTab.tsx                 # Zoning feasibility calculator + district ref
  lib/
    zoning.ts                     # Zoning data + calculator engine (Jan 2025 ordinance)
    calculator.ts                 # Financial math (IRR, amortization, projections)
    db.ts                         # Supabase CRUD operations
    format.ts                     # Currency/percentage formatting
    supabase.ts                   # Supabase client
    types.ts                      # TypeScript types + defaults
supabase/
  schema.sql                      # Database schema + county seed data
```
