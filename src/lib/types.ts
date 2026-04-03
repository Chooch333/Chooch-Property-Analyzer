// ============================================================
// Database types
// ============================================================

export interface UnitInfo {
  unit_name: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  monthly_rent: number;
}

export interface Analysis {
  id: string;
  created_at: string;
  updated_at: string;

  // Property
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  property_type: PropertyType;
  num_units: number;
  total_sqft: number | null;
  year_built: number | null;

  // Zoning
  zoning_district: string;
  lot_area: number;
  zoning_stories: number;
  zoning_max_units: number | null;
  zoning_binding_constraint: string | null;

  // Purchase
  purchase_price: number;
  closing_costs_pct: number;
  rehab_budget: number;

  // Construction (ground-up)
  land_cost: number;
  construction_cost_per_sf: number;
  construction_sqft: number;

  // Financing
  down_payment_pct: number;
  interest_rate: number;
  loan_term_years: number;

  // Income
  units: UnitInfo[];
  vacancy_rate_pct: number;
  other_monthly_income: number;

  // Expenses
  annual_property_tax: number;
  annual_insurance: number;
  monthly_hoa: number;
  maintenance_pct: number;
  capex_pct: number;
  management_pct: number;

  // Cash-out refi
  refi_enabled: boolean;
  arv: number;
  refi_ltv_pct: number;
  refi_rate: number;
  refi_term_years: number;

  // Assumptions
  annual_rent_growth_pct: number;
  annual_appreciation_pct: number;
  annual_expense_growth_pct: number;
  hold_period_years: number;
  selling_costs_pct: number;

  // Meta
  tags: string[];
  notes: string;
}

export type PropertyType = "sfr" | "duplex" | "triplex" | "quadplex" | "ground_up";

export interface CountyDefaults {
  id: number;
  county: string;
  state: string;
  avg_tax_rate_pct: number | null;
  avg_insurance_per_unit: number | null;
  avg_rent_2br: number | null;
  avg_rent_3br: number | null;
  notes: string | null;
}

// ============================================================
// Calculator output types
// ============================================================

export interface CalcResults {
  // Upfront
  totalProjectCost: number;
  downPayment: number;
  closingCosts: number;
  cashToClose: number;
  loanAmount: number;

  // Monthly
  monthlyPI: number;
  monthlyGrossRent: number;
  monthlyEffectiveRent: number;
  monthlyExpenses: number;
  monthlyNOI: number;
  monthlyCashFlow: number;

  // Annual
  annualGrossRent: number;
  annualEffectiveRent: number;
  annualExpenses: number;
  annualNOI: number;
  annualDebtService: number;
  annualCashFlow: number;

  // Returns
  capRate: number;
  cashOnCash: number;
  dscr: number;
  grossRentMultiplier: number;
  pricePerUnit: number;
  pricePerSqft: number | null;

  // Refi
  refiLoanAmount: number | null;
  refiMonthlyPI: number | null;
  refiCashOut: number | null;
  refiMonthlyCashFlow: number | null;
  refiCashOnCash: number | null;
  moneyLeftInDeal: number | null;

  // IRR / hold period
  irr: number | null;
  totalEquityAtSale: number;
  totalReturnOnInvestment: number;

  // Year-by-year projection
  yearlyProjection: YearProjection[];
}

export interface YearProjection {
  year: number;
  grossRent: number;
  vacancy: number;
  effectiveRent: number;
  expenses: number;
  noi: number;
  debtService: number;
  cashFlow: number;
  propertyValue: number;
  loanBalance: number;
  equity: number;
  cumulativeCashFlow: number;
}

// ============================================================
// Default analysis template
// ============================================================

export function createDefaultAnalysis(): Omit<Analysis, "id" | "created_at" | "updated_at"> {
  return {
    name: "New Analysis",
    address: "",
    city: "Indianapolis",
    state: "IN",
    zip: "",
    county: "Marion",
    property_type: "duplex",
    num_units: 2,
    total_sqft: null,
    year_built: null,

    zoning_district: "",
    lot_area: 0,
    zoning_stories: 0,
    zoning_max_units: null,
    zoning_binding_constraint: null,

    purchase_price: 200000,
    closing_costs_pct: 3,
    rehab_budget: 0,

    land_cost: 0,
    construction_cost_per_sf: 125,
    construction_sqft: 2800,

    down_payment_pct: 20,
    interest_rate: 6.5,
    loan_term_years: 30,

    units: [
      { unit_name: "Unit A", bedrooms: 2, bathrooms: 1, sqft: 850, monthly_rent: 1100 },
      { unit_name: "Unit B", bedrooms: 2, bathrooms: 1, sqft: 850, monthly_rent: 1100 },
    ],
    vacancy_rate_pct: 5,
    other_monthly_income: 0,

    annual_property_tax: 2400,
    annual_insurance: 1800,
    monthly_hoa: 0,
    maintenance_pct: 5,
    capex_pct: 5,
    management_pct: 0,

    refi_enabled: false,
    arv: 0,
    refi_ltv_pct: 75,
    refi_rate: 6.5,
    refi_term_years: 30,

    annual_rent_growth_pct: 3,
    annual_appreciation_pct: 3,
    annual_expense_growth_pct: 2,
    hold_period_years: 10,
    selling_costs_pct: 6,

    tags: [],
    notes: "",
  };
}
