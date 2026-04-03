/**
 * Indianapolis Zoning Data & Calculator Engine
 *
 * SOURCE: Consolidated Zoning & Subdivision Ordinance of Indianapolis–Marion County,
 * effective January 8, 2025.
 *
 * Tables referenced:
 * - Table 743-1 (Use Table)
 * - Table 742.103.03 (Residential Building Type Standards)
 * - Table 744-201-1 (Dimensional Standards D-A through D-5II/D-8)
 * - Table 744-201-2 (Dimensional Standards D-6 through D-11)
 * - Ch. 742, Art. I, Sec. 03 (Dwelling District descriptions)
 *
 * STANDING RULE: If the ordinance is amended, Charles will upload updated sections.
 * Do NOT fall back to web searches for zoning data.
 */

// ============================================================
// Types
// ============================================================

export type DistrictCategory = "single-family" | "low-density" | "multi-family" | "high-density" | "mixed-use";

export interface TieredFAR {
  floors1to3: number;
  floors4to5: number;
  floors6to11?: number;
  floors12to23?: number;
  floors24plus?: number;
}

export interface ZoningDistrict {
  id: string;
  name: string;
  category: DistrictCategory;
  description: string;

  // Permitted uses
  duplex: boolean;
  triplex: boolean;
  fourplex: boolean;
  multifamily: boolean;
  adu: boolean;
  aduNote: string;

  // Dimensional standards
  far: number | null; // Base FAR (1-3 floors). null = not ratio-based.
  tieredFAR: TieredFAR | null; // Full tiered FAR if applicable.
  lsr: number | null;
  maxHeight: string;
  minLot: string;
  minLotDuplex: string;
  density: string;
  tcr: number | null; // Total Car Ratio

  // Meta
  confidence: "confirmed" | "baseline" | "derived";
  notes: string;
}

export interface ZoningCalcInput {
  lotArea: number; // SF
  districtId: string;
  stories: number;
  minUnitSize?: number; // Default 660
}

export interface ZoningCalcResult {
  district: ZoningDistrict;
  applicableFAR: number;
  maxFloorArea: number;
  maxFootprintByFAR: number;
  livabilityNeeded: number;
  maxFootprintByLSR: number;
  bindingFootprint: number;
  effectiveFloorArea: number;
  minUnitSize: number;
  maxUnits: number;
  bindingConstraint: "FAR" | "LSR" | "lot-based" | "not-permitted";
  parking: number | null;
  parkingSF: number | null;
  warnings: string[];
}

// ============================================================
// District Data
// ============================================================

