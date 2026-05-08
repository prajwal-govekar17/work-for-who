import { createClient } from "@/lib/supabase/server";
import { model } from "@/lib/ai/gemini";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { reportId } = await req.json();
    const supabase = await createClient();

    // 1. Fetch the report
    const { data: report, error: fetchError } = await supabase
      .from("reports")
      .select("*")
      .eq("id", reportId)
      .single();

    if (fetchError || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // 2. Analyze with Gemini
    const prompt = `
      You are a Risk Intake Agent for an informal labor market trust system.
      Analyze the following worker report and extract risk signals.
      
      Report Content: "${report.content_text}"
      
      Extract:
      - Risk Signals: (e.g., salary_delay, unsafe_conditions, scam_behavior, verbal_abuse)
      - Sentiment Score: (-1.0 to 1.0, where -1.0 is highly negative/risky)
      
      Return ONLY a JSON object:
      {
        "risk_signals": ["signal1", "signal2"],
        "sentiment_score": -0.8,
        "summary": "Short plain-language summary of the issue"
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean up potential markdown formatting from Gemini
    const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const analysis = JSON.parse(jsonString);

    // 3. Save to ai_analysis
    const { error: insertError } = await supabase.from("ai_analysis").insert({
      report_id: report.id,
      extracted_risks: analysis.risk_signals,
      sentiment_score: analysis.sentiment_score,
    });

    if (insertError) {
      console.error("Error saving AI analysis:", insertError);
      return NextResponse.json({ error: "Failed to save analysis" }, { status: 500 });
    }

    return NextResponse.json({ success: true, analysis });
  } catch (err: any) {
    console.error("Intake Agent Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
