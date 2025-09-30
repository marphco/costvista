export default function MethodologyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-100">
      <div className="max-w-3xl mx-auto p-6 space-y-5">
        <h1 className="text-2xl font-semibold">Methodology & limits</h1>
        <p className="text-slate-300">
          CostVista normalizes Transparency-in-Coverage machine-readable files (MRFs) and produces code-level summaries.
        </p>
        <ul className="list-disc ml-6 space-y-2 text-slate-300">
          <li><b>Scope:</b> in-network negotiated rates by CPT/HCPCS and similar billing codes.</li>
          <li><b>Normalization:</b> header synonyms → canonical fields; numeric coercion; per-code aggregation.</li>
          <li><b>Stats:</b> Min, Median, P25–P75, Max; Top-3 cheapest providers.</li>
          <li><b>Freshness:</b> payers usually update monthly; UI/PDF show source and fetch time.</li>
          <li><b>Privacy:</b> no PHI in demo/product flows.</li>
        </ul>
        <h2 className="text-xl font-semibold mt-6">Limits</h2>
        <ul className="list-disc ml-6 space-y-2 text-slate-300">
          <li>No copay/deductible/accumulators; plan design varies by employer.</li>
          <li>No outcomes/quality scores by default.</li>
          <li>Provider names may vary across files; dedup best-effort.</li>
        </ul>
      </div>
    </main>
  );
}
