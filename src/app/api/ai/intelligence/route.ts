import { createServiceRoleClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { employerIdSchema } from "@/lib/validation/employers";
import { model } from "@/lib/ai/gemini";

type AnalysisRow = {
  severity: number;
  sentiment: "negative" | "neutral" | "positive";
  issues_json: string[];
  summary: string;
};

function calculateHeuristicScore(analyses: AnalysisRow[]) {
  const issueCounts = new Map<string, number>();
  let penalty = 0;

  for (const item of analyses) {
    const severity = item.severity;
    penalty += severity * 4;

    if (item.sentiment === "negative") {
      penalty += 3;
    }

    for (const issue of item.issues_json) {
      const normalized = issue.trim().toLowerCase();
      if (!normalized) continue;
      issueCounts.set(normalized, (issueCounts.get(normalized) ?? 0) + 1);
    }
  }

  for (const count of issueCounts.values()) {
    if (count >= 3) penalty += 4;
    else if (count === 2) penalty += 2;
  }

  const trustScore = Math.max(0, Math.min(100, 100 - penalty));
  const riskLevel = trustScore <= 40 ? "high" : trustScore <= 70 ? "medium" : "low";

  const likelyScam = (issueCounts.get("scam") ?? 0) >= 2 || (issueCounts.get("fake_listing") ?? 0) >= 2;

  return { trustScore, riskLevel, likelyScam, issueCounts };
}

async function generateAIBriefing(analyses: AnalysisRow[], trustScore: number, riskLevel: string) {
  const summaries = analyses.map(a => `- ${a.summary}`).join("\n");
  
  const prompt = `
    You are a Community Safety Intelligence Agent for WorkForWho.
    Your task is to synthesize multiple worker reports into a single, cohesive, and human-centric "Risk Briefing" for an employer.
    
    Data:
    - Current Trust Score: ${trustScore}/100
    - Risk Level: ${riskLevel}
    - Recent Report Summaries:
    ${summaries}
    
    Rules:
    1. Be concise (2-3 sentences max).
    2. Focus on recurring patterns or the most severe issues mentioned.
    3. Use plain, empathetic, but objective language.
    4. Start with a clear summary of the community consensus.
    5. Do NOT use names or specific dates.
    6. If reports are contradictory, mention the lack of consensus.
    
    Example: "Multiple independent reports mention consistent issues with late-night safety and unpaid overtime. While some workers report prompt payment, the consensus suggests significant caution is needed for night shifts."
  `;

  try {
    const response = await model.generateContent(prompt);
    return response.response.text().trim();
  } catch (err) {
    console.error("Failed to generate AI briefing:", err);
    return "AI analysis is currently unavailable, but community reports suggest caution based on multiple issue signals.";
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
    const result = employerIdSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const { employerId } = result.data;

    let previousScore: any;
    let isLegacy = false;

    const modernScoreRes = await supabase
      .from("employer_scores")
      .select("trust_score")
      .eq("employer_id", employerId)
      .maybeSingle();

    if (modernScoreRes.error && (modernScoreRes.error.code === 'PGRST205' || modernScoreRes.error.message.includes('schema'))) {
       isLegacy = true;
       const legacyScoreRes = await supabase
         .from("trust_scores")
         .select("score")
         .eq("company_id", employerId)
         .maybeSingle();
       previousScore = { trust_score: legacyScoreRes.data?.score };
    } else {
       previousScore = modernScoreRes.data;
    }

    let analyses: any[] = [];
    if (isLegacy) {
       const legacyAnalysesRes = await supabase
         .from("reports")
         .select("id, ai_analysis(sentiment_score, extracted_risks)")
         .eq("company_id", employerId);
         
       if (legacyAnalysesRes.error) {
         return NextResponse.json({ error: "Failed to fetch legacy analyses" }, { status: 500 });
       }
       
       analyses = (legacyAnalysesRes.data || []).flatMap((r: any) => 
         r.ai_analysis ? r.ai_analysis.map((a: any) => ({
           severity: 3,
           sentiment: a.sentiment_score < 0 ? "negative" : a.sentiment_score > 0 ? "positive" : "neutral",
           issues_json: Array.isArray(a.extracted_risks) ? a.extracted_risks : [],
           summary: "Community report analysis",
         })) : []
       );
    } else {
       const modernAnalysesRes = await supabase
         .from("ai_analyses")
         .select("severity, sentiment, issues_json, summary")
         .eq("employer_id", employerId);
       
       if (modernAnalysesRes.error) {
         return NextResponse.json({ error: "Failed to fetch analyses" }, { status: 500 });
       }
       analyses = modernAnalysesRes.data || [];
    }

    if (!analyses || analyses.length === 0) {
      return NextResponse.json({ message: "No analyses found for this employer" });
    }

    const normalizedAnalyses: AnalysisRow[] = analyses.map((row) => ({
      severity: typeof row.severity === "number" ? row.severity : 3,
      sentiment:
        row.sentiment === "negative" || row.sentiment === "neutral" || row.sentiment === "positive"
          ? row.sentiment
          : "neutral",
      issues_json: Array.isArray(row.issues_json)
        ? row.issues_json.filter((item: any): item is string => typeof item === "string")
        : [],
      summary: typeof row.summary === "string" ? row.summary : "",
    }));

    const { trustScore, riskLevel, likelyScam } = calculateHeuristicScore(normalizedAnalyses);
    const riskBriefing = await generateAIBriefing(normalizedAnalyses, trustScore, riskLevel);

    if (isLegacy) {
      const { error: updateError } = await supabase
        .from("trust_scores")
        .upsert({
          company_id: employerId,
          score: trustScore,
          risk_level: riskLevel,
          risk_briefing: riskBriefing,
          last_updated: new Date().toISOString(),
        });
      if (updateError) throw updateError;
      
      if (likelyScam) {
         await supabase.from("scam_flags").insert({
           company_id: employerId,
           flag_reason: "Pattern analysis indicates possible scam behavior."
         });
      }
    } else {
      const { error: updateError } = await supabase
        .from("employer_scores")
        .upsert({
          employer_id: employerId,
          trust_score: trustScore,
          risk_level: riskLevel,
          risk_briefing: riskBriefing,
          report_count: analyses.length,
          updated_at: new Date().toISOString(),
        });

      if (updateError) throw updateError;

      await supabase.from("score_events").insert({
        employer_id: employerId,
        previous_score: previousScore?.trust_score ?? null,
        new_score: trustScore,
        reason_summary: `Aggregated ${analyses.length} reports with AI-synthesized briefing.`
      });

      if (likelyScam) {
        const { data: sourceReport } = await supabase
          .from("reports")
          .select("id")
          .eq("employer_id", employerId)
          .order("submitted_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sourceReport?.id) {
          await supabase.from("report_flags").insert({
            report_id: sourceReport.id,
            reason: "Pattern analysis indicates possible scam behavior.",
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      intelligence: {
        trust_score: trustScore,
        risk_level: riskLevel,
        risk_briefing: riskBriefing,
        report_count: analyses.length,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Intelligence Agent Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
