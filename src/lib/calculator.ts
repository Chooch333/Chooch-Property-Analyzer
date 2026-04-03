import type { Analysis, CalcResults, YearProjection } from "./types";

/**
 * Monthly payment for a fixed-rate amortized loan.
 */
function monthlyPayment(principal: number, annualRate: number, years: number): number {
  if (principal <= 0 || annualRate <= 0 || years <= 0) return 0;
  const r = annualRate / 100 / 12;
  const n = years * 12;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/**
 * Remaining loan balance after `months` payments.
 */
function loanBalance(principal: number, annualRate: number, years: number, monthsPaid: number): number {
  if (principal <= 0 || annualRate <= 0) return 0;
  const r = annualRate / 100 / 12;
  const n = years * 12;
  const pmt = monthlyPayment(principal, annualRate, years);
  return principal * Math.pow(1 + r, monthsPaid) - pmt * ((Math.pow(1 + r, monthsPaid) - 1) / r);
}

/**
 * Newton's method IRR calculation.
 */
function calcIRR(cashFlows: number[], guess: number = 0.1): number | null {
  let rate = guess;
  for (let i = 0; i < 1000; i++) {
    let npv = 0;
    let dnpv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      const factor = Math.pow(1 + rate, t);
      npv += cashFlows[t] / factor;
      dnpv -= t * cashFlows[t] / (factor * (1 + rate));
    }
    if (Math.abs(npv) < 0.01) return rate;
    rate = rate - npv / dnpv;
    if (isNaN(rate) || !isFinite(rate)) return null;
  }
  return null;
}

/**
 * Run full analysis calculations.
 */
