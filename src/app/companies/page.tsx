import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function CompaniesPage() {
  const supabase = await createClient();

  const { data: companies, error } = await supabase
    .from("companies")
    .select(`
      *,
      trust_scores (
        score,
        risk_level
      )
    `);

  if (error) {
    console.error("Error fetching companies:", error);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-slate-900">Employers</h1>
          <Link
            href="/"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            ← Back Home
          </Link>
        </header>

        <div className="grid gap-4">
          {companies?.map((company) => (
            <Link
              key={company.id}
              href={`/companies/${company.id}`}
              className="block p-6 bg-white rounded-xl shadow-sm border border-slate-200 hover:border-blue-300 transition group"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition">
                    {company.name}
                  </h2>
                  <p className="text-slate-500">{company.location}</p>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-black ${
                    company.trust_scores?.score > 70 ? 'text-green-600' : 
                    company.trust_scores?.score > 40 ? 'text-amber-500' : 'text-red-600'
                  }`}>
                    {company.trust_scores?.score ?? '--'}
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Trust Score
                  </p>
                </div>
              </div>
            </Link>
          ))}
          {(!companies || companies.length === 0) && (
            <div className="text-center py-12 text-slate-500">
              No employers found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