export const DISTRICTS: ZoningDistrict[] = [
  {
    id: "da-ds-d1-d2", name: "D-A, D-S, D-1, D-2", category: "single-family",
    description: "Single-family residential. Lowest density. D-A is agricultural (3 ac min), D-S is suburban (1 ac), D-1 (24K SF), D-2 (15K SF). No duplex permitted.",
    duplex: false, triplex: false, fourplex: false, multifamily: false,
    adu: true, aduNote: "ADU permitted as accessory use in all four districts per Table 743-1. Owner-occupancy required. Max 750 SF.",
    far: null, tieredFAR: null, lsr: null, maxHeight: "35 ft / 2.5 stories",
    minLot: "D-A: 3 acres; D-S: 43,560 SF; D-1: 24,000 SF; D-2: 15,000 SF",
    minLotDuplex: "N/A — duplex not permitted",
    density: "1 unit + 1 ADU max", tcr: null,
    confidence: "confirmed",
    notes: "D-2 does NOT permit duplexes. The Jan 2025 Use Table (Table 743-1) shows Two-Family Dwelling as blank (prohibited) for D-A, D-S, D-1, and D-2. D-2 includes dimensional standards for two-family lots (20K SF / 120 ft width) in Table 744-201-1, but the use itself is not permitted per the Use Table."
  },
  {
    id: "d3", name: "D-3", category: "low-density",
    description: "Low-density residential. SFR on 10K SF min. First district allowing duplexes by right.",
    duplex: true, triplex: false, fourplex: false, multifamily: false,
    adu: true, aduNote: "ADU permitted as accessory use per Table 743-1.",
    far: null, tieredFAR: null, lsr: null, maxHeight: "35 ft / 2.5 stories",
    minLot: "SFR: 10,000 SF / 80 ft width",
    minLotDuplex: "15,000 SF / 105 ft width",
    density: "Duplex max. Most lots won't meet 15K/105ft for duplex.", tcr: null,
    confidence: "confirmed",
    notes: "The 105 ft minimum lot width for duplexes is extremely restrictive. Most urban D-3 lots are 40-60 ft wide — you'd need a development standards variance from BZA."
  },
  {
    id: "d4", name: "D-4", category: "low-density",
    description: "Moderate single-family. SFR on 7,200 SF min. Duplex permitted with standards.",
    duplex: true, triplex: false, fourplex: false, multifamily: false,
    adu: true, aduNote: "ADU permitted as accessory use per Table 743-1.",
    far: null, tieredFAR: null, lsr: null, maxHeight: "35 ft / 2.5 stories",
    minLot: "SFR: 7,200 SF / 60 ft width",
    minLotDuplex: "10,000 SF / 90 ft width",
    density: "Duplex max. 90 ft width requirement is the binding constraint on most lots.", tcr: null,
    confidence: "confirmed",
    notes: "BZA cases show developers getting width variances in D-4. The use (duplex) is by right per Table 743-1; the lot standard often needs a variance."
  },
  {
    id: "d5", name: "D-5 / D-5II", category: "low-density",
    description: "D-5: SFR on 5K SF, duplex on 7,200 SF. D-5II: SFR on 2,800 SF, duplex on 5K SF. D-5II also permits SFR Attached (townhomes).",
    duplex: true, triplex: false, fourplex: false, multifamily: false,
    adu: true, aduNote: "ADU permitted as accessory use in both D-5 and D-5II per Table 743-1.",
    far: null, tieredFAR: null, lsr: null, maxHeight: "35 ft / 2.5 stories",
    minLot: "D-5: SFR 5,000 SF / 50 ft; D-5II: SFR 2,800 SF / 28 ft",
    minLotDuplex: "D-5: 7,200 SF / 60 ft; D-5II: 5,000 SF / 50 ft",
    density: "Duplex max. D-5II is most feasible for duplex on smaller urban lots.", tcr: null,
    confidence: "confirmed",
    notes: "D-5II is a sweet spot for duplex investment — 5,000 SF lot at 50 ft width is achievable on many urban parcels."
  },
  {
    id: "d6", name: "D-6 / D-6II", category: "multi-family",
    description: "First district allowing triplex, fourplex, and multi-family by right. No SFR Detached. Suburban multi-family.",
    duplex: true, triplex: true, fourplex: true, multifamily: true,
    adu: false, aduNote: "ADU NOT permitted in D-6 or D-6II — SFR Detached is not a permitted use.",
    far: 0.40, tieredFAR: { floors1to3: 0.40, floors4to5: 0.40 }, lsr: 1.80,
    maxHeight: "45 ft (primary) / 35 ft (transitional)",
    minLot: "No min lot area — project-based. 150 ft min street frontage. 30 ft perimeter yard.",
    minLotDuplex: "N/A — density controlled by ratios",
    density: "D-6: 6-9 du/ac typical; D-6II: 9-12 du/ac typical (FAR 0.55, LSR 1.30).", tcr: null,
    confidence: "confirmed",
    notes: "D-6: FAR 0.40, LSR 1.80. D-6II: FAR 0.55, LSR 1.30. Both have 45 ft max primary height, 35 ft transitional. FAR 0.40 is restrictive — on a 5,000 SF lot, max building area is only 2,000 SF."
  },
  {
    id: "d7", name: "D-7", category: "multi-family",
    description: "Medium density multi-family. No SFR Detached. Transition between suburban and urban settings.",
    duplex: true, triplex: true, fourplex: true, multifamily: true,
    adu: false, aduNote: "ADU NOT permitted in D-7 — SFR Detached is not a permitted use.",
    far: 0.70, tieredFAR: { floors1to3: 0.70, floors4to5: 0.70 }, lsr: 0.95,
    maxHeight: "56 ft (primary) / 40 ft (transitional)",
    minLot: "No minimum lot area — project-based. 100 ft min street frontage. 20 ft perimeter yard.",
    minLotDuplex: "N/A",
    density: "12-15 du/ac typical.", tcr: null,
    confidence: "confirmed",
    notes: "FAR 0.70 (same 1-3 and 4-5 floors), LSR 0.95. Significantly more permissive than D-6."
  },
  {
    id: "d8", name: "D-8", category: "multi-family",
    description: "Urban mixed-density. Allows ALL residential types: SFR, duplex, triplex, fourplex, multi-family, live-work. The workhorse urban infill zone.",
    duplex: true, triplex: true, fourplex: true, multifamily: true,
    adu: true, aduNote: "ADU permitted. D-8 is the only multi-family district (D-6+) that allows both SFR and ADU.",
    far: 0.60, tieredFAR: { floors1to3: 0.60, floors4to5: 0.80 }, lsr: 0.66,
    maxHeight: "Per building type (Table 742.103.03); 25 ft accessory max",
    minLot: "No minimum lot area — project-based. 50 ft min project frontage.",
    minLotDuplex: "N/A",
    density: "No hard unit cap. Controlled by FAR, LSR, min floor area (660 SF/unit), setbacks, and parking.", tcr: 2.0,
    confidence: "confirmed",
    notes: "D-8 is the most common rezone target for urban infill. FAR 0.60 (1-3 floors), FAR 0.80 (4-5 floors). LSR 0.66. Min floor area 660 SF. Building types: up to Small Apartment (3-12 units). Medium/Large Apt NOT permitted."
  },
  {
    id: "d9", name: "D-9", category: "high-density",
    description: "Higher density multi-family. No SFR Detached. Small- and moderate-scale multi-unit. Transitions to commercial/transit.",
    duplex: true, triplex: true, fourplex: true, multifamily: true,
    adu: false, aduNote: "ADU NOT permitted — SFR Detached not permitted.",
    far: 0.50,
    tieredFAR: { floors1to3: 0.50, floors4to5: 0.80, floors6to11: 1.50, floors12to23: 2.20, floors24plus: 2.20 },
    lsr: 0.75,
    maxHeight: "Per building type (Table 742.103.03); 25 ft accessory max",
    minLot: "No minimum — building-type-based. 100 ft min project frontage. 20 ft perimeter yard.",
    minLotDuplex: "N/A",
    density: "High density. Building types include Small Apt (3-12), Medium Apt (13-50).", tcr: null,
    confidence: "confirmed",
    notes: "Tiered FAR: 0.50 (1-3), 0.80 (4-5), 1.50 (6-11), 2.20 (12-23), 2.20 (24+). LSR 0.75. D-9 at 1-3 floors is MORE restrictive than D-8 (FAR 0.50 vs 0.60). Payoff at 6+ floors with FAR 1.50."
  },
  {
    id: "d10", name: "D-10", category: "high-density",
    description: "Highest density residential. No SFR Detached. Moderate- and large-scale multi-unit. Urban centers and corridors.",
    duplex: true, triplex: true, fourplex: true, multifamily: true,
    adu: false, aduNote: "ADU NOT permitted.",
    far: 0.60,
    tieredFAR: { floors1to3: 0.60, floors4to5: 0.80, floors6to11: 1.50, floors12to23: 3.00, floors24plus: 3.20 },
    lsr: 0.66,
    maxHeight: "Per building type (Table 742.103.03); up to 150 ft / 12 stories; 25 ft accessory",
    minLot: "No minimum — building-type-based. 150 ft min project frontage. 20 ft perimeter yard.",
    minLotDuplex: "N/A",
    density: "Very high density. Building types include Large Apt (51+ units, ≥1 acre).", tcr: null,
    confidence: "confirmed",
    notes: "Tiered FAR: 0.60 (1-3), 0.80 (4-5), 1.50 (6-11), 3.00 (12-23), 3.20 (24+). LSR 0.66. D-10 is the ONLY dwelling district permitting Large Apartment."
  },
  {
    id: "d11", name: "D-11", category: "high-density",
    description: "Mobile home community district. Also permits Multifamily (5+). No SFR, duplex, triplex, or fourplex.",
    duplex: false, triplex: false, fourplex: false, multifamily: true,
    adu: false, aduNote: "ADU not permitted.",
    far: null, tieredFAR: null, lsr: null, maxHeight: "N/A",
    minLot: "N/A", minLotDuplex: "N/A",
    density: "Mobile home + multifamily only", tcr: null,
    confidence: "confirmed",
    notes: "SFR/duplex/triplex/fourplex all prohibited. Only Multifamily (5+) and Mobile Dwelling permitted."
  },
  {
    id: "mu", name: "MU-2, MU-3", category: "mixed-use",
    description: "Mixed-use districts. Residential above ground-floor commercial. MU-2 is neighborhood/corridor, MU-3 is village scale.",
    duplex: true, triplex: true, fourplex: true, multifamily: true,
    adu: true, aduNote: "ADU permitted as accessory in both MU-2 and MU-3 per Table 743-1.",
    far: null, tieredFAR: null, lsr: null, maxHeight: "Varies by context",
    minLot: "Varies", minLotDuplex: "N/A",
    density: "Varies — typically higher density. Check specific MU district standards.", tcr: null,
    confidence: "confirmed",
    notes: "All residential types permitted. Powerful for mixed-use infill but less common in typical residential search."
  },
];