export function calculate(a: Analysis | Omit<Analysis, "id" | "created_at" | "updated_at">): CalcResults {
  // ---- Upfront costs ----
  const isGroundUp = a.property_type === "ground_up";
  const totalProjectCost = isGroundUp
    ? a.land_cost + a.construction_cost_per_sf * a.construction_sqft
    : a.purchase_price + a.rehab_budget;
  
  const acquisitionBasis = isGroundUp ? a.land_cost + a.construction_cost_per_sf * a.construction_sqft : a.purchase_price;
  const closingCosts = acquisitionBasis * (a.closing_costs_pct / 100);
  const downPayment = acquisitionBasis * (a.down_payment_pct / 100);
  const loanAmount = acquisitionBasis - downPayment;
  const cashToClose = downPayment + closingCosts + a.rehab_budget;

  // ---- Monthly income ----
  const monthlyGrossRent = a.units.reduce((sum, u) => sum + u.monthly_rent, 0) + a.other_monthly_income;
  const monthlyVacancy = monthlyGrossRent * (a.vacancy_rate_pct / 100);
  const monthlyEffectiveRent = monthlyGrossRent - monthlyVacancy;

  // ---- Monthly expenses ----
  const monthlyTax = a.annual_property_tax / 12;
  const monthlyInsurance = a.annual_insurance / 12;
  const monthlyMaintenance = monthlyGrossRent * (a.maintenance_pct / 100);
  const monthlyCapex = monthlyGrossRent * (a.capex_pct / 100);
  const monthlyMgmt = monthlyGrossRent * (a.management_pct / 100);
  const monthlyExpenses = monthlyTax + monthlyInsurance + a.monthly_hoa + monthlyMaintenance + monthlyCapex + monthlyMgmt;

  // ---- Monthly debt service ----
  const monthlyPI = monthlyPayment(loanAmount, a.interest_rate, a.loan_term_years);

  // ---- Monthly / annual cash flow ----
  const monthlyNOI = monthlyEffectiveRent - monthlyExpenses;
  const monthlyCashFlow = monthlyNOI - monthlyPI;

  const annualGrossRent = monthlyGrossRent * 12;
  const annualEffectiveRent = monthlyEffectiveRent * 12;
  const annualExpenses = monthlyExpenses * 12;
  const annualNOI = monthlyNOI * 12;
  const annualDebtService = monthlyPI * 12;
  const annualCashFlow = monthlyCashFlow * 12;

  // ---- Key metrics ----
  const capRate = totalProjectCost > 0 ? (annualNOI / totalProjectCost) * 100 : 0;
  const cashOnCash = cashToClose > 0 ? (annualCashFlow / cashToClose) * 100 : 0;
  const dscr = annualDebtService > 0 ? annualNOI / annualDebtService : 0;
  const grossRentMultiplier = annualGrossRent > 0 ? totalProjectCost / annualGrossRent : 0;
  const pricePerUnit = a.num_units > 0 ? totalProjectCost / a.num_units : 0;
  const pricePerSqft = a.total_sqft && a.total_sqft > 0 ? totalProjectCost / a.total_sqft : null;

  // ---- Cash-out refi ----
  let refiLoanAmount: number | null = null;
  let refiMonthlyPI: number | null = null;
  let refiCashOut: number | null = null;
  let refiMonthlyCashFlow: number | null = null;
  let refiCashOnCash: number | null = null;
  let moneyLeftInDeal: number | null = null;

  if (a.refi_enabled && a.arv > 0) {
    refiLoanAmount = a.arv * (a.refi_ltv_pct / 100);
    refiMonthlyPI = monthlyPayment(refiLoanAmount, a.refi_rate, a.refi_term_years);
    refiCashOut = refiLoanAmount - loanAmount; // simplified — ignores amort during rehab
    moneyLeftInDeal = Math.max(0, cashToClose - refiCashOut);
    refiMonthlyCashFlow = monthlyNOI - refiMonthlyPI;
    refiCashOnCash = moneyLeftInDeal > 0 ? ((refiMonthlyCashFlow * 12) / moneyLeftInDeal) * 100 : Infinity;
  }

  // ---- Year-by-year projection ----
  const yearlyProjection: YearProjection[] = [];
  let cumulativeCF = 0;
  
  const useRefiDebt = a.refi_enabled && refiMonthlyPI !== null;
  const projLoanAmount = useRefiDebt ? refiLoanAmount! : loanAmount;
  const projRate = useRefiDebt ? a.refi_rate : a.interest_rate;
  const projTerm = useRefiDebt ? a.refi_term_years : a.loan_term_years;
  const projMonthlyPI = useRefiDebt ? refiMonthlyPI! : monthlyPI;

  for (let y = 1; y <= a.hold_period_years; y++) {
    const rentGrowth = Math.pow(1 + a.annual_rent_growth_pct / 100, y - 1);
    const expGrowth = Math.pow(1 + a.annual_expense_growth_pct / 100, y - 1);
    const appreciation = Math.pow(1 + a.annual_appreciation_pct / 100, y);

    const yGross = annualGrossRent * rentGrowth;
    const yVacancy = yGross * (a.vacancy_rate_pct / 100);
    const yEffective = yGross - yVacancy;
    const yExpenses = annualExpenses * expGrowth;
    const yNOI = yEffective - yExpenses;
    const yDebtService = projMonthlyPI * 12;
    const yCF = yNOI - yDebtService;
    cumulativeCF += yCF;

    const propValue = totalProjectCost * appreciation;
    const loanBal = loanBalance(projLoanAmount, projRate, projTerm, y * 12);
    const equity = propValue - loanBal;

    yearlyProjection.push({
      year: y,
      grossRent: yGross,
      vacancy: yVacancy,
      effectiveRent: yEffective,
      expenses: yExpenses,
      noi: yNOI,
      debtService: yDebtService,
      cashFlow: yCF,
      propertyValue: propValue,
      loanBalance: Math.max(0, loanBal),
      equity,
      cumulativeCashFlow: cumulativeCF,
    });
  }

  // ---- IRR ----
  const lastYear = yearlyProjection[yearlyProjection.length - 1];
  const saleProceeds = lastYear
    ? lastYear.propertyValue * (1 - a.selling_costs_pct / 100) - lastYear.loanBalance
    : 0;
  const investmentBasis = a.refi_enabled && moneyLeftInDeal !== null ? moneyLeftInDeal : cashToClose;
  
  const irrFlows = [-investmentBasis];
  for (const yp of yearlyProjection) {
    irrFlows.push(yp.cashFlow);
  }
  // Add sale proceeds to final year
  if (irrFlows.length > 1) {
    irrFlows[irrFlows.length - 1] += saleProceeds;
  }
  const irr = calcIRR(irrFlows);

  const totalEquityAtSale = saleProceeds + cumulativeCF;
  const totalReturnOnInvestment = investmentBasis > 0 ? (totalEquityAtSale / investmentBasis) * 100 : 0;

  return {
    totalProjectCost,
    downPayment,
    closingCosts,
    cashToClose,
    loanAmount,
    monthlyPI,
    monthlyGrossRent,
    monthlyEffectiveRent,
    monthlyExpenses,
    monthlyNOI,
    monthlyCashFlow,
    annualGrossRent,
    annualEffectiveRent,
    annualExpenses,
    annualNOI,
    annualDebtService,
    annualCashFlow,
    capRate,
    cashOnCash,
    dscr,
    grossRentMultiplier,
    pricePerUnit,
    pricePerSqft,
    refiLoanAmount,
    refiMonthlyPI,
    refiCashOut,
    refiMonthlyCashFlow,
    refiCashOnCash,
    moneyLeftInDeal,
    irr,
    totalEquityAtSale,
    totalReturnOnInvestment,
    yearlyProjection,
  };
}
