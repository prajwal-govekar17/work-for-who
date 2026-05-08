# Codex Fix Context Pack

Use this file as the complete handoff context for fixing the current issue.

## 1) Current blocking error (from `npm run build`)

```txt
> local-worker-shield@0.1.0 build
> next build

▲ Next.js 16.2.6 (Turbopack)

  Creating an optimized production build ...
✓ Compiled successfully in 5.6s
  Running TypeScript ...
  Finished TypeScript in 4.8s ...
  Collecting page data using 10 workers ...
  Generating static pages using 10 workers (0/8) ...
  Generating static pages using 10 workers (2/8)
⨯ useSearchParams() should be wrapped in a suspense boundary at page "/report". Read more: https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
    at S (C:\Users\prajw\Desktop\WorkForWHo\.next\server\chunks\ssr\_0wb72sj._.js:2:2692)
    at r (C:\Users\prajw\Desktop\WorkForWHo\.next\server\chunks\ssr\_0wb72sj._.js:4:6760)
    at C:\Users\prajw\Desktop\WorkForWHo\.next\server\chunks\ssr\_0wb72sj._.js:40:54174
    at an (C:\Users\prajw\Desktop\WorkForWHo\node_modules\next\dist\compiled\next-server\app-page-turbo.runtime.prod.js:2:84267)
    at ai (C:\Users\prajw\Desktop\WorkForWHo\node_modules\next\dist\compiled\next-server\app-page-turbo.runtime.prod.js:2:86086)
    at al (C:\Users\prajw\Desktop\WorkForWHo\node_modules\next\dist\compiled\next-server\app-page-turbo.runtime.prod.js:2:107860)
    at ao (C:\Users\prajw\Desktop\WorkForWHo\node_modules\next\dist\compiled\next-server\app-page-turbo.runtime.prod.js:2:105275)
    at aa (C:\Users\prajw\Desktop\WorkForWHo\node_modules\next\dist\compiled\next-server\app-page-turbo.runtime.prod.js:2:84619)
    at ai (C:\Users\prajw\Desktop\WorkForWHo\node_modules\next\dist\compiled\next-server\app-page-turbo.runtime.prod.js:2:86135)
    at ai (C:\Users\prajw\Desktop\WorkForWHo\node_modules\next\dist\compiled\next-server\app-page-turbo.runtime.prod.js:2:104615)
Error occurred prerendering page "/report". Read more: https://nextjs.org/docs/messages/prerender-error
Export encountered an error on /report/page: /report, exiting the build.
⨯ Next.js build worker exited with code: 1 and signal: null
```

## 2) Primary suspect file

