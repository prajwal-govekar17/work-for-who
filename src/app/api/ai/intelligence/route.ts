import { createClient } from "@/lib/supabase/server";
import { model } from "@/lib/ai/gemini";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { companyId } = await req.json();
    const supabase = await createClient();

    // 1. Fetch all AI analyses for this company
    const { data: analyses, error: fetchError } = await supabase
      .from("ai_analysis")
      .select("*, reports!inner(company_id)")
      .eq("reports.company_id", companyId);

    if (fetchError) {
      return NextResponse.json({ error: "Failed to fetch analyses" }, { status: 500 });
    }

    if (!analyses || analyses.length === 0) {
      return NextResponse.json({ message: "No analyses found for this company" });
    }

    // 2. Aggregate and calculate with Gemini
    const analysisContext = analyses.map(a => ({
      risks: a.extracted_risks,
      sentiment: a.sentiment_score
    }));

    const prompt = `
      You are a Risk Intelligence Agent. 
      You have received multiple AI-extracted risk reports for a single employer.
      
      Reports Context: ${JSON.stringify(analysisContext)}
      
      Your task:
      1. Calculate a Trust Score (0-100). Start at 100 and deduct based on frequency and severity of risks.
      2. Determine Risk Level (low, medium, high).
      3. Generate a "Risk Briefing": A single concise paragraph warning future workers about patterns (e.g., "Multiple reports of salary delays across 3 months").
      4. Detect Scams: If you see repeated signals of fake listings or upfront payment requests, suggest a scam flag.
      
      Return ONLY a JSON object:
      {
        "score": 45,
        "risk_level": "medium",
        "briefing": "Workers have reported inconsistent payments and safety issues in recent months.",
        "scam_flag": "Potential fake job pattern detected" | null
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const intelligence = JSON.parse(jsonString);

    // 3. Update trust_scores
    const { error: updateError } = await supabase
      .from("trust_scores")
      .upsert({
        company_id: companyId,
        score: intelligence.score,
        risk_level: intelligence.risk_level,
        risk_briefing: intelligence.briefing,
        last_updated: new Date().toISOString()
      });

    if (updateError) throw updateError;

    // 4. Add scam flag if detected
    if (intelligence.scam_flag) {
      await supabase.from("scam_flags").insert({
        company_id: companyId,
        flag_reason: intelligence.scam_flag
      });
    }

    // Store the briefing in trust_scores (we need to add a column or use a separate table, 
    // for MVP let's assume we can just output it or we'll add it to the schema now).
    // Let's quickly add a column 'risk_briefing' to trust_scores in a new migration? 
    // Or just re-run the initial one if it's not live yet.
    // I'll just update the trust_scores table in the next step.

    return NextResponse.json({ success: true, intelligence });
  } catch (err: any) {
    console.error("Intelligence Agent Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
