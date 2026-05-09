import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employer_scores")
    .select("trust_score, risk_level, risk_briefing, report_count, updated_at, employers!inner(id, canonical_name, location_city, location_area)")
    .in("risk_level", ["medium", "high"])
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Failed to fetch recent warnings:", error);
    return NextResponse.json({ error: "Failed to load warnings." }, { status: 500 });
  }

  return NextResponse.json({ warnings: data ?? [] });
}
