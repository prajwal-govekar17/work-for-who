import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { report_text } = await req.json();
    const normalizedReportText =
      typeof report_text === "string" ? report_text.trim() : "";

    if (!normalizedReportText || normalizedReportText.length < 10) {
      return NextResponse.json(
        { error: "Report text is too short or missing." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: report, error: insertError } = await supabase
      .from("reports")
      .insert({
        raw_text: normalizedReportText,
        content_text: normalizedReportText,
        source_type: "text",
        status: "new",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Supabase report insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save report to database." },
        { status: 500 }
      );
    }

    const intakeRes = await fetch(new URL("/api/ai/intake", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId: report.id }),
    });
    const intakeData = await intakeRes.json();

    let intelligenceData: unknown = null;
    if (intakeRes.ok && intakeData?.employerId) {
      const intelligenceRes = await fetch(new URL("/api/ai/intelligence", req.url), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employerId: intakeData.employerId }),
      });
      intelligenceData = await intelligenceRes.json();
    }

    return NextResponse.json({
      success: true,
      report,
      intake: intakeData,
      intelligence: intelligenceData,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Intake API Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
