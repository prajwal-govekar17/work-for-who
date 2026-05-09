import { model } from "@/lib/ai/gemini";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { reportIdSchema } from "@/lib/validation/reports";
import { intakeAIOutputSchema } from "@/lib/validation/ai";
import type { IntakeAIOutput } from "@/types";
import type { Json } from "@/types/database";

const PROMPT_VERSION = "intake_v1";
const MODEL_NAME = "gemini-1.5-flash";

function parseJson(text: string): unknown {
  const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    throw new Error("AI response was not valid JSON.");
  }
}

export async function POST(req: Request) {
  let supabase: ReturnType<typeof createServiceRoleClient>;
  try {
    supabase = createServiceRoleClient();
  } catch (configError) {
    const message = configError instanceof Error ? configError.message : "Server configuration error.";
    console.error("Supabase service client:", configError);
    return NextResponse.json({ error: message }, { status: 503 });
  }

  try {
    const json = await req.json();
    const result = reportIdSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const { reportId } = result.data;

    let report: any;
    let isLegacy = false;
    
    const modernRes = await supabase
      .from("reports")
      .select("id, raw_text, content_text, status")
      .eq("id", reportId)
      .single();

    if (modernRes.error && (modernRes.error.code === 'PGRST204' || modernRes.error.code === '42703' || modernRes.error.message.includes('schema'))) {
       const legacyRes = await supabase
         .from("reports")
         .select("id, content_text")
         .eq("id", reportId)
         .single();
       if (legacyRes.error || !legacyRes.data) {
         return NextResponse.json({ error: "Report not found" }, { status: 404 });
       }
       report = legacyRes.data;
       isLegacy = true;
    } else if (modernRes.error || !modernRes.data) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    } else {
      report = modernRes.data;
    }

    const reportBody =
      (typeof report.raw_text === "string" && report.raw_text.trim()
        ? report.raw_text
        : typeof (report as { content_text?: string }).content_text === "string"
          ? (report as { content_text: string }).content_text
          : "") ?? "";

    const prompt = `
      You are a Risk Intake Agent for an informal labor market trust system.
      Analyze the following worker report and extract structured signals.
      
      Report Content JSON string (literal worker text, preserve meaning):
      ${JSON.stringify(reportBody)}
      
      Return ONLY JSON with this exact shape:
      {
        "employer_name": string or null,
        "location_city": string or null,
        "location_area": string or null,
        "issues": string[],
        "sentiment": "negative" | "neutral" | "positive",
        "severity": 1-5,
        "summary": string,
        "is_valid_report": boolean
      }
      
      Rules:
      - Keep issues concise (examples: salary_delay, unsafe_conditions, abuse, scam, withheld_documents).
      - Set employer_name to null if unknown.
      - Set is_valid_report to false if content is gibberish or not workplace related.
    `;

    let parsedRaw: unknown;
    try {
      const response = await model.generateContent(prompt);
      try {
        parsedRaw = parseJson(response.response.text());
      } catch {
        if (!isLegacy) await supabase.from("reports").update({ status: "needs_review" }).eq("id", report.id);
        return NextResponse.json({ error: "AI response was not valid JSON." }, { status: 500 });
      }
    } catch (aiErr: any) {
      // Quota / rate-limit hit — report is already saved; try a simple text-scan match
      const isQuotaError = aiErr?.message?.includes("429") || aiErr?.message?.includes("quota") || aiErr?.message?.includes("Too Many");
      if (isQuotaError) {
        // Attempt keyword-based employer matching without AI
        let fallbackEmployerId: string | null = null;
        let fallbackEmployerName: string | null = null;
        try {
          const rawText = (report.raw_text || report.content_text || "").toLowerCase();
          const { data: allEmployers } = await supabase
            .from(isLegacy ? "companies" : "employers")
            .select(isLegacy ? "id, name" : "id, canonical_name");

          if (allEmployers) {
            for (const emp of allEmployers) {
              const name = (isLegacy ? (emp as any).name : (emp as any).canonical_name) as string;
              if (name && rawText.includes(name.toLowerCase())) {
                fallbackEmployerId = emp.id;
                fallbackEmployerName = name;
                break;
              }
            }
          }
          // Also try linking the report to matched employer in DB
          if (fallbackEmployerId && !isLegacy) {
            await supabase.from("reports").update({ employer_id: fallbackEmployerId }).eq("id", report.id);
          }
        } catch { /* non-critical, ignore */ }

        return NextResponse.json({
          status: "pending",
          reportId: report.id,
          employerId: fallbackEmployerId,
          employerName: fallbackEmployerName,
          analysis: {
            summary: fallbackEmployerName
              ? `Your report about ${fallbackEmployerName} has been securely saved. Full AI analysis will appear shortly.`
              : "Your report has been securely saved. AI is matching this to regional patterns.",
            issues: [],
          },
        });
      }
      throw aiErr;
    }

    const aiResult = intakeAIOutputSchema.safeParse(parsedRaw);

    if (!aiResult.success) {
      console.error("AI Output Validation Failed:", aiResult.error.format());
      if (!isLegacy) await supabase.from("reports").update({ status: "needs_review" }).eq("id", report.id);
      return NextResponse.json({ error: "Invalid AI response format." }, { status: 500 });
    }


    const analysis = aiResult.data as IntakeAIOutput;
    let employerId: string | null = null;

    if (analysis.employer_name) {
      const employerName = analysis.employer_name.trim();
      let existingAlias = null;
      if (!isLegacy) {
        const aliasRes = await supabase
          .from("employer_aliases")
          .select("employer_id")
          .ilike("alias_name", employerName)
          .maybeSingle();
        existingAlias = aliasRes.data;
      }

      if (existingAlias?.employer_id) {
        employerId = existingAlias.employer_id;
      } else {
        const { data: existingEmployer } = await supabase
          .from(isLegacy ? "companies" : "employers")
          .select("id")
          .ilike(isLegacy ? "name" : "canonical_name", employerName)
          .maybeSingle();

        if (existingEmployer?.id) {
          employerId = existingEmployer.id;
        } else {
          const { data: createdEmployer, error: employerError } = await supabase
            .from(isLegacy ? "companies" : "employers")
            .insert(isLegacy ? {
              name: employerName,
              location: analysis.location_city,
            } : {
              canonical_name: employerName,
              location_city: analysis.location_city,
              location_area: analysis.location_area,
            })
            .select("id")
            .single();

          if (employerError || !createdEmployer) {
            console.error("Failed to create employer:", employerError);
            return NextResponse.json({ error: "Failed to resolve employer." }, { status: 500 });
          }
          employerId = createdEmployer.id;
        }

        if (!isLegacy) {
          const { error: aliasError } = await supabase.from("employer_aliases").insert({
            employer_id: employerId,
            alias_name: employerName,
            confidence: 1.0,
          });
          if (aliasError && aliasError.code !== "23505") {
            console.error("employer_aliases insert error:", aliasError);
          }
        }
      }
    }

    const finalStatus =
      analysis.is_valid_report && employerId ? "analyzed" : "needs_review";

    if (isLegacy) {
      const { error: analysisError } = await supabase.from("ai_analysis").insert({
        report_id: report.id,
        extracted_risks: analysis.issues,
        sentiment_score: analysis.sentiment === "negative" ? -1 : analysis.sentiment === "positive" ? 1 : 0,
      });

      if (analysisError) {
        console.error("Error saving AI analysis:", analysisError);
        return NextResponse.json({ error: "Failed to save analysis." }, { status: 500 });
      }

      await supabase
        .from("reports")
        .update({
          company_id: employerId,
        })
        .eq("id", report.id);

      if (finalStatus === "needs_review") {
        await supabase.from("scam_flags").insert({
          company_id: employerId,
          flag_reason: !analysis.is_valid_report 
            ? "AI marked report as invalid/out of scope."
            : "Employer name could not be reliably identified.",
        });
      }
    } else {
      const { error: analysisError } = await supabase.from("ai_analyses").upsert(
        {
          report_id: report.id,
          employer_id: employerId,
          issues_json: analysis.issues,
          sentiment: analysis.sentiment,
          severity: analysis.severity,
          summary: analysis.summary,
          prompt_version: PROMPT_VERSION,
          model: MODEL_NAME,
          raw_model_output: parsedRaw as Json,
        },
        { onConflict: "report_id" }
      );

      if (analysisError) {
        console.error("Error saving AI analysis:", analysisError);
        return NextResponse.json({ error: "Failed to save analysis." }, { status: 500 });
      }

      await supabase
        .from("reports")
        .update({
          status: finalStatus,
          employer_id: employerId,
          moderation_state: analysis.is_valid_report ? "clean" : "flagged",
        })
        .eq("id", report.id);

      if (finalStatus === "needs_review") {
        await supabase.from("report_flags").insert({
          report_id: report.id,
          reason: !analysis.is_valid_report 
            ? "AI marked report as invalid/out of scope."
            : "Employer name could not be reliably identified.",
        });
      }
    }

    return NextResponse.json({ success: true, reportId: report.id, employerId, analysis, status: finalStatus });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Intake Agent Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
