import { createClient } from "@supabase/supabase-js";


const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase
      .from("reports")
      .select("id, raw_text, content_text, status")
      .limit(1)
      .single();
  console.log("Modern error:", JSON.stringify(error, null, 2));

  const { data: legacyData, error: legacyError } = await supabase
         .from("reports")
         .select("id, content_text")
         .limit(1)
         .single();
  console.log("Legacy error:", JSON.stringify(legacyError, null, 2));
}

run();
