import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function CompanyProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: company, error } = await supabase
    .from("companies")
    .select(`
      *,
      trust_scores (
        score,
        risk_level,
        risk_briefing,
        last_updated
      ),
      scam_flags (
        flag_reason,
        created_at
      ),
      reports (
        id,
        content_text,
        created_at
      )
    `)
    .eq("id", id)
    .single();

  if (error || !company) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex justify-between items-start">
          <div>
            <Link
              href="/companies"
              className="text-sm font-medium text-blue-600 hover:underline mb-2 block"
            >
              ← All Employers
            </Link>
            <h1 className="text-4xl font-bold text-slate-900">{company.name}</h1>
            <p className="text-slate-500">{company.location}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center min-w-[140px]">
            <div className={`text-5xl font-black ${
              company.trust_scores?.score > 70 ? 'text-green-600' : 
              company.trust_scores?.score > 40 ? 'text-amber-500' : 'text-red-600'
            }`}>
              {company.trust_scores?.score ?? '--'}
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">
              Trust Score
            </p>
          </div>
        </header>

        <section className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            {/* AI Risk Briefing Placeholder (Will be populated by Risk Intelligence Agent) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs">AI</span>
                Risk Briefing
              </h2>
              <p className="text-slate-700 leading-relaxed">
                {company.trust_scores?.risk_briefing || (company.trust_scores?.score < 100 
                  ? "AI is analyzing multiple reports for this employer. Preliminary signals suggest some caution may be needed."
                  : "No significant risk signals detected by AI from recent community reports.")}
              </p>
            </div>

            {/* Recent Reports */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Community Reports</h2>
              {company.reports?.map((report: any) => (
                <div key={report.id} className="bg-white p-4 rounded-xl border border-slate-200">
                  <p className="text-slate-600 text-sm line-clamp-3">"{report.content_text}"</p>
                  <p className="text-[10px] text-slate-400 mt-2">
                    {new Date(report.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
              {(!company.reports || company.reports.length === 0) && (
                <p className="text-slate-500 italic text-sm">No reports submitted yet for this employer.</p>
              )}
            </div>
          </div>

          <div className="space-y-8">
            {/* Scam Flags */}
            <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl">
              <h3 className="font-bold text-amber-800 mb-4">Risk Flags</h3>
              {company.scam_flags?.length > 0 ? (
                <ul className="space-y-3">
                  {company.scam_flags.map((flag: any, i: number) => (
                    <li key={i} className="text-sm text-amber-700 flex gap-2">
                      <span className="shrink-0">⚠️</span>
                      {flag.flag_reason}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-amber-600">No active scam flags for this employer.</p>
              )}
            </div>

            <Link
              href={`/report?companyId=${company.id}`}
              className="w-full inline-flex justify-center rounded-md bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition"
            >
              Report an Issue
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
