"use client";

import { useEffect, useState } from "react";
import { listAnalyses, createAnalysis, deleteAnalysis, duplicateAnalysis } from "@/lib/db";
import { createDefaultAnalysis } from "@/lib/types";
import { calculate } from "@/lib/calculator";
import { fmt, pct, valueColor } from "@/lib/format";
import type { Analysis } from "@/lib/types";

export default function HomePage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      const data = await listAnalyses();
      setAnalyses(data);
      setError(null);
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleNew(start: string) {
    try {
      const a = await createAnalysis(createDefaultAnalysis());
      window.location.href = `/analysis/${a.id}?start=${start}`;
    } catch (e: any) { setError(e.message); }
  }

  async function handleDuplicate(id: string) {
    try {
      const a = await duplicateAnalysis(id);
      window.location.href = `/analysis/${a.id}`;
    } catch (e: any) { setError(e.message); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await deleteAnalysis(id);
      setAnalyses((p) => p.filter((a) => a.id !== id));
    } catch (e: any) { setError(e.message); }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-sand-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-sand-900">Indy Property Analyzer</h1>
            <p className="text-sm text-sand-500 mt-0.5">Zoning feasibility → financial analysis</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleNew("zoning")} className="btn-accent">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>
              Zoning Check
            </button>
            <button onClick={() => handleNew("financial")} className="btn-secondary">Financial Only</button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-loss/10 border border-loss/20 rounded-lg text-loss text-sm">
            {error}<button onClick={() => setError(null)} className="ml-3 underline">dismiss</button>
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 border-2 border-sand-300 border-t-sand-600 rounded-full animate-spin" />
          </div>
        ) : analyses.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-sand-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-sand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
            </div>
            <h2 className="font-display text-xl text-sand-700 mb-2">No analyses yet</h2>
            <p className="text-sand-500 mb-8 max-w-md mx-auto">Start with a zoning check to see how many units a lot can support, then run the financials.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => handleNew("zoning")} className="btn-accent">Start with Zoning Check</button>
              <button onClick={() => handleNew("financial")} className="btn-secondary">Jump to Financial Analysis</button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {analyses.map((a) => {
              const r = calculate(a);
              return (
                <a key={a.id} href={`/analysis/${a.id}`} className="card hover:shadow-md hover:border-sand-300 transition-all group">
                  <div className="p-5 flex items-start gap-5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-display text-lg text-sand-900 truncate group-hover:text-accent-dark transition-colors">{a.name}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-sand-100 text-sand-600 font-medium whitespace-nowrap">
                          {a.property_type === "ground_up" ? "Ground-Up" : a.property_type.toUpperCase()}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-sand-100 text-sand-500 font-mono whitespace-nowrap">{a.num_units}u</span>
                      </div>
                      {a.address && <p className="text-sm text-sand-500 truncate">{a.address}{a.city ? `, ${a.city}` : ""} {a.zip}</p>}
                      <p className="text-xs text-sand-400 mt-1">Updated {new Date(a.updated_at).toLocaleDateString()}</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-6 text-right shrink-0">
                      <div><div className="font-mono text-sm font-medium">{fmt(r.totalProjectCost, { compact: true })}</div><div className="text-xs text-sand-400">Cost</div></div>
                      <div><div className={`font-mono text-sm font-medium ${valueColor(r.monthlyCashFlow)}`}>{fmt(r.monthlyCashFlow)}/mo</div><div className="text-xs text-sand-400">CF</div></div>
                      <div><div className={`font-mono text-sm font-medium ${valueColor(r.cashOnCash)}`}>{pct(r.cashOnCash)}</div><div className="text-xs text-sand-400">CoC</div></div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.preventDefault(); handleDuplicate(a.id); }} className="p-2 rounded-lg hover:bg-sand-100 text-sand-400 hover:text-sand-600" title="Duplicate">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.5a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>
                      </button>
                      <button onClick={(e) => { e.preventDefault(); handleDelete(a.id, a.name); }} className="p-2 rounded-lg hover:bg-loss/10 text-sand-400 hover:text-loss" title="Delete">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                      </button>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