### `src/app/report/page.tsx`

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function ReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCompanyId = searchParams.get("companyId");
  const supabase = createClient();

  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    companyId: initialCompanyId || "",
    content: "",
  });

  useEffect(() => {
    async function fetchCompanies() {
      const { data } = await supabase.from("companies").select("id, name");
      if (data) setCompanies(data);
    }
    fetchCompanies();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyId || !formData.content) return;

    setLoading(true);

    // Ensure anonymous auth for the session if not authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      await supabase.auth.signInAnonymously();
    }

    const { error } = await supabase.from("reports").insert({
      company_id: formData.companyId,
      content_text: formData.content,
    });

    if (error) {
      console.error("Error submitting report:", error);
      alert("Failed to submit report. Please try again.");
    } else {
      // Trigger AI Analysis via API (Phase 4)
      // We don't wait for it to finish for the user, just fire and forget or let a worker handle it.
      // For demo, we'll try to trigger it.
      const { data: newReport } = await supabase
        .from("reports")
        .select("id")
        .eq("company_id", formData.companyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (newReport) {
        fetch("/api/ai/intake", {
          method: "POST",
          body: JSON.stringify({ reportId: newReport.id }),
        }).then(() => {
          fetch("/api/ai/intelligence", {
            method: "POST",
            body: JSON.stringify({ companyId: formData.companyId }),
          });
        });
      }
      
      router.push(`/companies/${formData.companyId}?success=true`);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-6">
        <header>
          <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
            ← Back Home
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 mt-2">Submit a Report</h1>
          <p className="text-slate-500 text-sm mt-1">Your report is anonymous and helps protect other workers.</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Employer</label>
            <select
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={formData.companyId}
              onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
            >
              <option value="">Select an employer</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">What happened?</label>
            <textarea
              required
              rows={5}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="e.g. Salary delayed for 2 weeks, unsafe machinery, fake job listing..."
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white font-bold py-3 rounded-md hover:bg-slate-800 transition disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Anonymous Report"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

## 3) Surrounding related files

### `src/app/api/ai/intake/route.ts`

```ts
import { createClient } from "@/lib/supabase/server";
import { model } from "@/lib/ai/gemini";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { reportId } = await req.json();
    const supabase = await createClient();

    // 1. Fetch the report
    const { data: report, error: fetchError } = await supabase
      .from("reports")
      .select("*")
      .eq("id", reportId)
      .single();

    if (fetchError || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // 2. Analyze with Gemini
    const prompt = `
      You are a Risk Intake Agent for an informal labor market trust system.
      Analyze the following worker report and extract risk signals.
      
      Report Content: "${report.content_text}"
      
      Extract:
      - Risk Signals: (e.g., salary_delay, unsafe_conditions, scam_behavior, verbal_abuse)
      - Sentiment Score: (-1.0 to 1.0, where -1.0 is highly negative/risky)
      
      Return ONLY a JSON object:
      {
        "risk_signals": ["signal1", "signal2"],
        "sentiment_score": -0.8,
        "summary": "Short plain-language summary of the issue"
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean up potential markdown formatting from Gemini
    const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const analysis = JSON.parse(jsonString);

    // 3. Save to ai_analysis
    const { error: insertError } = await supabase.from("ai_analysis").insert({
      report_id: report.id,
      extracted_risks: analysis.risk_signals,
      sentiment_score: analysis.sentiment_score,
    });

    if (insertError) {
      console.error("Error saving AI analysis:", insertError);
      return NextResponse.json({ error: "Failed to save analysis" }, { status: 500 });
    }

    return NextResponse.json({ success: true, analysis });
  } catch (err: any) {
    console.error("Intake Agent Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

### `src/app/api/ai/intelligence/route.ts`

```ts
import { createClient } from "@/lib/supabase/server";
import { model } from "@/lib/ai/gemini";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { companyId } = await req.json();
    const supabase = await createClient();

    // 1. Fetch all AI analyses for this company
    const { data: analyses, error: fetchError } = await supabase
      .from("ai_analysis")
      .select("*, reports!inner(company_id)")
      .eq("reports.company_id", companyId);

    if (fetchError) {
      return NextResponse.json({ error: "Failed to fetch analyses" }, { status: 500 });
    }

    if (!analyses || analyses.length === 0) {
      return NextResponse.json({ message: "No analyses found for this company" });
    }

    // 2. Aggregate and calculate with Gemini
    const analysisContext = analyses.map(a => ({
      risks: a.extracted_risks,
      sentiment: a.sentiment_score
    }));

    const prompt = `
      You are a Risk Intelligence Agent. 
      You have received multiple AI-extracted risk reports for a single employer.
      
      Reports Context: ${JSON.stringify(analysisContext)}
      
      Your task:
      1. Calculate a Trust Score (0-100). Start at 100 and deduct based on frequency and severity of risks.
      2. Determine Risk Level (low, medium, high).
      3. Generate a "Risk Briefing": A single concise paragraph warning future workers about patterns (e.g., "Multiple reports of salary delays across 3 months").
      4. Detect Scams: If you see repeated signals of fake listings or upfront payment requests, suggest a scam flag.
      
      Return ONLY a JSON object:
      {
        "score": 45,
        "risk_level": "medium",
        "briefing": "Workers have reported inconsistent payments and safety issues in recent months.",
        "scam_flag": "Potential fake job pattern detected" | null
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const intelligence = JSON.parse(jsonString);

    // 3. Update trust_scores
    const { error: updateError } = await supabase
      .from("trust_scores")
      .upsert({
        company_id: companyId,
        score: intelligence.score,
        risk_level: intelligence.risk_level,
        risk_briefing: intelligence.briefing,
        last_updated: new Date().toISOString()
      });

    if (updateError) throw updateError;

    // 4. Add scam flag if detected
    if (intelligence.scam_flag) {
      await supabase.from("scam_flags").insert({
        company_id: companyId,
        flag_reason: intelligence.scam_flag
      });
    }

    // Store the briefing in trust_scores (we need to add a column or use a separate table, 
    // for MVP let's assume we can just output it or we'll add it to the schema now).
    // Let's quickly add a column 'risk_briefing' to trust_scores in a new migration? 
    // Or just re-run the initial one if it's not live yet.
    // I'll just update the trust_scores table in the next step.

    return NextResponse.json({ success: true, intelligence });
  } catch (err: any) {
    console.error("Intelligence Agent Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

### `src/app/companies/[id]/page.tsx`

```tsx
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
```

### `supabase/migrations/20240508000000_initial_schema.sql`

```sql
-- Initial Schema for Local Worker Shield

-- 1. Users Table (Extensions for Supabase Auth)
-- Note: Supabase auth.users is handled by Supabase. 
-- We'll create a public.profiles/users table if needed, but for anonymous workers, 
-- we might just rely on auth.uid() in other tables.
-- For this MVP, let's create a public.users table to store user roles.

CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    role TEXT DEFAULT 'worker' CHECK (role IN ('worker', 'admin'))
);

-- 2. Companies Table
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    phone_number TEXT,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Reports Table
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users ON DELETE SET NULL,
    content_text TEXT,
    audio_url TEXT,
    language TEXT DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. AI Analysis Table
CREATE TABLE IF NOT EXISTS public.ai_analysis (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE NOT NULL,
    extracted_risks JSONB DEFAULT '[]'::jsonb,
    sentiment_score FLOAT,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. Trust Scores Table
CREATE TABLE IF NOT EXISTS public.trust_scores (
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE PRIMARY KEY,
    score INT DEFAULT 100 CHECK (score >= 0 AND score <= 100),
    risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
    risk_briefing TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. Scam Flags Table
CREATE TABLE IF NOT EXISTS public.scam_flags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    flag_reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scam_flags ENABLE ROW LEVEL SECURITY;

-- Basic Policies (Allow reading for all, writing for auth users)
CREATE POLICY "Allow public read on companies" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Allow public read on reports" ON public.reports FOR SELECT USING (true);
CREATE POLICY "Allow public read on ai_analysis" ON public.ai_analysis FOR SELECT USING (true);
CREATE POLICY "Allow public read on trust_scores" ON public.trust_scores FOR SELECT USING (true);
CREATE POLICY "Allow public read on scam_flags" ON public.scam_flags FOR SELECT USING (true);

-- Workers can submit reports
CREATE POLICY "Allow auth users to submit reports" ON public.reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

## 4) Notes for Codex

- Main build blocker is specifically `/report` and `useSearchParams()` suspense requirement in this Next.js version.
- Non-blocking terminal line observed earlier: `PathNotFound,Microsoft.PowerShell.Commands.GetChildItemCommand` (setup/path check related).

