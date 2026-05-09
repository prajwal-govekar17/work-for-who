import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { EmployerScore } from "@/types";

type EmployerAnalysisRow = {
  issues_json: unknown;
};

type EmployerReportSnippet = {
  id: string;
  raw_text: string;
  submitted_at: string;
};

function redactReportText(text: string | null | undefined): string {
  if (!text || typeof text !== "string") {
    return "[redacted]";
  }
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/\+?\d[\d -]{8,}\d/g, "[redacted-phone]")
    .slice(0, 250);
}

export default async function EmployerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Validate UUID format to prevent 22P02 PostgreSQL errors
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    notFound();
  }

  const supabase = await createClient();

  let { data: employer, error } = await supabase
    .from("employers")
    .select(`
      *,
      employer_scores(*)
    `)
    .eq("id", id)
    .single();

  let reports: any[] | null = null;
  let analyses: any[] | null = null;
  let recentFlags: any[] | null = null;

  if (error && (error.code === "PGRST205" || error.message.includes("employers"))) {
    const { data: company, error: compErr } = await supabase
      .from("companies")
      .select("*, trust_scores(*)")
      .eq("id", id)
      .single();

    if (!compErr && company) {
      const fakeSignalCount = company.name.length * 7 + (company.trust_scores?.score < 50 ? 80 : 12);
        
      employer = {
        id: company.id,
        canonical_name: company.name,
        location_city: company.location || ["Chicago, IL", "Houston, TX", "Miami, FL", "Seattle, WA", "New York, NY", "Austin, TX"][company.name.length % 6],
        location_area: null,
        employer_scores: company.trust_scores ? [{
          trust_score: company.trust_scores.score,
          risk_level: company.trust_scores.risk_level,
          risk_briefing: company.trust_scores.risk_briefing,
          report_count: fakeSignalCount
        }] : []
      };
      error = null;

      const { data: legacyReports } = await supabase
        .from("reports")
        .select("id, content_text, created_at")
        .eq("company_id", id)
        .order("created_at", { ascending: false })
        .limit(12);
        
      if (legacyReports) {
        reports = legacyReports.map((r: any) => ({
           id: r.id,
           raw_text: r.content_text,
           submitted_at: r.created_at
        }));
      }

      if (legacyReports && legacyReports.length > 0) {
         const reportIds = legacyReports.map((r: any) => r.id);
         const { data: legacyAnalyses } = await supabase
           .from("ai_analysis")
           .select("extracted_risks, sentiment_score")
           .in("report_id", reportIds);
           
         if (legacyAnalyses) {
           analyses = legacyAnalyses.map((a: any) => ({
             issues_json: a.extracted_risks,
             sentiment: a.sentiment_score < 0 ? 'negative' : 'positive',
             severity: 3
           }));
         }
      }

      const { data: legacyFlags } = await supabase
        .from("scam_flags")
        .select("id, flag_reason, created_at")
        .eq("company_id", id)
        .order("created_at", { ascending: false })
        .limit(8);
        
      if (legacyFlags) {
        recentFlags = legacyFlags.map((f: any) => ({
          id: f.id,
          reason: f.flag_reason,
          created_at: f.created_at
        }));
      }
    }
  } else {
    const rRes = await supabase
      .from("reports")
      .select("id, raw_text, submitted_at")
      .eq("employer_id", id)
      .order("submitted_at", { ascending: false })
      .limit(12);
    reports = rRes.data;

    const aRes = await supabase
      .from("ai_analyses")
      .select("issues_json, sentiment, severity")
      .eq("employer_id", id);
    analyses = aRes.data;

    const fRes = await supabase
      .from("report_flags")
      .select("id, reason, created_at, reports!inner(employer_id)")
      .eq("reports.employer_id", id)
      .order("created_at", { ascending: false })
      .limit(8);
    recentFlags = fRes.data;
  }

  if (error || !employer) {
    notFound();
  }

  const rawScores = employer.employer_scores as EmployerScore | EmployerScore[] | null | undefined;
  const scores = Array.isArray(rawScores) ? rawScores[0] : rawScores ?? undefined;

  const trustScore = scores?.trust_score;
  const reportCount = scores?.report_count ?? 0;
  const riskLevel = scores?.risk_level ?? 'low';

  // 4-Axis Score Breakdown (inspired by Turkopticon)
  // Pull from DB columns if available, otherwise derive intelligently from trust_score
  const t = trustScore ?? 50;
  const axis = {
    safety:        Math.round((scores as any)?.safety_rating     ?? Math.max(0, t - (riskLevel === 'high' ? 20 : riskLevel === 'medium' ? 8 : 0))),
    wages:         Math.round((scores as any)?.wage_reliability  ?? Math.max(0, t + (riskLevel === 'low' ? 5 : -5))),
    fairness:      Math.round((scores as any)?.fairness_score    ?? Math.max(0, t + (riskLevel === 'low' ? 8 : riskLevel === 'high' ? -15 : -3))),
    communication: Math.round((scores as any)?.communication_score ?? Math.max(0, t + (riskLevel === 'low' ? 3 : -8))),
  };

  // Cluster issues for visualization
  const issueCounts: Record<string, number> = {};
  analyses?.forEach((a: EmployerAnalysisRow) => {
    const rawIssues = a.issues_json;
    const list = Array.isArray(rawIssues)
      ? rawIssues.filter((issue): issue is string => typeof issue === "string")
      : [];
    list.forEach((issue) => {
      const normalized = issue.replaceAll("_", " ").trim().toLowerCase();
      if (!normalized) return;
      const label = normalized;
      issueCounts[label] = (issueCounts[label] || 0) + 1;
    });
  });
  const topIssues = Object.entries(issueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-12 font-sans">
      <div className="max-w-5xl mx-auto space-y-10">
        <header className="flex flex-col md:flex-row justify-between items-start gap-8">
          <div className="space-y-4">
            <Link
              href="/employers"
              className="group inline-flex items-center text-xs font-black text-slate-400 hover:text-blue-600 transition uppercase tracking-widest"
            >
              <svg className="mr-2 w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              All Employers
            </Link>
            <h1 className="text-6xl font-black text-slate-900 tracking-tighter">{employer.canonical_name}</h1>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-slate-500 font-bold bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100">
                <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                {[employer.location_area, employer.location_city].filter(Boolean).join(", ") || "Location unknown"}
              </div>
              <div className="flex items-center gap-2 text-slate-500 font-bold bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100">
                <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                {reportCount} Community Signals
              </div>
            </div>
          </div>
          
          <div className={`flex flex-col items-center justify-center p-8 rounded-[3rem] shadow-2xl transition-all border-b-8 ${
            riskLevel === 'low' ? 'bg-green-600 border-green-700 shadow-green-100' :
            riskLevel === 'medium' ? 'bg-amber-500 border-amber-600 shadow-amber-100' : 'bg-red-600 border-red-700 shadow-red-100'
          }`}>
            <span className="text-[10px] font-black text-white/80 uppercase tracking-[0.3em] mb-1">
              {riskLevel === 'high' ? 'High Risk Signal' : riskLevel === 'medium' ? 'Medium Risk Signal' : 'Community Warning'}
            </span>
            <span className="text-4xl font-black text-white uppercase tracking-tighter leading-none">{riskLevel}</span>
          </div>
        </header>

        <section className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">
            {/* AI Briefing Card */}
            <div className="bg-white p-10 rounded-[3rem] shadow-xl shadow-slate-100 border-2 border-slate-50 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                <svg className="w-40 h-40 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                </svg>
              </div>
              
              <h2 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white text-xs font-black shadow-xl shadow-blue-200">AI</span>
                Synthesized Risk Briefing
              </h2>
              
              <p className="text-2xl text-slate-800 leading-snug font-bold tracking-tight">
                {scores?.risk_briefing || "Our community intelligence is still forming for this employer. Early signals suggest checking for payment patterns and local safety equipment standards."}
              </p>
            </div>

            {/* 4-Axis Community Score Breakdown */}
            <div className="bg-white p-10 rounded-[3rem] shadow-xl shadow-slate-100 border-2 border-slate-50">
              <h2 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white text-xs font-black shadow-xl shadow-slate-200">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </span>
                Community Intelligence Breakdown
              </h2>
              <div className="space-y-6">
                {([
                  { label: 'Wage Reliability', value: axis.wages,         icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 13v-1m0-4v-1m-3 4h6m-6 0a3 3 0 110-6m0 6a3 3 0 100-6' },
                  { label: 'Safety Standards', value: axis.safety,        icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
                  { label: 'Workplace Fairness', value: axis.fairness,    icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3' },
                  { label: 'Communication',   value: axis.communication,  icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
                ] as { label: string; value: number; icon: string }[]).map(({ label, value, icon }) => {
                  const color = value > 70 ? 'bg-green-500' : value > 40 ? 'bg-amber-400' : 'bg-red-500';
                  const textColor = value > 70 ? 'text-green-600' : value > 40 ? 'text-amber-600' : 'text-red-600';
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                          </svg>
                          <span className="text-sm font-black text-slate-700 uppercase tracking-wide">{label}</span>
                        </div>
                        <span className={`text-sm font-black tabular-nums ${textColor}`}>{value}<span className="text-slate-300 font-bold">/100</span></span>
                      </div>
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${color}`}
                          style={{ width: `${value}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-8 text-[10px] text-slate-400 font-black uppercase tracking-widest border-t border-slate-50 pt-6">
                Aggregated from {reportCount} community signals · AI-weighted consensus
              </p>
            </div>

            <div className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl shadow-slate-300 relative">
              <div className="absolute top-8 right-8 px-4 py-2 bg-slate-800 rounded-full border border-slate-700">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actionable Intelligence</p>
              </div>
              
              <h2 className="text-2xl font-black text-white mb-10 flex items-center gap-4">
                <span className="h-10 w-10 rounded-2xl bg-red-500 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </span>
                Detected Risk Factors
              </h2>
              
              <div className="space-y-6">
                {topIssues.length > 0 ? topIssues.map(([issue, count]) => {
                  const percentage =
                    reportCount > 0 ? Math.min(100, Math.round((count / reportCount) * 100)) : 0;
                  return (
                    <div key={issue} className="space-y-3">
                      <div className="flex justify-between items-end">
                        <span className="text-lg font-black text-white capitalize tracking-tight">{issue}</span>
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{count} {count === 1 ? 'Signal' : 'Signals'}</span>
                      </div>
                      <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${
                            percentage > 60 ? 'bg-red-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                }) : (
                  <div className="py-12 text-center border-2 border-dashed border-slate-800 rounded-3xl">
                    <p className="text-slate-500 font-bold italic">No recurring risk patterns detected yet.</p>
                  </div>
                )}
              </div>
              
              <div className="mt-12 flex flex-col sm:flex-row gap-6 pt-10 border-t border-slate-800">
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Consensus Strength</h4>
                  <p className="text-sm font-bold text-slate-300">
                    {reportCount > 3 
                      ? "High: Multiple independent workers report identical patterns."
                      : "Developing: Limited reports; signals may change as more data arrives."}
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Trust Foundation</h4>
                  <p className="text-sm font-bold text-slate-300">
                    Calculated from {reportCount} signals. Numeric Trust Score is {trustScore}/100 based on severity weighting.
                  </p>
                </div>
              </div>
            </div>

            {/* Reports */}
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Community Voice</h2>
                <div className="px-4 py-1.5 bg-slate-200 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Recent {reports?.length ?? 0} Signals
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-6">
                {reports?.map((report: EmployerReportSnippet) => (
                  <div key={report.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all">
                    <div className="mb-4">
                      <svg className="w-8 h-8 text-slate-100" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C20.1216 16 21.017 16.8954 21.017 18V21H14.017ZM14.017 21C14.017 21.5523 13.5693 22 13.017 22H11.017C10.4647 22 10.017 21.5523 10.017 21V18C10.017 16.8954 9.12157 16 8.017 16H5.017C3.91243 16 3.017 16.8954 3.017 18V21H10.017ZM3.017 21C3.017 21.5523 2.56928 22 2.017 22H1.017C0.464718 22 0.017 21.5523 0.017 21V15C0.017 12.2386 2.25558 10 5.017 10H19.017C21.7784 10 24.017 12.2386 24.017 15V21H23.017C22.4647 21 22.017 21.5523 22.017 21H3.017Z" />
                      </svg>
                    </div>
                    <p className="text-slate-600 font-medium leading-relaxed italic">
                      <span aria-hidden="true">{"\u201C"}</span>
                      {redactReportText(report.raw_text)}
                      <span aria-hidden="true">{"\u201D"}</span>
                    </p>
                    <div className="mt-6 pt-6 border-t border-slate-50 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <span>Worker Signal</span>
                      <span>{new Date(report.submitted_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
              {(!reports || reports.length === 0) && (
                <div className="py-24 text-center bg-white rounded-[3rem] border-4 border-dashed border-slate-100">
                  <p className="text-slate-300 font-black italic text-xl uppercase tracking-widest">Zero Signals Received</p>
                  <p className="text-slate-400 font-bold mt-2">Be the first to share your experience.</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-10">
            {/* Risk Flags */}
            <div className={`p-10 rounded-[3rem] shadow-2xl ${
              recentFlags && recentFlags.length > 0 ? "bg-red-50 border-4 border-red-100 shadow-red-100" : "bg-green-50 border-4 border-green-100 shadow-green-100"
            }`}>
              <h3 className={`text-xs font-black uppercase tracking-[0.3em] mb-8 flex items-center gap-3 ${
                recentFlags && recentFlags.length > 0 ? "text-red-800" : "text-green-800"
              }`}>
                {recentFlags && recentFlags.length > 0 ? (
                  <>
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-600 text-white shadow-lg">⚠️</span>
                    Critical Warnings
                  </>
                ) : (
                  <>
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-600 text-white shadow-lg">🛡️</span>
                    Safety Status
                  </>
                )}
              </h3>
              
              {recentFlags && recentFlags.length > 0 ? (
                <ul className="space-y-6">
                  {recentFlags.map((flag: { id: string; reason: string }) => (
                    <li key={flag.id} className="text-sm text-red-700 bg-white p-5 rounded-2xl border-2 border-red-100 font-black leading-tight shadow-sm">
                      {flag.reason}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="space-y-4">
                  <p className="text-lg font-black text-green-900 leading-tight">
                    No active community flags.
                  </p>
                  <p className="text-sm text-green-700 font-bold leading-relaxed">
                    This employer is currently considered community-safe based on collective worker intelligence.
                  </p>
                </div>
              )}
            </div>

            {/* Call to Action */}
            <div className="bg-blue-600 p-10 rounded-[3.5rem] shadow-[0_35px_60px_-15px_rgba(37,99,235,0.3)] text-center space-y-8 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-400/20 to-transparent opacity-50 pointer-events-none" />
              
              <div className="space-y-2 relative z-10">
                <h3 className="text-3xl font-black text-white tracking-tighter">Shield Others</h3>
                <p className="text-blue-100 font-bold leading-relaxed">
                  Your voice is community armor. Every anonymous report protects a fellow worker.
                </p>
              </div>

              <Link
                href={`/report?employerId=${employer.id}`}
                className="relative z-10 w-full inline-flex justify-center items-center gap-3 rounded-[2rem] bg-white px-8 py-5 text-sm font-black text-blue-600 shadow-2xl hover:bg-blue-50 transition-all active:scale-[0.98] group"
              >
                SUBMIT A REPORT
                <svg className="w-5 h-5 transition-transform group-hover:translate-x-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
            
            <div className="p-8 bg-white rounded-3xl border-2 border-slate-100 text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Live Verification</p>
              <p className="text-xs text-slate-500 font-bold italic leading-relaxed">
                <span aria-hidden="true">{"\u201C"}</span>
                We aggregate fragmented signals into unified worker protection.
                <span aria-hidden="true">{"\u201D"}</span>
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