// ============================================================
// Definitions (for tooltips / help)
// ============================================================

export const DEFINITIONS: Record<string, { term: string; short: string; definition: string; formula: string }> = {
  far: {
    term: "Floor Area Ratio (FAR)",
    short: "FAR",
    definition: "Total floor area of all above-grade stories divided by the lot area. A FAR of 0.60 on a 5,000 SF lot = 3,000 SF maximum building area across all floors.",
    formula: "FAR = Total Floor Area ÷ Lot Area",
  },
  lsr: {
    term: "Livability Space Ratio (LSR)",
    short: "LSR",
    definition: "Livability space divided by total floor area. Livability space = uncovered open space + usable roof area + covered open space. Higher LSR = more open space required per SF of building.",
    formula: "LSR = Livability Space ÷ Total Floor Area",
  },
  tcr: {
    term: "Total Car Ratio (TCR)",
    short: "TCR",
    definition: "Required parking spaces per dwelling unit. A TCR of 2.0 means 2 spaces per unit.",
    formula: "Required Spaces = TCR × Number of Units",
  },
};

// ============================================================
// Calculator
// ============================================================

/**
 * Get the applicable FAR for a district at a given story count.
 */
export function getApplicableFAR(district: ZoningDistrict, stories: number): number | null {
  if (!district.tieredFAR) return district.far;
  const t = district.tieredFAR;
  if (stories <= 3) return t.floors1to3;
  if (stories <= 5) return t.floors4to5;
  if (stories <= 11) return t.floors6to11 ?? t.floors4to5;
  if (stories <= 23) return t.floors12to23 ?? t.floors6to11 ?? t.floors4to5;
  return t.floors24plus ?? t.floors12to23 ?? t.floors6to11 ?? t.floors4to5;
}

