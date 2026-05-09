import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createReportSchema } from "@/lib/validation/reports";
import type { Report } from "@/types";
import { agentDebugLog } from "@/lib/debug/agent-log";

export const runtime = "nodejs";

function isSchemaColumnMismatch(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    (typeof error.message === "string" && error.message.includes("schema cache"))
  );
}

/** Initial-schema reports: company_id NOT NULL, no raw_text / moderation_state. */
async function insertReportLegacySchema(
  supabase: any,
  raw_text: string,
  audio_url: string | null | undefined,
  language: string
) {
  const { data: existingCo } = await supabase
    .from("companies")
    .select("id")
    .limit(1)
    .maybeSingle();

  let companyId = existingCo?.id as string | undefined;
  if (!companyId) {
    const { data: createdCo, error: coErr } = await supabase
      .from("companies")
      .insert({
        name: "Community (default bucket)",
        location: null,
      })
      .select("id")
      .single();
    if (coErr || !createdCo) {
      throw new Error(coErr?.message ?? "Could not create default company row.");
    }
    companyId = createdCo.id as string;
  }

  return supabase
    .from("reports")
    .insert({
      company_id: companyId,
      content_text: raw_text,
      audio_url: audio_url ?? null,
      language,
    })
    .select()
    .single();
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const result = createReportSchema.safeParse(json);

    if (!result.success) {
      // #region agent log
      fetch("http://127.0.0.1:7595/ingest/dd77c218-13bd-4935-aeff-5c0091352e05", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e7e89f" },
        body: JSON.stringify({
          sessionId: "e7e89f",
          runId: "pre-fix",
          hypothesisId: "E",
          location: "api/reports/route.ts:validation",
          message: "createReportSchema failed",
          data: { issues: result.error.issues.map((i) => i.message) },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      agentDebugLog({
        sessionId: "e7e89f",
        runId: "post-fix",
        hypothesisId: "E",
        location: "api/reports/route.ts:validation",
        message: "createReportSchema failed",
        data: { issues: result.error.issues.map((i) => i.message) },
      });
      // #endregion
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const { raw_text, source_type, audio_url, language } = result.data;

    if (source_type === "audio" && !audio_url) {
      return NextResponse.json(
        { error: "Audio reports must include an audio URL." },
        { status: 400 }
      );
    }

    let supabase: Awaited<ReturnType<typeof createClient>>;
    let insertRole: "service_role" | "anon" = "anon";
    try {
      supabase = createServiceRoleClient();
      insertRole = "service_role";
    } catch {
      supabase = await createClient();
      insertRole = "anon";
    }

    // #region agent log
    const envProbe = {
      hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      insertRole,
    };
    fetch("http://127.0.0.1:7595/ingest/dd77c218-13bd-4935-aeff-5c0091352e05", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e7e89f" },
      body: JSON.stringify({
        sessionId: "e7e89f",
        runId: "post-fix",
        hypothesisId: "A_D",
        location: "api/reports/route.ts:beforeInsert",
        message: "supabase client for insert",
        data: envProbe,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    agentDebugLog({
      sessionId: "e7e89f",
      runId: "post-fix",
      hypothesisId: "A_D",
      location: "api/reports/route.ts:beforeInsert",
      message: "supabase client for insert",
      data: envProbe,
    });
    // #endregion

    const modernPayload = {
      source_type,
      raw_text,
      content_text: raw_text,
      audio_url,
      language,
      status: "new",
      moderation_state: "clean",
    };

    const first = await supabase.from("reports").insert(modernPayload).select().single();
    let data = first.data as Record<string, unknown> | null;
    let error = first.error;

    if (error && isSchemaColumnMismatch(error)) {
      try {
        agentDebugLog({
          sessionId: "e7e89f",
          runId: "post-fix",
          hypothesisId: "C",
          location: "api/reports/route.ts:legacyFallback",
          message: "modern insert failed schema cache; retrying legacy reports shape",
          data: { code: error.code, message: error.message, insertRole },
        });
        const legacy = await insertReportLegacySchema(supabase, raw_text, audio_url, language);
        data = legacy.data as Record<string, unknown> | null;
        error = legacy.error;
      } catch (legacyErr) {
        const msg = legacyErr instanceof Error ? legacyErr.message : "Legacy insert unavailable.";
        agentDebugLog({
          sessionId: "e7e89f",
          runId: "post-fix",
          hypothesisId: "D",
          location: "api/reports/route.ts:legacyFallbackFailed",
          message: msg,
          data: {},
        });
        error = {
          code: "LEGACY_UNAVAILABLE",
          message: msg,
          details: null,
          hint: null,
        } as unknown as NonNullable<typeof error>;
        data = null;
      }
    }

    if (error) {
      console.error("Failed to create report:", error);
      const errPayload = {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        insertRole,
      };
      // #region agent log
      fetch("http://127.0.0.1:7595/ingest/dd77c218-13bd-4935-aeff-5c0091352e05", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e7e89f" },
        body: JSON.stringify({
          sessionId: "e7e89f",
          runId: "post-fix",
          hypothesisId: "C_D",
          location: "api/reports/route.ts:insertError",
          message: "supabase reports insert failed",
          data: errPayload,
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      agentDebugLog({
        sessionId: "e7e89f",
        runId: "post-fix",
        hypothesisId: "C_D",
        location: "api/reports/route.ts:insertError",
        message: "supabase reports insert failed",
        data: errPayload,
      });
      // #endregion
      return NextResponse.json({ error: "Failed to save report." }, { status: 500 });
    }

    agentDebugLog({
      sessionId: "e7e89f",
      runId: "post-fix",
      hypothesisId: "C",
      location: "api/reports/route.ts:insertOk",
      message: "report saved",
      data: { reportId: data?.id, hasRawText: Boolean(data && "raw_text" in data) },
    });

    return NextResponse.json({ success: true, report: data as Report }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("POST /api/reports failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
