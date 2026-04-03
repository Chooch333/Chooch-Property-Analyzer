-- ============================================================
-- Indy Property Analyzer — Supabase Schema
-- ============================================================

-- Analyses table: stores each saved property analysis
CREATE TABLE analyses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Property info
  name text NOT NULL DEFAULT 'Untitled Analysis',
  address text,
  city text,
  state text DEFAULT 'IN',
  zip text,
  county text,
  property_type text DEFAULT 'duplex', -- sfr, duplex, triplex, quadplex, ground_up
  num_units integer DEFAULT 2,
  total_sqft numeric,
  year_built integer,
  
  -- Zoning
  zoning_district text DEFAULT 'd8',
  lot_area numeric DEFAULT 5000,
  zoning_stories integer DEFAULT 2,
  zoning_max_units integer,
  zoning_binding_constraint text,
  
  -- Purchase
  purchase_price numeric NOT NULL DEFAULT 0,
  closing_costs_pct numeric DEFAULT 3.0,
  rehab_budget numeric DEFAULT 0,
  
  -- Construction (for ground-up)
  land_cost numeric DEFAULT 0,
  construction_cost_per_sf numeric DEFAULT 0,
  construction_sqft numeric DEFAULT 0,
  
  -- Financing
  down_payment_pct numeric DEFAULT 20,
  interest_rate numeric DEFAULT 6.5,
  loan_term_years integer DEFAULT 30,
  
  -- Income
  units jsonb DEFAULT '[]'::jsonb, 
  -- Array of { unit_name, bedrooms, bathrooms, sqft, monthly_rent }
  vacancy_rate_pct numeric DEFAULT 5,
  other_monthly_income numeric DEFAULT 0,
  
  -- Expenses
  annual_property_tax numeric DEFAULT 0,
  annual_insurance numeric DEFAULT 0,
  monthly_hoa numeric DEFAULT 0,
  maintenance_pct numeric DEFAULT 5, -- % of gross rent
  capex_pct numeric DEFAULT 5, -- % of gross rent
  management_pct numeric DEFAULT 0, -- % of gross rent (0 = self-manage)
  
  -- Cash-out refi
  refi_enabled boolean DEFAULT false,
  arv numeric DEFAULT 0,
  refi_ltv_pct numeric DEFAULT 75,
  refi_rate numeric DEFAULT 6.5,
  refi_term_years integer DEFAULT 30,
  
  -- Assumptions
  annual_rent_growth_pct numeric DEFAULT 3,
  annual_appreciation_pct numeric DEFAULT 3,
  annual_expense_growth_pct numeric DEFAULT 2,
  hold_period_years integer DEFAULT 10,
  selling_costs_pct numeric DEFAULT 6,
  
  -- Tags/notes
  tags text[] DEFAULT '{}',
  notes text DEFAULT ''
);

-- Index for listing analyses by date
CREATE INDEX idx_analyses_updated ON analyses (updated_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER analyses_updated_at
  BEFORE UPDATE ON analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- County reference data (Indiana focus)
-- ============================================================
CREATE TABLE county_defaults (
  id serial PRIMARY KEY,
  county text NOT NULL,
  state text NOT NULL DEFAULT 'IN',
  avg_tax_rate_pct numeric, -- as % of assessed value
  avg_insurance_per_unit numeric, -- annual per unit
  avg_rent_2br numeric,
  avg_rent_3br numeric,
  notes text,
  UNIQUE(county, state)
);

-- Seed Indiana county data
INSERT INTO county_defaults (county, state, avg_tax_rate_pct, avg_insurance_per_unit, avg_rent_2br, avg_rent_3br) VALUES
  ('Marion', 'IN', 1.02, 900, 1100, 1350),
  ('Hamilton', 'IN', 0.85, 850, 1400, 1700),
  ('Hancock', 'IN', 0.89, 800, 1050, 1250),
  ('Johnson', 'IN', 0.91, 825, 1050, 1275),
  ('Hendricks', 'IN', 0.88, 850, 1150, 1400),
  ('Boone', 'IN', 0.82, 825, 1200, 1450),
  ('Morgan', 'IN', 0.95, 775, 950, 1150),
  ('Shelby', 'IN', 0.97, 750, 900, 1100),
  ('Madison', 'IN', 1.05, 725, 850, 1050),
  ('Delaware', 'IN', 1.10, 700, 800, 975);

-- ============================================================
-- RLS (permissive for now — tighten with auth later)
-- ============================================================
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE county_defaults ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (no auth yet)
CREATE POLICY "Allow all on analyses" ON analyses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow read on county_defaults" ON county_defaults FOR SELECT USING (true);
