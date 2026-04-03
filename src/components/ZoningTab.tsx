"use client";

import { useState } from "react";
import {
  DISTRICTS,
  calculateZoning,
  CATEGORY_META,
  type ZoningCalcResult,
} from "@/lib/zoning";
import { matchZoneCode } from "@/lib/zoneMatcher";

export interface PropertyLookupResult {
  address?: string;
  city?: string;
  zip?: string;
  county?: string;
  parcelNumber?: string;
  stateParcelNumber?: string;
  lotAreaSF?: number;
  assessedValue?: number;
  landValue?: number;
  improvementValue?: number;
  yearBuilt?: number;
  ownerName?: string;
  zoningRaw?: string;
  zoningDistrictId?: string;
  zoningMatched?: boolean;
}

interface ZoningTabProps {
  lotArea: number;
  districtId: string;
  stories: number;
  onLotAreaChange: (v: number) => void;
  onDistrictChange: (id: string) => void;
  onStoriesChange: (v: number) => void;
  onApplyToFinancial: (maxUnits: number, propertyType: string) => void;
  onPropertyDataReceived: (data: PropertyLookupResult) => void;
}

export default function ZoningTab({
  lotArea, districtId, stories,
  onLotAreaChange, onDistrictChange, onStoriesChange,
  onApplyToFinancial, onPropertyDataReceived,
}: ZoningTabProps) {
  const [addressInput, setAddressInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [calcResult, setCalcResult] = useState<ZoningCalcResult | null>(null);
  const [showDistrictRef, setShowDistrictRef] = useState(false);
  const [expandedDistrict, setExpandedDistrict] = useState<string | null>(null);

  const district = districtId ? DISTRICTS.find((d) => d.id === districtId) : null;
  const ratioDistricts = DISTRICTS.filter((d) => d.far !== null);

  // ---- Address Search ----
  async function handleAddressSearch() {
    if (!addressInput.trim()) return;
    setSearching(true);
    setSearchError(null);
    setSearchResult(null);

    // FIX #5: Reset all previous values on new lookup
    setCalcResult(null);
    onLotAreaChange(0);
    onDistrictChange("");
    onStoriesChange(0);

    try {
      const res = await fetch(`/api/property?address=${encodeURIComponent(addressInput.trim())}`);
      const data = await res.json();

      if (!data.found) {
        setSearchError(data.error || "Address not found.");
        return;
      }

      setSearchResult(data);

      // FIX #1: Auto-populate lot area and zoning district into the calculator fields
      let newDistrictId = "";
      let newLotArea = 0;

      if (data.parcel?.lotAreaSF) {
        newLotArea = data.parcel.lotAreaSF;
        onLotAreaChange(newLotArea);
      }

      if (data.zoning?.rawZone) {
        const match = matchZoneCode(data.zoning.rawZone);
        if (match.matched && match.districtId) {
          newDistrictId = match.districtId;
          onDistrictChange(newDistrictId);
        }
      }

      // Push property data to parent for Overview tab auto-fill
      const propertyData: PropertyLookupResult = {
        address: data.parcel?.address || data.geocode?.matchedAddress,
        city: data.parcel?.city || undefined,
        zip: data.parcel?.zip || undefined,
        county: data.geocode?.county || undefined,
        parcelNumber: data.parcel?.parcelNumber || undefined,
        stateParcelNumber: data.parcel?.stateParcelNumber || undefined,
        lotAreaSF: data.parcel?.lotAreaSF || undefined,
        assessedValue: data.parcel?.assessedValue || undefined,
        landValue: data.parcel?.landValue || undefined,
        improvementValue: data.parcel?.improvementValue || undefined,
        yearBuilt: data.parcel?.yearBuilt || undefined,
        ownerName: data.parcel?.ownerName || undefined,
        zoningRaw: data.zoning?.rawZone || undefined,
        zoningDistrictId: data.zoning?.rawZone ? matchZoneCode(data.zoning.rawZone).districtId || undefined : undefined,
        zoningMatched: data.zoning?.rawZone ? matchZoneCode(data.zoning.rawZone).matched : false,
      };
      onPropertyDataReceived(propertyData);

      // FIX #1: Auto-trigger calculation after lookup populates fields
      if (newLotArea > 0 && newDistrictId) {
        const autoResult = calculateZoning({
          lotArea: newLotArea,
          districtId: newDistrictId,
          stories: stories || 2,
        });
        setCalcResult(autoResult);
      }
    } catch (e: any) {
      setSearchError(e.message || "Search failed");
    } finally {
      setSearching(false);
    }
  }

  // ---- Calculate (manual trigger) ----
  function handleCalculate() {
    if (!districtId) return;
    const result = calculateZoning({ lotArea, districtId, stories: stories || 1 });
    setCalcResult(result);
  }

  function handleCalcKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCalculate();
    }
  }

  function handleApply() {
    if (!calcResult) return;
    const units = calcResult.maxUnits;
    let pt = "sfr";
    if (units >= 5) pt = "ground_up";
    else if (units === 4) pt = "quadplex";
    else if (units === 3) pt = "triplex";
    else if (units === 2) pt = "duplex";
    onApplyToFinancial(units, pt);
  }

  return (
    <div className="space-y-6">
      {/* Single unified card: Property Lookup → Calculator → Results */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="font-display text-lg">Zoning Feasibility</h2>
            <p className="text-xs text-sand-500 mt-0.5">Look up an address or enter values manually — Jan 2025 Indianapolis Consolidated Zoning Ordinance</p>
          </div>
          <button onClick={() => setShowDistrictRef(!showDistrictRef)} className="btn-ghost btn-sm font-mono">
            {showDistrictRef ? "Hide" : "Show"} District Ref
          </button>
        </div>
        <div className="card-body space-y-5">
          {/* Address search */}
          <div>
            <label className="input-label">Property Address</label>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddressSearch()}
                  className="input-field pr-10"
                  placeholder="425 N Arsenal Ave Indianapolis IN 46201"
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-sand-300 border-t-accent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <button onClick={handleAddressSearch} disabled={searching || !addressInput.trim()} className="btn-accent whitespace-nowrap">
                {searching ? "Searching..." : "Look Up"}
              </button>
            </div>
          </div>

          {searchError && (
            <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-sm text-loss">{searchError}</div>
          )}

          {/* Lookup result summary */}
          {searchResult && (
            <div className="p-4 bg-profit/5 border border-profit/15 rounded-lg space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-profit" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                <span className="text-sm font-medium text-profit">Property found</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                <LookupField label="Address" value={searchResult.geocode?.matchedAddress} />
                <LookupField label="County" value={searchResult.geocode?.county} />
                <LookupField label="Parcel #" value={searchResult.parcel?.parcelNumber || searchResult.parcel?.stateParcelNumber} />
                {searchResult.parcel?.assessedValue && (
                  <LookupField label="Assessed Value" value={`$${Number(searchResult.parcel.assessedValue).toLocaleString()}`} />
                )}
                {searchResult.parcel?.yearBuilt && (
                  <LookupField label="Year Built" value={searchResult.parcel.yearBuilt} />
                )}
              </div>
              {searchResult.zoning?.rawZone && (() => {
                const match = matchZoneCode(searchResult.zoning.rawZone);
                if (!match.matched) {
                  return (
                    <div className="mt-2 p-2 bg-accent/10 border border-accent/20 rounded text-xs text-sand-700">
                      <span className="font-semibold text-accent">Zoning not auto-matched:</span> &ldquo;{searchResult.zoning.rawZone}&rdquo; — select the district manually below.
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-sand-200" />

          {/* Calculator inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="input-label">Lot Area (SF)</label>
              <input
                type="number"
                value={lotArea || ""}
                onChange={(e) => onLotAreaChange(Number(e.target.value) || 0)}
                onKeyDown={handleCalcKeyDown}
                className="input-field font-mono"
                placeholder="e.g. 5000"
              />
            </div>
            <div>
              <label className="input-label">Zoning District</label>
              <select
                value={districtId}
                onChange={(e) => onDistrictChange(e.target.value)}
                onKeyDown={handleCalcKeyDown}
                className="input-field"
              >
                <option value="">— Select district —</option>
                <optgroup label="Ratio-Based (D-6+)">
                  {ratioDistricts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </optgroup>
                <optgroup label="Lot-Based (D-A through D-5)">
                  {DISTRICTS.filter((d) => d.far === null && d.id !== "mu" && d.id !== "d11").map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </optgroup>
                <optgroup label="Other">
                  {DISTRICTS.filter((d) => d.id === "mu" || d.id === "d11").map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </optgroup>
              </select>
            </div>
            <div>
              <label className="input-label">Stories</label>
              <input
                type="number" min={1} max={30}
                value={stories || ""}
                onChange={(e) => onStoriesChange(Number(e.target.value) || 0)}
                onKeyDown={handleCalcKeyDown}
                className="input-field font-mono"
                placeholder="e.g. 2"
              />
            </div>
          </div>

          {district && (
            <div className="p-3 bg-sand-50 rounded-lg flex flex-wrap items-center gap-3 text-sm">
              <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: CATEGORY_META[district.category].bg, color: CATEGORY_META[district.category].color }}>
                {CATEGORY_META[district.category].label}
              </span>
              <span className="text-sand-600">{district.description}</span>
            </div>
          )}

          {district && (
            <div className="flex flex-wrap gap-3 text-xs font-medium">
              <UseTag label="Duplex" allowed={district.duplex} />
              <UseTag label="Triplex" allowed={district.triplex} />
              <UseTag label="Fourplex" allowed={district.fourplex} />
              <UseTag label="Multi-Family" allowed={district.multifamily} />
              <UseTag label="ADU" allowed={district.adu} />
            </div>
          )}

          <button onClick={handleCalculate} disabled={!districtId} className="btn-primary w-full py-3 text-base">
            Calculate Max Units
          </button>

          {/* Results inline */}
          {calcResult && (
            <>
              <div className="border-t border-sand-200" />

              <div className="flex items-center justify-between">
                <h3 className="font-display text-base">Unit Analysis</h3>
                <button onClick={handleApply} className="btn-accent btn-sm">
                  Apply {calcResult.maxUnits} units → Financial Analysis
                </button>
              </div>

              <div className="text-center py-6 rounded-xl bg-sand-50 border border-sand-100">
                <div className="text-xs font-mono text-sand-500 tracking-wider mb-2">ESTIMATED MAX UNITS</div>
                <div className={`font-mono text-6xl font-bold leading-none ${calcResult.maxUnits > 0 ? "text-profit" : "text-loss"}`}>
                  {calcResult.maxUnits}
                </div>
                <div className="text-xs font-mono text-accent mt-2">binding constraint: {calcResult.bindingConstraint}</div>
              </div>

              {calcResult.bindingConstraint !== "lot-based" && calcResult.bindingConstraint !== "not-permitted" && (
                <div className="rounded-lg border border-sand-200 overflow-hidden">
                  <CalcRow label="Applicable FAR" value={calcResult.applicableFAR.toFixed(2)} />
                  <CalcRow label="Max Floor Area (FAR × Lot)" value={`${calcResult.maxFloorArea.toLocaleString()} SF`} />
                  <CalcRow label="Max Footprint (FAR)" value={`${calcResult.maxFootprintByFAR.toLocaleString()} SF`} />
                  <CalcRow label="Max Footprint (LSR)" value={`${calcResult.maxFootprintByLSR > 0 ? calcResult.maxFootprintByLSR.toLocaleString() : "N/A"} SF`} />
                  <CalcRow label="Effective Floor Area" value={`${calcResult.effectiveFloorArea.toLocaleString()} SF`} />
                  <CalcRow label="Min Unit Size" value="660 SF" />
                  <CalcRow label="Max Units" value={calcResult.maxUnits.toString()} highlight />
                  {calcResult.parking !== null && (
                    <CalcRow label={`Parking (TCR ${calcResult.district.tcr})`} value={`${calcResult.parking} spaces (~${calcResult.parkingSF?.toLocaleString()} SF)`} />
                  )}
                </div>
              )}

              {calcResult.district?.tieredFAR && (
                <div className="p-4 bg-sand-50 rounded-lg">
                  <div className="text-xs font-mono text-sand-500 tracking-wider mb-2">FAR TIERS — {calcResult.district.name}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
                    <FARTier label="1-3 fl" value={calcResult.district.tieredFAR.floors1to3} active={stories <= 3} />
                    <FARTier label="4-5 fl" value={calcResult.district.tieredFAR.floors4to5} active={stories >= 4 && stories <= 5} />
                    {calcResult.district.tieredFAR.floors6to11 !== undefined && <FARTier label="6-11 fl" value={calcResult.district.tieredFAR.floors6to11} active={stories >= 6 && stories <= 11} />}
                    {calcResult.district.tieredFAR.floors12to23 !== undefined && <FARTier label="12-23 fl" value={calcResult.district.tieredFAR.floors12to23} active={stories >= 12 && stories <= 23} />}
                    {calcResult.district.tieredFAR.floors24plus !== undefined && <FARTier label="24+ fl" value={calcResult.district.tieredFAR.floors24plus} active={stories >= 24} />}
                  </div>
                </div>
              )}

              {calcResult.warnings.length > 0 && (
                <div className="space-y-2">
                  {calcResult.warnings.map((w, i) => (
                    <div key={i} className="p-3 bg-accent/5 border border-accent/15 rounded-lg text-sm text-sand-700">
                      <span className="font-semibold text-accent">Note:</span> {w}
                    </div>
                  ))}
                </div>
              )}

              {calcResult.district?.notes && (
                <div className="p-3 bg-sand-50 rounded-lg text-xs text-sand-600 leading-relaxed">
                  <span className="font-semibold text-sand-700">District notes:</span> {calcResult.district.notes}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* District Reference */}
      {showDistrictRef && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-display text-lg">District Quick Reference</h2>
          </div>
          <div className="card-body space-y-2">
            {DISTRICTS.map((d) => {
              const cat = CATEGORY_META[d.category];
              const isExpanded = expandedDistrict === d.id;
              return (
                <div key={d.id} className="border border-sand-200 rounded-lg overflow-hidden cursor-pointer hover:border-sand-300 transition-colors" style={{ borderLeftColor: cat.color, borderLeftWidth: 3 }}>
                  <div className="p-3 flex items-center justify-between" onClick={() => setExpandedDistrict(isExpanded ? null : d.id)}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-sand-800">{d.name}</span>
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: cat.bg, color: cat.color }}>{cat.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className={d.duplex ? "text-profit" : "text-loss"}>{d.duplex ? "✓" : "✗"} Dup</span>
                      <span className={d.fourplex ? "text-profit" : "text-loss"}>{d.fourplex ? "✓" : "✗"} 4plex</span>
                      {d.far !== null && <span className="font-mono text-sand-600">FAR {d.far}</span>}
                      <span className="text-sand-400">{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-3 pb-3 text-xs text-sand-600 space-y-2 border-t border-sand-100 pt-2">
                      <p>{d.description}</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono">
                        <span className="text-sand-500">Min Lot:</span><span>{d.minLot}</span>
                        <span className="text-sand-500">Duplex Lot:</span><span>{d.minLotDuplex}</span>
                        <span className="text-sand-500">Max Height:</span><span>{d.maxHeight}</span>
                        <span className="text-sand-500">Density:</span><span>{d.density}</span>
                        {d.far !== null && <><span className="text-sand-500">FAR:</span><span>{d.far}</span></>}
                        {d.lsr !== null && <><span className="text-sand-500">LSR:</span><span>{d.lsr}</span></>}
                        {d.tcr !== null && <><span className="text-sand-500">TCR:</span><span>{d.tcr}</span></>}
                      </div>
                      {d.notes && <p className="text-sand-500 italic">{d.notes}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LookupField({ label, value }: { label: string; value: any }) {
  if (!value) return null;
  return <div><span className="text-xs text-sand-500">{label}: </span><span className="font-mono text-sand-800">{value}</span></div>;
}

function UseTag({ label, allowed }: { label: string; allowed: boolean }) {
  return <span className={`px-2 py-1 rounded text-xs font-medium ${allowed ? "bg-profit/10 text-profit" : "bg-sand-100 text-sand-400 line-through"}`}>{allowed ? "✓" : "✗"} {label}</span>;
}

function CalcRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex justify-between items-baseline px-4 py-2.5 border-b border-sand-100 last:border-0 ${highlight ? "bg-profit/5" : ""}`}>
      <span className="font-mono text-xs text-sand-600">{label}</span>
      <span className={`font-mono text-sm ${highlight ? "text-profit font-bold" : "text-sand-800"}`}>{value}</span>
    </div>
  );
}

function FARTier({ label, value, active }: { label: string; value: number; active: boolean }) {
  return (
    <div className={`text-center p-2 rounded ${active ? "bg-accent/10 border border-accent/20" : "bg-white border border-sand-100"}`}>
      <div className={`font-mono text-lg font-semibold ${active ? "text-accent-dark" : "text-sand-500"}`}>{value}</div>
      <div className="text-xs text-sand-500">{label}</div>
    </div>
  );
}
