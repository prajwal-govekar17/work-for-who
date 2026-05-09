import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.trim().toLowerCase() ?? "";

  if (!code || code.length < 6) {
    return NextResponse.json({ error: "Invalid access code" }, { status: 400 });
  }

  const supabase = await createClient();

  // Fetch recent reports to find the match in JS, avoiding UUID casting issues
  const { data: reports } = await supabase
    .from("reports")
    .select("id, status, submitted_at, created_at, employer_id, company_id")
    .order("created_at", { ascending: false })
    .limit(100);

  let reportMatch: any = reports?.find((r: any) => r.id.toLowerCase().startsWith(code));

  // If new schema failed, try legacy schema
  if (!reportMatch) {
    const { data: legacyReports } = await supabase
      .from("reports")
      .select("id, created_at, company_id")
      .order("created_at", { ascending: false })
      .limit(100);

    reportMatch = legacyReports?.find((r: any) => r.id.toLowerCase().startsWith(code));
  }

  if (!reportMatch) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const report = reportMatch;
  const employerId = report.employer_id || report.company_id;
  const status = report.status || (employerId ? "processed" : "pending");
  const submittedAt = report.submitted_at || report.created_at || new Date().toISOString();

  let employerName = "Unknown Employer";

  if (employerId) {
    const { data: emp } = await supabase
      .from("employers")
      .select("canonical_name")
      .eq("id", employerId)
      .single();

    if (emp) {
      employerName = emp.canonical_name;
    } else {
      const { data: comp } = await supabase
        .from("companies")
        .select("name")
        .eq("id", employerId)
        .single();
      if (comp) employerName = comp.name;
    }
  }

  return NextResponse.json({
    report: {
      id: report.id,
      status: status,
      submitted_at: submittedAt,
      employerName
    }
  });
}
