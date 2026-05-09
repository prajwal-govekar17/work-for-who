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
  if (error) {
    console.error("Employer search failed:", error);
    return NextResponse.json({ error: "Failed to search employers." }, { status: 500 });
  }

  return NextResponse.json({ employers: data ?? [] });
}
