/**
 * Maps raw IndyGIS zoning classification codes to our internal district IDs.
 *
 * IndyGIS returns codes like "D-8", "D-5II", "MU-2", etc.
 * Our district data groups some together (e.g., "D-A, D-S, D-1, D-2" → "da-ds-d1-d2").
 */

const ZONE_MAP: Record<string, string> = {
  // Single-family group
  "D-A": "da-ds-d1-d2",
  "DA": "da-ds-d1-d2",
  "D-S": "da-ds-d1-d2",
  "DS": "da-ds-d1-d2",
  "D-1": "da-ds-d1-d2",
  "D1": "da-ds-d1-d2",
  "D-2": "da-ds-d1-d2",
  "D2": "da-ds-d1-d2",

  // Low density
  "D-3": "d3",
  "D3": "d3",
  "D-4": "d4",
  "D4": "d4",
  "D-5": "d5",
  "D5": "d5",
  "D-5II": "d5",
  "D5II": "d5",

  // Multi-family
  "D-6": "d6",
  "D6": "d6",
  "D-6II": "d6",
  "D6II": "d6",
  "D-7": "d7",
  "D7": "d7",
  "D-8": "d8",
  "D8": "d8",

  // High density
  "D-9": "d9",
  "D9": "d9",
  "D-10": "d10",
  "D10": "d10",
  "D-11": "d11",
  "D11": "d11",

  // Mixed use
  "MU-2": "mu",
  "MU2": "mu",
  "MU-3": "mu",
  "MU3": "mu",
};

/**
 * Attempt to match a raw IndyGIS zone code to our district ID.
 * Returns { districtId, matched: true } or { districtId: null, matched: false, raw }.
 */
export function matchZoneCode(rawZone: string | null): {
  districtId: string | null;
  matched: boolean;
  raw: string | null;
} {
  if (!rawZone) return { districtId: null, matched: false, raw: null };

  // Clean: uppercase, trim, remove extra spaces
  const cleaned = rawZone.trim().toUpperCase().replace(/\s+/g, "");

  // Direct match
  if (ZONE_MAP[cleaned]) {
    return { districtId: ZONE_MAP[cleaned], matched: true, raw: rawZone };
  }

  // Try with dash normalization (e.g., "D 8" → "D-8")
  const dashed = cleaned.replace(/^(D|MU)\s*-?\s*/, "$1-");
  if (ZONE_MAP[dashed]) {
    return { districtId: ZONE_MAP[dashed], matched: true, raw: rawZone };
  }

  // Partial match: look for district code anywhere in the string
  for (const [code, id] of Object.entries(ZONE_MAP)) {
    if (cleaned.includes(code.replace("-", ""))) {
      return { districtId: id, matched: true, raw: rawZone };
    }
  }

  return { districtId: null, matched: false, raw: rawZone };
}
