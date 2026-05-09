# Local Worker Shield

AI-powered worker trust infrastructure for informal labor markets.

## Core Loop
1. **Report:** Worker submits a text/voice report anonymously.
2. **Analyze (Intake Agent):** Gemini extracts risk signals (salary delay, safety, etc.) and sentiment.
3. **Cluster (Intelligence Agent):** Gemini aggregates reports for an employer, updates the Trust Score, and generates a plain-language Risk Briefing.
4. **Warn:** Future workers search for the employer and see the AI-generated warnings and trust score.

## Tech Stack
- **Frontend:** Next.js 15 (App Router)
- **Database/Auth:** Supabase
- **AI:** Google Gemini 1.5 Flash

## Setup
1. `npm install`
2. Copy `.env.example` to `.env.local`.
3. Configure AI auth (choose one):
   - **API key mode (fastest):** set `GEMINI_API_KEY`
   - **Vertex mode (Google Cloud credits):** set `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION`, then configure local Google auth (`GOOGLE_APPLICATION_CREDENTIALS` or ADC).
4. Apply the SQL schema in `supabase/migrations/` and `supabase/seed.sql` to your Supabase project.
5. `npm run dev`

## AI Agents
- **Intake Agent:** `/api/ai/intake`
- **Risk Intelligence Agent:** `/api/ai/intelligence`