/**
 * Calculate max permitted units for a given lot + district + stories.
 */
export function calculateZoning(input: ZoningCalcInput): ZoningCalcResult | null {
  const district = DISTRICTS.find((d) => d.id === input.districtId);
  if (!district) return null;

  const minUnitSize = input.minUnitSize ?? 660;
  const warnings: string[] = [];

  // Non-ratio-based districts (D-A through D-5)
  if (!district.far && !district.tieredFAR) {
    let maxUnits = 1;
    let constraint: ZoningCalcResult["bindingConstraint"] = "lot-based";

    if (!district.duplex && !district.triplex && !district.fourplex && !district.multifamily) {
      maxUnits = 1;
      if (district.adu) {
        warnings.push("1 ADU may also be permitted (max 750 SF, owner-occupancy required).");
      }
    } else if (district.duplex && !district.triplex) {
      // Low-density duplex districts — check lot minimums
      maxUnits = 2;
      warnings.push(`Duplex requires meeting minimum lot area and width standards: ${district.minLotDuplex}.`);
    }

    return {
      district,
      applicableFAR: 0,
      maxFloorArea: 0,
      maxFootprintByFAR: 0,
      livabilityNeeded: 0,
      maxFootprintByLSR: 0,
      bindingFootprint: 0,
      effectiveFloorArea: 0,
      minUnitSize,
      maxUnits,
      bindingConstraint: constraint,
      parking: null,
      parkingSF: null,
      warnings,
    };
  }

  // Ratio-based districts (D-6+)
  const applicableFAR = getApplicableFAR(district, input.stories) ?? 0;
  const lsr = district.lsr ?? 0;

  const maxFloorArea = input.lotArea * applicableFAR;
  const maxFootprintByFAR = maxFloorArea / input.stories;

  // LSR: livability = lot - footprint (simplified), livability >= LSR * floorArea
  // So: lot - footprint >= LSR * floorArea → footprint <= lot - (LSR * floorArea)
  const livabilityNeeded = lsr * maxFloorArea;
  const maxFootprintByLSR = lsr > 0 ? input.lotArea - livabilityNeeded : Infinity;

  const bindingFootprint = Math.min(
    maxFootprintByFAR,
    maxFootprintByLSR > 0 ? maxFootprintByLSR : 0
  );
  const effectiveFloorArea = Math.min(maxFloorArea, bindingFootprint * input.stories);
  const maxUnits = Math.max(0, Math.floor(effectiveFloorArea / minUnitSize));
  const bindingConstraint: ZoningCalcResult["bindingConstraint"] =
    maxFootprintByFAR <= maxFootprintByLSR ? "FAR" : "LSR";

  // Parking
  const parking = district.tcr ? Math.ceil(maxUnits * district.tcr) : null;
  const parkingSF = parking ? parking * 170 : null;

  // Warnings
  if (maxFootprintByLSR <= 0 && lsr > 0) {
    warnings.push("LSR requirement exceeds available lot area at this FAR — building may not be feasible at this story count.");
  }
  if (parkingSF && parkingSF > input.lotArea * 0.5) {
    warnings.push(`Parking (~${parkingSF.toLocaleString()} SF) may consume more than half the lot. Consider structured parking or reduced-parking strategies.`);
  }
  if (district.id === "d8" && maxUnits > 12) {
    warnings.push("D-8 max building type is Small Apartment (3-12 units). 12+ units may require a rezone to D-9 or D-10.");
  }
  if (district.id === "d9" && maxUnits > 50) {
    warnings.push("D-9 max building type is Medium Apartment (13-50 units). 50+ units requires D-10 (Large Apartment).");
  }

  return {
    district,
    applicableFAR,
    maxFloorArea: Math.round(maxFloorArea),
    maxFootprintByFAR: Math.round(maxFootprintByFAR),
    livabilityNeeded: Math.round(livabilityNeeded),
    maxFootprintByLSR: Math.round(Math.max(0, maxFootprintByLSR)),
    bindingFootprint: Math.round(bindingFootprint),
    effectiveFloorArea: Math.round(effectiveFloorArea),
    minUnitSize,
    maxUnits,
    bindingConstraint,
    parking,
    parkingSF,
    warnings,
  };
}

// ============================================================
// Category colors for UI
// ============================================================

export const CATEGORY_META: Record<DistrictCategory, { label: string; color: string; bg: string }> = {
  "single-family": { label: "SF ONLY", color: "#b83a3a", bg: "#b83a3a15" },
  "low-density": { label: "LOW DENSITY", color: "#b07d2e", bg: "#b07d2e18" },
  "multi-family": { label: "MULTI-FAMILY", color: "#2b7a4b", bg: "#2b7a4b15" },
  "high-density": { label: "HIGH DENSITY", color: "#2d6ca8", bg: "#2d6ca815" },
  "mixed-use": { label: "MIXED USE", color: "#6b5bae", bg: "#6b5bae15" },
};
