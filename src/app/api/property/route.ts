import { NextRequest, NextResponse } from "next/server";

/**
 * Property lookup endpoint.
 *
 * Flow:
 * 1. Geocode address via Census Geocoder (free, no key)
 * 2. Spatial query IndyGIS Parcel layer for lot area, parcel number, assessed value
 * 3. Spatial query IndyGIS Zoning layer for zoning district classification
 *
 * GET /api/property?address=425+N+Arsenal+Ave+Indianapolis+IN+46201
 */

const INDY_GIS_BASE = "https://xmaps.indy.gov/arcgis/rest/services";
const GIS_SERVER_BASE = "https://gis.indy.gov/server/rest/services";

// IndyGIS layer endpoints
const PARCEL_LAYER = `${GIS_SERVER_BASE}/MapIndy/Zoning/MapServer/0`; // Unit Address Points
const ZONING_LAYER = `${GIS_SERVER_BASE}/MapIndy/Zoning/MapServer/6`; // Zoning polygons
const OPEN_DATA_PARCELS = `${INDY_GIS_BASE}/OpenData/OpenData_Boundaries/MapServer/3`; // Parcels with geometry

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address") || "";

  if (!address.trim()) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 });
  }

  try {
    // ---- Step 1: Geocode ----
    const geocodeResult = await geocode(address);
    if (!geocodeResult) {
      return NextResponse.json({ error: "Address not found. Try including city and state.", found: false });
    }

    const { lat, lng, matchedAddress, county } = geocodeResult;

    // ---- Step 2 & 3: Parallel spatial queries to IndyGIS ----
    const [parcelResult, zoningResult] = await Promise.allSettled([
      queryParcelByPoint(lat, lng),
      queryZoningByPoint(lat, lng),
    ]);

    const parcel = parcelResult.status === "fulfilled" ? parcelResult.value : null;
    const zoning = zoningResult.status === "fulfilled" ? zoningResult.value : null;

    return NextResponse.json({
      found: true,
      geocode: {
        matchedAddress,
        lat,
        lng,
        county,
      },
      parcel: parcel || null,
      zoning: zoning || null,
    });
  } catch (error: any) {
    console.error("Property lookup error:", error);
    return NextResponse.json({ error: "Lookup failed: " + (error.message || "Unknown error") }, { status: 500 });
  }
}

// ============================================================
// Geocoding (Census Geocoder — free, no API key)
// ============================================================

async function geocode(address: string) {
  const query = encodeURIComponent(address);
  const url = `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${query}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await res.json();

  const match = data?.result?.addressMatches?.[0];
  if (!match) return null;

  const countyGeo = match.geographies?.["Counties"]?.[0];

  return {
    lat: match.coordinates.y as number,
    lng: match.coordinates.x as number,
    matchedAddress: match.matchedAddress as string,
    county: (countyGeo?.NAME || "") as string,
  };
}

// ============================================================
// IndyGIS Parcel Query
// ============================================================

async function queryParcelByPoint(lat: number, lng: number) {
  // Query the OpenData Parcels layer (has geometry for area calc)
  // Use a spatial query with a small buffer point
  const geometry = JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } });

  const params = new URLSearchParams({
    geometry,
    geometryType: "esriGeometryPoint",
    spatialRel: "esriSpatialRelIntersects",
    inSR: "4326",
    outSR: "4326",
    outFields: "*",
    returnGeometry: "false",
    f: "json",
  });

  const url = `${OPEN_DATA_PARCELS}/query?${params}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await res.json();

  if (!data.features || data.features.length === 0) {
    // Fallback: try the address points layer
    return await queryAddressPointByPoint(lat, lng);
  }

  const attrs = data.features[0].attributes;

  // The parcel layer typically has SHAPE.STArea() in the native coordinate system (feet)
  // Convert to SF if available
  let lotAreaSF: number | null = null;
  const shapeArea = attrs["SHAPE.STArea()"] || attrs["SHAPE_STArea__"] || attrs["Shape__Area"] || attrs["SHAPE.AREA"] || attrs["SHAPEAREA"];
  if (shapeArea) {
    // IndyGIS uses State Plane Indiana East (feet) — SHAPE.STArea() is in sq feet
    lotAreaSF = Math.round(shapeArea);
  }

  return {
    parcelNumber: attrs["PARCEL_C"] || attrs["PARCEL_TAG"] || attrs["STATEPARCELNUMBER"] || null,
    stateParcelNumber: attrs["STATEPARCELNUMBER"] || null,
    address: attrs["FULL_STNAME"] ? `${attrs["STNUMBER"] || attrs["STNUMBER"] || ""} ${attrs["FULL_STNAME"]}`.trim() : null,
    city: attrs["CITY"] || null,
    zip: attrs["ZIPCODE"] || null,
    lotAreaSF,
    assessedValue: attrs["ASSESSED_VALUE"] || attrs["TOTAL_AV"] || attrs["AV_TOTAL"] || null,
    landValue: attrs["LAND_AV"] || attrs["AV_LAND"] || null,
    improvementValue: attrs["IMPR_AV"] || attrs["AV_IMPROV"] || null,
    yearBuilt: attrs["YEAR_BUILT"] || attrs["YR_BUILT"] || null,
    ownerName: attrs["OWNER1"] || attrs["OWN_NAME1"] || null,
    rawAttributes: attrs,
  };
}

