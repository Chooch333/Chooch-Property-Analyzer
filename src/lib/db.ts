import { getSupabase } from "./supabase";
import type { Analysis, CountyDefaults } from "./types";

const supabase = () => getSupabase();

// ---- Analyses CRUD ----

export async function listAnalyses(): Promise<Analysis[]> {
  const { data, error } = await supabase()
    .from("analyses")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeAnalysis);
}

export async function getAnalysis(id: string): Promise<Analysis | null> {
  const { data, error } = await supabase()
    .from("analyses")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw error;
  }
  return normalizeAnalysis(data);
}

export async function createAnalysis(
  analysis: Omit<Analysis, "id" | "created_at" | "updated_at">
): Promise<Analysis> {
  const { data, error } = await supabase()
    .from("analyses")
    .insert(analysis)
    .select()
    .single();
  if (error) throw error;
  return normalizeAnalysis(data);
}

export async function updateAnalysis(
  id: string,
  updates: Partial<Omit<Analysis, "id" | "created_at" | "updated_at">>
): Promise<Analysis> {
  const { data, error } = await supabase()
    .from("analyses")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return normalizeAnalysis(data);
}

export async function deleteAnalysis(id: string): Promise<void> {
  const { error } = await supabase().from("analyses").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateAnalysis(id: string): Promise<Analysis> {
  const original = await getAnalysis(id);
  if (!original) throw new Error("Analysis not found");
  const { id: _id, created_at, updated_at, ...rest } = original;
  return createAnalysis({ ...rest, name: `${rest.name} (Copy)` });
}

// ---- County Defaults ----

export async function getCountyDefaults(county: string): Promise<CountyDefaults | null> {
  const { data, error } = await supabase()
    .from("county_defaults")
    .select("*")
    .ilike("county", county)
    .single();
  if (error) return null;
  return data;
}

export async function listCounties(): Promise<CountyDefaults[]> {
  const { data, error } = await supabase()
    .from("county_defaults")
    .select("*")
    .order("county");
  if (error) throw error;
  return data || [];
}

// ---- Helpers ----

function normalizeAnalysis(row: any): Analysis {
  return {
    ...row,
    units: typeof row.units === "string" ? JSON.parse(row.units) : row.units || [],
    tags: row.tags || [],
  };
}
