import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();

  const { data: employer, error } = await supabase
    .from("employers")
    .select(
      `
      id,
      canonical_name,
      location_city,
      location_area,
      created_at,
      employer_scores(trust_score, risk_level, risk_briefing, report_count, updated_at)
    `
    )
    .eq("id", id)
    .single();

  if (error || !employer) {
    return NextResponse.json({ error: "Employer not found." }, { status: 404 });
  }

  const { data: recentReports } = await supabase
    .from("reports")
    .select("id, raw_text, submitted_at, status")
    .eq("employer_id", id)
    .order("submitted_at", { ascending: false })
    .limit(10);

  const { data: analyses } = await supabase
    .from("ai_analyses")
    .select("issues_json, severity, sentiment, created_at")
    .eq("employer_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  const publicReports = (recentReports ?? []).map((item) => ({
    id: item.id,
    submitted_at: item.submitted_at,
    status: item.status,
    snippet: item.raw_text
      .replace(/\d/g, "x")
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
      .slice(0, 180),
  }));

  return NextResponse.json({
    employer,
    reports: publicReports,
    analyses: analyses ?? [],
  });
}
