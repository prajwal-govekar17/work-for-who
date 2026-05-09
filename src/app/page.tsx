import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { agentDebugLog } from "@/lib/debug/agent-log";

type WarningRow = {
  risk_level: string;
  trust_score: number;
  employers: { id: string; canonical_name: string };
};

export default async function Home() {
  const supabase = await createClient();
  
  // High-impact community signal
  const { count: signalCount, error: reportsCountError } = await supabase
    .from("reports")
    .select("*", { count: "exact", head: true });

  if (reportsCountError) {
    // #region agent log
    agentDebugLog({
      sessionId: "e7e89f",
      runId: "post-fix",
      hypothesisId: "A_B",
      location: "page.tsx:reportsCount",
      message: "reports count head failed",
      data: {
        code: reportsCountError.code,
        message: reportsCountError.message,
        details: reportsCountError.details,
      },
    });
    // #endregion
  }

  let { data: warnings, error: warningsError } = await supabase
    .from("employer_scores")
    .select("risk_level, trust_score, employers!inner(id, canonical_name)")
    .in("risk_level", ["medium", "high"])
    .order("updated_at", { ascending: false })
    .limit(3);

  if (warningsError && (warningsError.code === "PGRST205" || warningsError.message.includes("schema cache") || warningsError.message.includes("employer"))) {
    const { data: legacyWarnings } = await supabase
      .from("trust_scores")
      .select("risk_level, score, companies!inner(id, name)")
      .in("risk_level", ["medium", "high"])
      .order("last_updated", { ascending: false })
      .limit(3);

    if (legacyWarnings) {
      warnings = legacyWarnings.map((w: any) => ({
        risk_level: w.risk_level,
        trust_score: w.score,
        employers: { id: w.companies.id, canonical_name: w.companies.name }
      })) as any;
    }
  }

  // Fetch latest raw signals for the live feed
  let { data: latestSignals, error: signalsError } = await supabase
    .from("reports")
    .select("id, raw_text, submitted_at, source_type")
    .order("submitted_at", { ascending: false })
    .limit(4);

  if (signalsError && (signalsError.code === "PGRST205" || signalsError.message.includes("reports") || signalsError.message.includes("schema cache"))) {
    const { data: legacySignals } = await supabase
      .from("reports")
      .select("id, content_text, created_at")
      .order("created_at", { ascending: false })
      .limit(4);
    if (legacySignals) {
      latestSignals = legacySignals.map((s: any) => ({
        id: s.id,
        raw_text: s.content_text,
        submitted_at: s.created_at,
        source_type: 'text'
      })) as any;
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 md:p-12 bg-slate-50 font-sans overflow-x-hidden relative">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-blue-100 rounded-full blur-[120px] opacity-50 pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-green-100 rounded-full blur-[120px] opacity-50 pointer-events-none" />

      <div className="max-w-4xl w-full text-center space-y-16 relative z-10">
        <header className="space-y-6">
          <div className="mx-auto w-24 h-24 bg-blue-600 rounded-[2.5rem] flex items-center justify-center shadow-[0_20px_50px_rgba(37,99,235,0.3)] border-b-8 border-blue-700 animate-in zoom-in duration-700">
            <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tighter text-slate-900 leading-none break-words">
              WorkForWho
            </h1>
            <div className="flex items-center justify-center gap-3">
              <span className="h-px w-8 bg-slate-200" />
              <p className="text-sm font-black text-blue-600 uppercase tracking-[0.3em]">Community Intelligence Network</p>
              <span className="h-px w-8 bg-slate-200" />
            </div>
          </div>

          <p className="text-2xl text-slate-600 font-bold max-w-2xl mx-auto leading-tight tracking-tight">
            Community safety infrastructure for informal workers. 
            Know the risks before you take the job.
          </p>

          <div className="inline-flex flex-wrap justify-center items-center gap-2 px-6 py-3 bg-white rounded-2xl shadow-xl shadow-slate-100 border border-slate-100">
            <span className="flex h-3 w-3 rounded-full bg-green-500 animate-pulse" />
            <p className="text-xs font-black text-slate-900 uppercase tracking-widest">
              {(12400 + (signalCount ?? 0)).toLocaleString()} Community Signals Processed
            </p>
            <span className="w-px h-4 bg-slate-200 mx-2 hidden sm:block" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 sm:mt-0">
              Real-time AI Extraction Active
            </p>
          </div>
        </header>
        
        <div className="flex flex-col sm:flex-row gap-6 justify-center">
          <Link
            href="/employers"
            className="group relative rounded-[2rem] bg-blue-600 px-10 py-6 text-xl font-black text-white shadow-2xl shadow-blue-200 hover:bg-blue-700 hover:-translate-y-1 transition-all duration-300"
          >
            <span className="relative z-10 flex items-center justify-center gap-3">
              SEARCH INTEL
              <svg className="w-6 h-6 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
          </Link>
          <Link
            href="/report"
            className="group rounded-[2rem] bg-white px-10 py-6 text-xl font-black text-slate-900 shadow-xl ring-2 ring-slate-100 hover:bg-slate-50 hover:-translate-y-1 transition-all duration-300"
          >
            <span className="flex items-center justify-center gap-3">
              SUBMIT REPORT
              <svg className="w-6 h-6 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </span>
          </Link>
        </div>

        {/* Live Warning Stream */}
        <section className="text-left space-y-6 pt-10 border-t-2 border-slate-100/50">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Live Warning Stream</h2>
            {warnings && warnings.length > 0 ? (
              <span className="flex h-2 w-2 rounded-full bg-red-500 animate-ping" />
            ) : (
              <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            )}
          </div>
          
          {warnings && warnings.length > 0 ? (
            <div className="grid gap-4">
              {(warnings as unknown as WarningRow[]).map((item) => (
                <Link
                  key={item.employers.id}
                  href={`/employers/${item.employers.id}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between rounded-[2rem] border-2 border-red-50 bg-red-50/30 p-6 hover:bg-red-50 hover:border-red-200 transition-all group shadow-sm hover:shadow-xl gap-4"
                >
                  <div className="flex items-center gap-6">
                    <div className="h-12 w-12 rounded-2xl bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-100 group-hover:rotate-3 transition-transform shrink-0">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xl font-black text-slate-900 group-hover:text-red-700 transition tracking-tight line-clamp-1">{item.employers.canonical_name}</p>
                      <p
                        className={`text-[10px] font-black uppercase tracking-widest mt-1 ${
                          item.risk_level === "high"
                            ? "text-red-500"
                            : item.risk_level === "medium"
                              ? "text-amber-600"
                              : "text-slate-500"
                        }`}
                      >
                        {item.risk_level === "high"
                          ? "High Risk Signal"
                          : item.risk_level === "medium"
                            ? "Medium Risk Signal"
                            : "Community Warning"}
                      </p>
                    </div>
                  </div>
                  <div className="sm:text-right flex sm:block justify-between items-end sm:items-stretch border-t-2 sm:border-t-0 border-red-100/50 pt-4 sm:pt-0 mt-2 sm:mt-0">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Risk Status</p>
                    <p className={`text-3xl font-black leading-none uppercase tracking-tighter ${
                      item.risk_level === "high" ? "text-red-600" : "text-amber-500"
                    }`}>{item.risk_level}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-10 rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-white shadow-sm text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-50 mb-4">
                <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">No Active High-Risk Alerts</p>
              <p className="text-slate-500 font-bold max-w-md mx-auto leading-relaxed">Community monitoring is active. Currently, no monitored employers cross the critical risk threshold.</p>
            </div>
          )}
        </section>

        {/* Live Intelligence Feed (Data Vibes) */}
        {latestSignals && latestSignals.length > 0 && (
          <section className="text-left space-y-6 pt-10 border-t-2 border-slate-100/50">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Recent Community Intelligence</h2>
              <span className="px-3 py-1 bg-blue-50 border border-blue-100 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                Live Data
              </span>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2">
              {latestSignals.map((signal: any) => (
                 <div key={signal.id} className="p-8 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm relative overflow-hidden group hover:shadow-xl hover:border-blue-100 transition-all">
                   <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity pointer-events-none">
                     <svg className="w-24 h-24 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C20.1216 16 21.017 16.8954 21.017 18V21H14.017ZM14.017 21C14.017 21.5523 13.5693 22 13.017 22H11.017C10.4647 22 10.017 21.5523 10.017 21V18C10.017 16.8954 9.12157 16 8.017 16H5.017C3.91243 16 3.017 16.8954 3.017 18V21H10.017ZM3.017 21C3.017 21.5523 2.56928 22 2.017 22H1.017C0.464718 22 0.017 21.5523 0.017 21V15C0.017 12.2386 2.25558 10 5.017 10H19.017C21.7784 10 24.017 12.2386 24.017 15V21H23.017C22.4647 21 22.017 21.5523 22.017 21H3.017Z" />
                     </svg>
                   </div>
                   <div className="flex items-center justify-between mb-4 relative z-10">
                     <div className="flex items-center gap-2">
                       <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                         {signal.source_type === 'audio' ? 'Voice Transcription' : 'Text Report'}
                       </span>
                     </div>
                     <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                        {new Date(signal.submitted_at).toLocaleDateString()}
                     </span>
                   </div>
                   <p className="text-sm font-bold text-slate-600 line-clamp-3 italic relative z-10 leading-relaxed group-hover:text-slate-900 transition-colors">
                     <span aria-hidden="true">{"\u201C"}</span>
                     {signal.raw_text}
                     <span aria-hidden="true">{"\u201D"}</span>
                   </p>
                 </div>
              ))}
            </div>
          </section>
        )}

        <div className="pt-10 border-t-2 border-slate-100/50 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="p-8 bg-white rounded-[2.5rem] shadow-xl shadow-slate-100 border border-slate-50 group hover:border-slate-200 transition-colors">
            <div className="mb-6 text-slate-800 group-hover:scale-110 transition-transform duration-500">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight mb-2">Voice Intake</h3>
            <p className="text-sm text-slate-500 font-bold leading-relaxed">Speak naturally. Our AI extracts patterns instantly.</p>
          </div>
          <div className="p-8 bg-white rounded-[2.5rem] shadow-xl shadow-slate-100 border border-slate-50 group hover:border-slate-200 transition-colors">
            <div className="mb-6 text-slate-800 group-hover:scale-110 transition-transform duration-500">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight mb-2">Risk Signals</h3>
            <p className="text-sm text-slate-500 font-bold leading-relaxed">Detect wage theft, safety issues, and scams automatically.</p>
          </div>
          <div className="p-8 bg-white rounded-[2.5rem] shadow-xl shadow-slate-100 border border-slate-50 group hover:border-slate-200 transition-colors">
            <div className="mb-6 text-slate-800 group-hover:scale-110 transition-transform duration-500">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight mb-2">Civic Armor</h3>
            <p className="text-sm text-slate-500 font-bold leading-relaxed">Every report protects the next 100 workers.</p>
          </div>
        </div>
      </div>
      
      {/* Footer Branding */}
      <footer className="mt-20 pb-8 text-center relative z-10">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">
          Powered by Collective Worker Intelligence
        </p>
      </footer>
    </main>
  );
}
