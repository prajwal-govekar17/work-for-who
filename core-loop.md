# Core Loop: WorkForWho

The engine that drives the platform's intelligence.

1. **Intake (Capture):**
   - Worker submits a report (Voice Note or Text).
   - Data is stored in Supabase `reports` table.

2. **Extraction (Intake Agent):**
   - Gemini 1.5 Flash processes the report.
   - Identifies: Entity name, Location, Issues (Salary delay, Safety, Scam, etc.), and Sentiment.
   - Stores structured results in `ai_analysis`.

3. **Aggregation (Intelligence Agent):**
   - Aggregates all analyses for a specific Company.
   - Calculates/Updates the `trust_score`.
   - Generates a "Risk Briefing" (plain-language summary of common issues).

4. **Warning (Distribution):**
   - Future workers search for an employer before taking a job.
   - They see the Trust Score, Risk Briefing, and recent flags.
