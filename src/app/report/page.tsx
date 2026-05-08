"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

function ReportPageContent() {
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

export default function ReportPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <ReportPageContent />
    </Suspense>
  );
}
