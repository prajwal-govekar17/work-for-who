import fs from "fs";
import os from "os";
import path from "path";

/** Append one NDJSON line for debug sessions (server-only). */
export function agentDebugLog(payload: Record<string, unknown>) {
  const line = JSON.stringify({ ...payload, timestamp: Date.now() }) + "\n";
  const primary = path.join(process.cwd(), "debug-e7e89f.log");
  const fallback = path.join(os.tmpdir(), "workforwho-debug-e7e89f.log");
  try {
    fs.appendFileSync(primary, line, "utf8");
  } catch {
    try {
      fs.appendFileSync(fallback, line, "utf8");
    } catch {
      // ignore
    }
  }
}
