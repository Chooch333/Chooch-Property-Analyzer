"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getAnalysis, updateAnalysis, getCountyDefaults, listCounties } from "@/lib/db";
import { calculate } from "@/lib/calculator";
import { fmt, pct, num, valueColor } from "@/lib/format";
import type { Analysis, CalcResults, UnitInfo, CountyDefaults, PropertyType } from "@/lib/types";
import ZoningTab, { type PropertyLookupResult } from "@/components/ZoningTab";

const TABS = ["zoning", "overview", "income", "expenses", "financing", "refi", "projections"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  zoning: "Zoning",
  overview: "Overview",
  income: "Income",
  expenses: "Expenses",
  financing: "Financing",
  refi: "Cash-Out Refi",
  projections: "Projections",
};

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "sfr", label: "Single Family" },
  { value: "duplex", label: "Duplex" },
  { value: "triplex", label: "Triplex" },
  { value: "quadplex", label: "Quadplex" },
  { value: "ground_up", label: "Ground-Up" },
];

export default function AnalysisPage({ params }: { params: { id: string } }) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [results, setResults] = useState<CalcResults | null>(null);
  const [counties, setCounties] = useState<CountyDefaults[]>([]);
  const [tab, setTab] = useState<Tab>("zoning");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  // FIX #4: Track manually overridden fields
  const [overrides, setOverrides] = useState<Set<string>>(new Set());
  // FIX #3: Closing costs manual dollar override
  const [closingCostsDollarOverride, setClosingCostsDollarOverride] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [a, c] = await Promise.all([getAnalysis(params.id), listCounties()]);
        if (!a) { setError("Analysis not found"); setLoading(false); return; }
        setAnalysis(a);
        setResults(calculate(a));
        setCounties(c);
        // Check URL for starting tab
        if (typeof window !== "undefined") {
          const sp = new URLSearchParams(window.location.search);
          if (sp.get("start") === "financial") setTab("overview");
        }
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [params.id]);

  const save = useCallback(async (updated: Analysis) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        setSaving(true);
        const { id, created_at, updated_at, ...rest } = updated;
        await updateAnalysis(id, rest);
      } catch (e: any) { setError(e.message); }
      finally { setSaving(false); }
    }, 800);
  }, []);

  function update<K extends keyof Analysis>(field: K, value: Analysis[K]) {
    if (!analysis) return;
    const next = { ...analysis, [field]: value };
    setAnalysis(next);
    setResults(calculate(next));
    save(next);
  }

  // FIX #4: Manual update that marks the field as overridden (red ring)
  function updateManual<K extends keyof Analysis>(field: K, value: Analysis[K]) {
    update(field, value);
    setOverrides((prev) => new Set(prev).add(field));
  }

  function isOverridden(field: string): boolean {
    return overrides.has(field);
  }

  function updateUnit(index: number, field: keyof UnitInfo, value: any) {
    if (!analysis) return;
    const units = [...analysis.units];
    units[index] = { ...units[index], [field]: value };
    const next = { ...analysis, units };
    setAnalysis(next);
    setResults(calculate(next));
    save(next);
  }

  async function applyCounty(county: string) {
    const defaults = await getCountyDefaults(county);
    if (!defaults || !analysis) return;
    const next = { ...analysis, county };
    if (defaults.avg_tax_rate_pct) {
      const basis = analysis.property_type === "ground_up"
        ? analysis.land_cost + analysis.construction_cost_per_sf * analysis.construction_sqft
        : analysis.purchase_price;
      next.annual_property_tax = Math.round(basis * (defaults.avg_tax_rate_pct / 100));
    }
    if (defaults.avg_insurance_per_unit) {
      next.annual_insurance = Math.round(defaults.avg_insurance_per_unit * analysis.num_units);
    }
    setAnalysis(next);
    setResults(calculate(next));
    save(next);
  }

  function changePropertyType(pt: PropertyType) {
    if (!analysis) return;
    const unitCounts: Record<PropertyType, number> = { sfr: 1, duplex: 2, triplex: 3, quadplex: 4, ground_up: 4 };
    const numUnits = unitCounts[pt];
    const units = [...analysis.units];
    while (units.length < numUnits) {
      units.push({ unit_name: `Unit ${String.fromCharCode(65 + units.length)}`, bedrooms: 2, bathrooms: 1, sqft: 850, monthly_rent: 1100 });
    }
    while (units.length > numUnits) units.pop();
    const next = { ...analysis, property_type: pt, num_units: numUnits, units };
    setAnalysis(next);
    setResults(calculate(next));
    save(next);
  }

  // Called from ZoningTab when user clicks "Apply to Financial"
  function handleZoningApply(maxUnits: number, propertyType: string) {
    if (!analysis) return;
    const pt = propertyType as PropertyType;
    const units: UnitInfo[] = [];
    for (let i = 0; i < maxUnits; i++) {
      units.push({
        unit_name: `Unit ${String.fromCharCode(65 + i)}`,
        bedrooms: 2, bathrooms: 1, sqft: 660, monthly_rent: 1100,
      });
    }
    const next = {
      ...analysis,
      property_type: pt,
      num_units: maxUnits,
      units,
      zoning_max_units: maxUnits,
      // If ground-up, set construction sqft from zoning
      ...(pt === "ground_up" ? { construction_sqft: maxUnits * 660 } : {}),
    };
    setAnalysis(next);
    setResults(calculate(next));
    save(next);
    setTab("overview");
  }

  // Called from ZoningTab when address lookup returns property data
  function handlePropertyData(data: PropertyLookupResult) {
    if (!analysis) return;
    const updates: Partial<Analysis> = {};
    if (data.address) updates.address = data.address;
    if (data.city) updates.city = data.city;
    if (data.zip) updates.zip = data.zip;
    if (data.county) updates.county = data.county;
    if (data.yearBuilt) updates.year_built = Number(data.yearBuilt);
    if (data.lotAreaSF) updates.total_sqft = data.lotAreaSF;
    if (data.zoningDistrictId) updates.zoning_district = data.zoningDistrictId;
    if (data.lotAreaSF) updates.lot_area = data.lotAreaSF;
    // FIX #2: assessed value → purchase price
    if (data.assessedValue) updates.purchase_price = Number(data.assessedValue);

    const next = { ...analysis, ...updates };
    setAnalysis(next);
    setResults(calculate(next));
    save(next);
    // Clear overrides since these are auto-populated values
    setOverrides(new Set());
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-sand-300 border-t-sand-600 rounded-full animate-spin" />
    </div>
  );

  if (error || !analysis || !results) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-loss mb-4">{error || "Not found"}</p>
        <a href="/" className="btn-secondary">Back</a>
      </div>
    </div>
  );

  const r = results;

  return (
    <div className="min-h-screen pb-20">
      <header className="border-b border-sand-200 bg-white/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-4 py-3">
            <a href="/" className="p-2 -ml-2 rounded-lg hover:bg-sand-100 text-sand-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
            </a>
            <input
              type="text" value={analysis.name}
              onChange={(e) => update("name", e.target.value)}
              className="font-display text-xl bg-transparent border-none outline-none flex-1 min-w-0 placeholder-sand-300"
              placeholder="Analysis name..."
            />
            <span className={`text-xs px-2 py-1 rounded-full transition-all ${saving ? "bg-accent/10 text-accent" : "bg-sand-100 text-sand-400"}`}>
              {saving ? "Saving..." : "Saved"}
            </span>
          </div>
          <div className="flex gap-1 -mb-px overflow-x-auto scrollbar-none">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`tab whitespace-nowrap ${tab === t ? "tab-active" : ""}`}>
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Key metrics strip — visible on financial tabs */}
        {tab !== "zoning" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
            <MetricCard label="Monthly Cash Flow" value={fmt(r.monthlyCashFlow)} color={valueColor(r.monthlyCashFlow)} sub={`${fmt(r.annualCashFlow)}/yr`} />
            <MetricCard label="Cash-on-Cash" value={pct(r.cashOnCash)} color={valueColor(r.cashOnCash)} />
            <MetricCard label="Cap Rate" value={pct(r.capRate)} />
            <MetricCard label="DSCR" value={num(r.dscr, 2)} color={r.dscr >= 1.25 ? "text-profit" : r.dscr < 1 ? "text-loss" : "text-sand-700"} />
            <MetricCard label="Cash to Close" value={fmt(r.cashToClose, { compact: true })} />
            <MetricCard label="IRR" value={r.irr !== null ? pct(r.irr * 100) : "—"} color={r.irr && r.irr > 0 ? "text-profit" : "text-sand-600"} />
          </div>
        )}

        {/* ZONING TAB */}
        {tab === "zoning" && (
          <ZoningTab
            lotArea={analysis.lot_area}
            districtId={analysis.zoning_district}
            stories={analysis.zoning_stories}
            onLotAreaChange={(v) => update("lot_area", v)}
            onDistrictChange={(id) => update("zoning_district", id)}
            onStoriesChange={(v) => update("zoning_stories", v)}
            onApplyToFinancial={handleZoningApply}
            onPropertyDataReceived={handlePropertyData}
          />
        )}

        {/* OVERVIEW TAB */}
        {tab === "overview" && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card">
              <div className="card-header"><h2 className="font-display text-lg">Property Details</h2></div>
              <div className="card-body space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Address" value={analysis.address} onChange={(v) => update("address", v)} />
                  <Field label="City" value={analysis.city} onChange={(v) => update("city", v)} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="State" value={analysis.state} onChange={(v) => update("state", v)} />
                  <Field label="ZIP" value={analysis.zip} onChange={(v) => update("zip", v)} />
                  <div>
                    <label className="input-label">County</label>
                    <select value={analysis.county} onChange={(e) => applyCounty(e.target.value)} className="input-field">
                      <option value="">Select...</option>
                      {counties.map((c) => <option key={c.county} value={c.county}>{c.county}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="input-label">Property Type</label>
                    <select value={analysis.property_type} onChange={(e) => changePropertyType(e.target.value as PropertyType)} className="input-field">
                      {PROPERTY_TYPES.map((pt) => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
                    </select>
                  </div>
                  <NumField label="Total Sq Ft" value={analysis.total_sqft} onChange={(v) => update("total_sqft", v)} />
                  <NumField label="Year Built" value={analysis.year_built} onChange={(v) => update("year_built", v)} />
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-header">
                <h2 className="font-display text-lg">{analysis.property_type === "ground_up" ? "Construction Costs" : "Acquisition"}</h2>
              </div>
              <div className="card-body space-y-4">
                {analysis.property_type === "ground_up" ? (
                  <>
                    <DollarField label="Land Cost" value={analysis.land_cost} onChange={(v) => updateManual("land_cost", v)} overridden={isOverridden("land_cost")} />
                    <div className="grid grid-cols-2 gap-4">
                      <DollarField label="Cost / SF" value={analysis.construction_cost_per_sf} onChange={(v) => updateManual("construction_cost_per_sf", v)} overridden={isOverridden("construction_cost_per_sf")} />
                      <NumField label="Construction SF" value={analysis.construction_sqft} onChange={(v) => updateManual("construction_sqft", v)} overridden={isOverridden("construction_sqft")} />
                    </div>
                    <div className="p-3 bg-sand-50 rounded-lg">
                      <div className="text-xs text-sand-500">Total Construction</div>
                      <div className="font-mono text-lg font-medium">{fmt(analysis.construction_cost_per_sf * analysis.construction_sqft)}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <DollarField label="Purchase Price" value={analysis.purchase_price} onChange={(v) => updateManual("purchase_price", v)} overridden={isOverridden("purchase_price")} />
                    <DollarField label="Rehab Budget" value={analysis.rehab_budget} onChange={(v) => updateManual("rehab_budget", v)} overridden={isOverridden("rehab_budget")} />
                  </>
                )}
                {/* FIX #3: Closing costs — show % and $ amount, allow $ override */}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <PctField label="Closing Costs %" value={analysis.closing_costs_pct} onChange={(v) => {
                      update("closing_costs_pct", v);
                      setClosingCostsDollarOverride(null); // reset dollar override when % changes
                    }} />
                    <DollarField
                      label="Closing Costs $"
                      value={closingCostsDollarOverride !== null ? closingCostsDollarOverride : Math.round(r.closingCosts)}
                      onChange={(v) => {
                        setClosingCostsDollarOverride(v);
                        // Back-calculate the percentage
                        const basis = analysis.property_type === "ground_up"
                          ? analysis.land_cost + analysis.construction_cost_per_sf * analysis.construction_sqft
                          : analysis.purchase_price;
                        if (basis > 0) {
                          updateManual("closing_costs_pct", Math.round((v / basis) * 10000) / 100);
                        }
                      }}
                      overridden={closingCostsDollarOverride !== null}
                    />
                  </div>
                </div>
                <div className="p-3 bg-sand-50 rounded-lg flex justify-between">
                  <span className="text-sm text-sand-600">Total Project Cost</span>
                  <span className="font-mono font-medium">{fmt(r.totalProjectCost)}</span>
                </div>
              </div>
            </div>
            <div className="card lg:col-span-2">
              <div className="card-header"><h2 className="font-display text-lg">Deal Summary</h2></div>
              <div className="card-body">
                <div className="grid sm:grid-cols-3 gap-4">
                  <SummaryRow label="Down Payment" value={fmt(r.downPayment)} sub={pct(analysis.down_payment_pct)} />
                  <SummaryRow label="Closing Costs" value={fmt(r.closingCosts)} />
                  <SummaryRow label="Cash to Close" value={fmt(r.cashToClose)} highlight />
                  <SummaryRow label="Loan Amount" value={fmt(r.loanAmount)} />
                  <SummaryRow label="Monthly P&I" value={fmt(r.monthlyPI)} />
                  <SummaryRow label="Price / Unit" value={fmt(r.pricePerUnit, { compact: true })} />
                  {r.pricePerSqft && <SummaryRow label="Price / SF" value={fmt(r.pricePerSqft)} />}
                  <SummaryRow label="GRM" value={num(r.grossRentMultiplier, 1)} />
                  <SummaryRow label={`Total Return (${analysis.hold_period_years}yr)`} value={pct(r.totalReturnOnInvestment)} highlight />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* INCOME TAB */}
        {tab === "income" && (
          <div className="card">
            <div className="card-header">
              <h2 className="font-display text-lg">Rental Income</h2>
              <div className="text-sm text-sand-500">Gross: <span className="font-mono font-medium text-sand-700">{fmt(r.monthlyGrossRent)}/mo</span></div>
            </div>
            <div className="card-body space-y-4">
              {analysis.units.map((unit, i) => (
                <div key={i} className="p-4 bg-sand-50 rounded-lg space-y-3">
                  <input type="text" value={unit.unit_name} onChange={(e) => updateUnit(i, "unit_name", e.target.value)} className="font-medium bg-transparent border-none outline-none text-sand-800" />
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <NumField label="Beds" value={unit.bedrooms} onChange={(v) => updateUnit(i, "bedrooms", v)} />
                    <NumField label="Baths" value={unit.bathrooms} onChange={(v) => updateUnit(i, "bathrooms", v)} />
                    <NumField label="Sq Ft" value={unit.sqft} onChange={(v) => updateUnit(i, "sqft", v)} />
                    <DollarField label="Monthly Rent" value={unit.monthly_rent} onChange={(v) => updateUnit(i, "monthly_rent", v)} />
                    <div>
                      <label className="input-label">Rent / SF</label>
                      <div className="input-field bg-sand-100 text-sand-600 cursor-default">{unit.sqft > 0 ? `$${(unit.monthly_rent / unit.sqft).toFixed(2)}` : "—"}</div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <DollarField label="Other Monthly Income" value={analysis.other_monthly_income} onChange={(v) => update("other_monthly_income", v)} />
                <PctField label="Vacancy Rate" value={analysis.vacancy_rate_pct} onChange={(v) => update("vacancy_rate_pct", v)} />
              </div>
              <div className="p-3 bg-profit/5 rounded-lg flex justify-between border border-profit/10">
                <span className="text-sm text-profit">Effective Monthly Rent</span>
                <span className="font-mono font-medium text-profit">{fmt(r.monthlyEffectiveRent)}</span>
              </div>
            </div>
          </div>
        )}

        {/* EXPENSES TAB */}
        {tab === "expenses" && (
          <div className="card">
            <div className="card-header">
              <h2 className="font-display text-lg">Operating Expenses</h2>
              <div className="text-sm text-sand-500">Total: <span className="font-mono font-medium text-sand-700">{fmt(r.monthlyExpenses)}/mo</span></div>
            </div>
            <div className="card-body space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <DollarField label="Annual Property Tax" value={analysis.annual_property_tax} onChange={(v) => update("annual_property_tax", v)} />
                <DollarField label="Annual Insurance" value={analysis.annual_insurance} onChange={(v) => update("annual_insurance", v)} />
                <DollarField label="Monthly HOA" value={analysis.monthly_hoa} onChange={(v) => update("monthly_hoa", v)} />
              </div>
              <div className="border-t border-sand-100 pt-4">
                <p className="text-xs text-sand-500 mb-3">Percentages of gross rent</p>
                <div className="grid sm:grid-cols-3 gap-4">
                  <PctField label="Maintenance" value={analysis.maintenance_pct} onChange={(v) => update("maintenance_pct", v)} />
                  <PctField label="CapEx Reserve" value={analysis.capex_pct} onChange={(v) => update("capex_pct", v)} />
                  <PctField label="Management" value={analysis.management_pct} onChange={(v) => update("management_pct", v)} />
                </div>
              </div>
              <div className="p-4 bg-sand-50 rounded-lg space-y-2">
                {[
                  ["Property Tax", fmt(analysis.annual_property_tax / 12)],
                  ["Insurance", fmt(analysis.annual_insurance / 12)],
                  ["HOA", fmt(analysis.monthly_hoa)],
                  [`Maintenance (${pct(analysis.maintenance_pct, 0)})`, fmt(r.monthlyGrossRent * analysis.maintenance_pct / 100)],
                  [`CapEx (${pct(analysis.capex_pct, 0)})`, fmt(r.monthlyGrossRent * analysis.capex_pct / 100)],
                  [`Management (${pct(analysis.management_pct, 0)})`, fmt(r.monthlyGrossRent * analysis.management_pct / 100)],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between text-sm"><span className="text-sand-600">{label}</span><span className="font-mono">{val}/mo</span></div>
                ))}
                <div className="border-t border-sand-200 pt-2 flex justify-between font-medium">
                  <span>Total Expenses</span><span className="font-mono">{fmt(r.monthlyExpenses)}/mo</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FINANCING TAB */}
        {tab === "financing" && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card">
              <div className="card-header"><h2 className="font-display text-lg">Loan Terms</h2></div>
              <div className="card-body space-y-4">
                <PctField label="Down Payment" value={analysis.down_payment_pct} onChange={(v) => update("down_payment_pct", v)} />
                <PctField label="Interest Rate" value={analysis.interest_rate} onChange={(v) => update("interest_rate", v)} />
                <div>
                  <label className="input-label">Loan Term</label>
                  <select value={analysis.loan_term_years} onChange={(e) => update("loan_term_years", Number(e.target.value))} className="input-field">
                    {[15, 20, 25, 30].map((y) => <option key={y} value={y}>{y} Years</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h2 className="font-display text-lg">Growth Assumptions</h2></div>
              <div className="card-body space-y-4">
                <PctField label="Annual Rent Growth" value={analysis.annual_rent_growth_pct} onChange={(v) => update("annual_rent_growth_pct", v)} />
                <PctField label="Annual Appreciation" value={analysis.annual_appreciation_pct} onChange={(v) => update("annual_appreciation_pct", v)} />
                <PctField label="Annual Expense Growth" value={analysis.annual_expense_growth_pct} onChange={(v) => update("annual_expense_growth_pct", v)} />
                <NumField label="Hold Period (years)" value={analysis.hold_period_years} onChange={(v) => update("hold_period_years", v)} />
                <PctField label="Selling Costs" value={analysis.selling_costs_pct} onChange={(v) => update("selling_costs_pct", v)} />
              </div>
            </div>
          </div>
        )}

        {/* REFI TAB */}
        {tab === "refi" && (
          <div className="card max-w-2xl">
            <div className="card-header">
              <h2 className="font-display text-lg">Cash-Out Refinance</h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={analysis.refi_enabled} onChange={(e) => update("refi_enabled", e.target.checked)} className="w-4 h-4 rounded border-sand-300 text-accent focus:ring-accent" />
                <span className="text-sm text-sand-600">Enable</span>
              </label>
            </div>
            {analysis.refi_enabled && (
              <div className="card-body space-y-4">
                <DollarField label="After Repair Value (ARV)" value={analysis.arv} onChange={(v) => update("arv", v)} />
                <PctField label="LTV %" value={analysis.refi_ltv_pct} onChange={(v) => update("refi_ltv_pct", v)} />
                <PctField label="Refi Interest Rate" value={analysis.refi_rate} onChange={(v) => update("refi_rate", v)} />
                <div>
                  <label className="input-label">Refi Term</label>
                  <select value={analysis.refi_term_years} onChange={(e) => update("refi_term_years", Number(e.target.value))} className="input-field">
                    {[15, 20, 25, 30].map((y) => <option key={y} value={y}>{y} Years</option>)}
                  </select>
                </div>
                {r.refiLoanAmount !== null && (
                  <div className="p-4 bg-sand-50 rounded-lg space-y-2 mt-4">
                    {[
                      ["New Loan Amount", fmt(r.refiLoanAmount)],
                      ["Cash Out", fmt(r.refiCashOut), r.refiCashOut! > 0 ? "text-profit" : "text-loss"],
                      ["Money Left in Deal", fmt(r.moneyLeftInDeal)],
                      ["New Monthly P&I", fmt(r.refiMonthlyPI)],
                    ].map(([label, val, color]) => (
                      <div key={label as string} className="flex justify-between text-sm">
                        <span className="text-sand-600">{label}</span>
                        <span className={`font-mono ${color || ""}`}>{val}</span>
                      </div>
                    ))}
                    <div className="border-t border-sand-200 pt-2 flex justify-between font-medium">
                      <span>Post-Refi Cash Flow</span>
                      <span className={`font-mono ${valueColor(r.refiMonthlyCashFlow || 0)}`}>{fmt(r.refiMonthlyCashFlow)}/mo</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Post-Refi CoC</span>
                      <span className={`font-mono ${valueColor(r.refiCashOnCash || 0)}`}>{r.refiCashOnCash === Infinity ? "∞" : pct(r.refiCashOnCash)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* PROJECTIONS TAB */}
        {tab === "projections" && (
          <div className="card">
            <div className="card-header"><h2 className="font-display text-lg">{analysis.hold_period_years}-Year Projection</h2></div>
            <div className="card-body overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sand-200">
                    {["Year", "Gross Rent", "Expenses", "NOI", "Debt Svc", "Cash Flow", "Prop Value", "Equity", "Cumul CF"].map((h) => (
                      <th key={h} className={`py-2 px-2 text-xs font-medium text-sand-500 ${h === "Year" ? "text-left" : "text-right"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.yearlyProjection.map((yp) => (
                    <tr key={yp.year} className="border-b border-sand-50 hover:bg-sand-50/50">
                      <td className="py-2 px-2 font-mono font-medium">{yp.year}</td>
                      <td className="py-2 px-2 font-mono text-right">{fmt(yp.grossRent, { compact: true })}</td>
                      <td className="py-2 px-2 font-mono text-right">{fmt(yp.expenses, { compact: true })}</td>
                      <td className="py-2 px-2 font-mono text-right">{fmt(yp.noi, { compact: true })}</td>
                      <td className="py-2 px-2 font-mono text-right">{fmt(yp.debtService, { compact: true })}</td>
                      <td className={`py-2 px-2 font-mono text-right font-medium ${valueColor(yp.cashFlow)}`}>{fmt(yp.cashFlow, { compact: true })}</td>
                      <td className="py-2 px-2 font-mono text-right">{fmt(yp.propertyValue, { compact: true })}</td>
                      <td className="py-2 px-2 font-mono text-right text-profit">{fmt(yp.equity, { compact: true })}</td>
                      <td className={`py-2 px-2 font-mono text-right ${valueColor(yp.cumulativeCashFlow)}`}>{fmt(yp.cumulativeCashFlow, { compact: true })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-6 p-4 bg-sand-50 rounded-lg grid sm:grid-cols-3 gap-4">
                <SummaryRow label="Total Cash Flow" value={fmt(r.yearlyProjection[r.yearlyProjection.length - 1]?.cumulativeCashFlow || 0, { compact: true })} />
                <SummaryRow label="Equity at Sale" value={fmt(r.totalEquityAtSale, { compact: true })} highlight />
                <SummaryRow label="Total ROI" value={pct(r.totalReturnOnInvestment)} highlight />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Notes — always visible at bottom */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
        <div className="card">
          <div className="card-header"><h2 className="font-display text-lg">Notes</h2></div>
          <div className="card-body">
            <textarea value={analysis.notes} onChange={(e) => update("notes", e.target.value)} className="input-field min-h-[80px] resize-y" placeholder="Analysis notes, zoning findings, comparable sales..." />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Shared field components ----

function MetricCard({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="metric-card bg-white border border-sand-100">
      <div className={`metric-value ${color || "text-sand-800"}`}>{value}</div>
      <div className="metric-label">{label}</div>
      {sub && <div className="text-xs text-sand-400 font-mono mt-0.5">{sub}</div>}
    </div>
  );
}

function SummaryRow({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-lg ${highlight ? "bg-accent/5 border border-accent/10" : ""}`}>
      <div className="text-xs text-sand-500">{label}</div>
      <div className={`font-mono text-lg font-medium ${highlight ? "text-accent-dark" : "text-sand-800"}`}>
        {value}{sub && <span className="text-xs text-sand-500 ml-1.5 font-normal">{sub}</span>}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <div><label className="input-label">{label}</label><input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} className="input-field" /></div>;
}

function NumField({ label, value, onChange, overridden }: { label: string; value: number | null; onChange: (v: number) => void; overridden?: boolean }) {
  return <div><label className="input-label">{label}</label><input type="number" value={value ?? ""} onChange={(e) => onChange(Number(e.target.value) || 0)} className={`input-field font-mono ${overridden ? "input-overridden" : ""}`} /></div>;
}

function DollarField({ label, value, onChange, overridden }: { label: string; value: number; onChange: (v: number) => void; overridden?: boolean }) {
  return (
    <div><label className="input-label">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sand-400 text-sm">$</span>
        <input type="number" value={value || ""} onChange={(e) => onChange(Number(e.target.value) || 0)} className={`input-field font-mono pl-7 ${overridden ? "input-overridden" : ""}`} />
      </div>
    </div>
  );
}

function PctField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div><label className="input-label">{label}</label>
      <div className="relative">
        <input type="number" step="0.1" value={value || ""} onChange={(e) => onChange(Number(e.target.value) || 0)} className="input-field font-mono pr-8" />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sand-400 text-sm">%</span>
      </div>
    </div>
  );
}
