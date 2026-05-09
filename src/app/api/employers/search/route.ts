import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const supabase = await createClient();

  let dbQuery = supabase
    .from("employers")
    .select("id, canonical_name, location_city, location_area, employer_scores(trust_score, risk_level, updated_at)")
    .order("last_seen_at", { ascending: false })
    .limit(30);

  if (query) {
    dbQuery = dbQuery.ilike("canonical_name", `%${query}%`);
  }

  const { data, error } = await dbQuery;
  
  let employers = data ?? [];

  // Fallback to legacy companies table if empty or error (table missing)
  if (employers.length === 0) {
    try {
      let companyQuery = supabase
        .from("companies")
        .select("id, name, location")
        .order("created_at", { ascending: false })
        .limit(30);
      
      if (query) {
        companyQuery = companyQuery.ilike("name", `%${query}%`);
      }
      
      const { data: companies } = await companyQuery;
      if (companies) {
        employers = companies.map(c => ({
          id: c.id,
          canonical_name: c.name,
          location_city: c.location,
          location_area: null,
          employer_scores: [],
          is_legacy: true
        })) as any;
      }
    } catch { /* ignore */ }
  }

  return NextResponse.json({ employers });
}