async function queryAddressPointByPoint(lat: number, lng: number) {
  // Fallback: query address points layer with a small buffer
  const geometry = JSON.stringify({
    x: lng,
    y: lat,
    spatialReference: { wkid: 4326 },
  });

  const params = new URLSearchParams({
    geometry,
    geometryType: "esriGeometryPoint",
    spatialRel: "esriSpatialRelIntersects",
    distance: "50",
    units: "esriFeet",
    inSR: "4326",
    outSR: "4326",
    outFields: "*",
    returnGeometry: "false",
    f: "json",
  });

  const url = `${PARCEL_LAYER}/query?${params}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();

    if (!data.features || data.features.length === 0) return null;

    const attrs = data.features[0].attributes;
    const shapeArea = attrs["SHAPE.STArea()"] || attrs["SHAPE_STArea__"] || attrs["Shape__Area"];

    return {
      parcelNumber: attrs["PARCEL_TAG"] || attrs["PARCEL_C"] || null,
      stateParcelNumber: attrs["STATEPARCELNUMBER"] || null,
      address: attrs["FULL_STNAME"] ? `${attrs["STNUMBER"] || ""} ${attrs["FULL_STNAME"]}`.trim() : null,
      city: attrs["CITY"] || null,
      zip: attrs["ZIPCODE"] || null,
      lotAreaSF: shapeArea ? Math.round(shapeArea) : null,
      assessedValue: null,
      landValue: null,
      improvementValue: null,
      yearBuilt: null,
      ownerName: null,
      rawAttributes: attrs,
    };
  } catch {
    return null;
  }
}

// ============================================================
// IndyGIS Zoning Query
// ============================================================

async function queryZoningByPoint(lat: number, lng: number) {
  const geometry = JSON.stringify({
    x: lng,
    y: lat,
    spatialReference: { wkid: 4326 },
  });

  const params = new URLSearchParams({
    geometry,
    geometryType: "esriGeometryPoint",
    spatialRel: "esriSpatialRelIntersects",
    inSR: "4326",
    outSR: "4326",
    outFields: "*",
    returnGeometry: "false",
    f: "json",
  });

  const url = `${ZONING_LAYER}/query?${params}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await res.json();

  if (!data.features || data.features.length === 0) return null;

  const attrs = data.features[0].attributes;

  // The zoning layer typically has a ZONE or ZONING field with the district code
  const rawZone = attrs["ZONE"] || attrs["ZONING"] || attrs["ZONE_CODE"] || attrs["ZONE_CLASS"]
    || attrs["ZONE_TYPE"] || attrs["ZONING_CLA"] || attrs["CLASSIFICATION"] || attrs["Label"] || null;

  return {
    rawZone,
    zoningDescription: attrs["ZONE_DESC"] || attrs["DESCRIPTION"] || attrs["DESC_"] || null,
    overlay: attrs["OVERLAY"] || attrs["SECONDARY"] || null,
    rawAttributes: attrs,
  };
}
