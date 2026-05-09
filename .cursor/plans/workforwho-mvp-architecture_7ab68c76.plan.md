---
name: workforwho-mvp-architecture
overview: "Define a modular, hackathon-realistic MVP architecture for WorkForWho focused on employer trust intelligence: report intake, AI structuring, aggregation, and worker-facing warnings."
todos:
  - id: finalize-data-model
    content: Lock minimal MVP entities and migration constraints for reports, employers, aliases, ai_analyses, and employer_scores.
    status: completed
  - id: build-intake-flow
    content: Implement report intake path end-to-end (UI, storage reference, reports API, status lifecycle).
    status: completed
  - id: ship-ai-pipeline
    content: Implement intake extraction and intelligence aggregation APIs with schema validation and fallback states.
    status: completed
  - id: ship-discovery
    content: Implement employer search/detail and recent warnings worker-facing views based on score snapshots.
    status: completed
  - id: harden-privacy-and-quality
    content: Add anonymity protections, basic moderation flags, and end-to-end smoke validation for the full loop.
    status: in_progress
isProject: false
---

# WorkForWho MVP Architecture & Execution Plan

## Current Architecture (as documented)

- Product shape: AI-powered employer trust intelligence for informal workers, with anonymity and accessibility as first principles.
- Core flow is clear and already aligned across docs:
  - Intake: anonymous text/voice report submission.
  - AI extraction: `POST /api/ai/intake` (Gemini 1.5 Flash) parses raw report into structured risk signals.
  - Aggregation: `POST /api/ai/intelligence` updates employer trust score and generates risk briefing.
  - Distribution: employer search/detail views expose trust score + warnings before workers accept jobs.
- Tech baseline is appropriate for hackathon MVP:
  - Next.js 15 App Router frontend/API
  - Supabase for DB/Auth/Storage
  - Gemini 1.5 Flash for extraction + intelligence summarization
- Architectural constraints are healthy:
  - Keep serverless AI in API routes
  - Keep prompts versioned in code
  - Use structured JSON outputs
  - Preserve traceability from AI output to raw input

## Core Entities (minimum viable data model)

Use this as the canonical MVP entity set (small, extensible, non-overengineered):

- `reports`
  - Purpose: immutable raw worker submissions (text + optional audio path + language)
  - Key fields: `id`, `submitted_at`, `source_type` (`text|audio`), `raw_text`, `audio_url`, `language`, `status` (`new|analyzed|needs_review`)
- `employers`
  - Purpose: normalized employer records used in search/discovery
  - Key fields: `id`, `canonical_name`, `location_city`, `location_area`, `created_at`, `last_seen_at`
- `employer_aliases`
  - Purpose: lightweight dedup support (e.g., "XYZ Const" -> canonical employer)
  - Key fields: `id`, `employer_id`, `alias_name`, `confidence`
- `ai_analyses`
  - Purpose: structured extraction per report (traceable)
  - Key fields: `id`, `report_id`, `employer_id` (nullable if unresolved), `issues_json`, `sentiment`, `severity`, `prompt_version`, `model`, `raw_model_output`, `created_at`
- `employer_scores`
  - Purpose: current trust score snapshot for fast reads
  - Key fields: `employer_id`, `trust_score` (0-100), `risk_level`, `risk_briefing`, `report_count`, `updated_at`
- `score_events` (optional but recommended)
  - Purpose: minimal audit of score transitions for explainability
  - Key fields: `id`, `employer_id`, `previous_score`, `new_score`, `reason_summary`, `created_at`

## API Surface (MVP routes)

Keep API minimal and directly tied to core loop.

- `POST /api/reports`
  - Accepts worker report metadata and text/audio reference
  - Creates `reports` row with `status=new`
- `POST /api/ai/intake`
  - Input: `report_id`
  - Pulls raw report, calls Gemini with strict JSON schema, upserts `ai_analyses`
  - Sets `reports.status=analyzed` or `needs_review` if unresolved employer
- `POST /api/ai/intelligence`
  - Input: `employer_id` (or derive from report)
  - Aggregates analyses, updates `employer_scores`, writes optional `score_events`
- `GET /api/employers/search?q=`
  - Returns canonical employers + score/risk snapshot
- `GET /api/employers/:id`
  - Returns employer profile, trust score, risk briefing, recent issue trends
- `GET /api/warnings/recent`
  - Feed-style recent high-risk employer updates

## Workflow Boundaries (what is in/out for MVP)

In scope:

- Anonymous intake (text + optional voice file upload path)
- Deterministic AI extraction to structured schema
- Basic employer canonicalization (alias table + string normalization)
- Simple trust scoring and plain-language risk briefing
- Search + employer detail + recent warnings

Out of scope (defer):

- Full-blown identity/reputation systems for workers
- Complex graph/entity-resolution pipelines
- Real-time streaming analytics/event buses
- Multi-tenant employer dashboards
- Heavy moderation queues beyond basic `needs_review`

## Best MVP Implementation Order

1. Data foundation first
   - Finalize migration for `reports`, `employers`, `employer_aliases`, `ai_analyses`, `employer_scores`
   - Add strict constraints and indexes only where immediately needed (search/name, foreign keys)
2. Intake reliability second
   - Build `POST /api/reports` + mobile-first report form
   - Ensure audio storage path works and raw payload is always persisted before AI call
3. AI extraction third
   - Implement `POST /api/ai/intake` with prompt versioning + schema validation + fallback to `needs_review`
4. Intelligence aggregation fourth
   - Implement `POST /api/ai/intelligence` with simple, explainable scoring formula
   - Generate concise risk briefing from aggregated issues
5. Worker discovery fifth
   - Implement search endpoint + employer detail + recent warnings feed
   - Keep UI lean and readable on low-end devices
6. Safety/polish last
   - Privacy checks, RLS for anonymity, basic moderation flags, end-to-end smoke tests

## Overengineering Risks To Avoid

- Premature microservices/event-driven split for intake vs scoring
- Deep ML clustering when alias normalization solves 80% now
- Overly complex scoring (weighted temporal Bayesian models) for first release
- Building multilingual orchestration pipeline before core English loop is stable
- Adding employer-side product surfaces before worker-side trust utility is proven

## Engineering Risks & Mitigations

- AI extraction inconsistency
  - Mitigate with strict JSON schema validation and reject/repair pass
- Entity ambiguity (same employer, many names)
  - Mitigate with canonical employer + alias table and manual merge path later
- False confidence in trust score
  - Mitigate with transparent risk factors + report count context
- Privacy leakage
  - Mitigate with no worker PII in public reads, strict RLS, and redact before display
- Latency/cost spikes from repeated AI calls
  - Mitigate with idempotent intake/intelligence endpoints and cached score snapshots

## Modular-But-Simple Architecture Notes

- Keep only three backend modules initially:
  - Intake module (`reports` + `/api/reports` + `/api/ai/intake`)
  - Intelligence module (`ai_analyses` aggregation + `/api/ai/intelligence`)
  - Discovery module (`search/detail/warnings` read APIs)
- Keep UI thin: forms + list/detail pages; no heavy client state management.
- Keep AI prompts in versioned files and return `prompt_version` with every analysis row.

## Files To Prioritize Next (once approved)

- [README.md](C:/Users/prajw/Desktop/WorkForWHo/README.md)
- [plan.md](C:/Users/prajw/Desktop/WorkForWHo/plan.md)
- [tasks.md](C:/Users/prajw/Desktop/WorkForWHo/tasks.md)
- [core-loop.md](C:/Users/prajw/Desktop/WorkForWHo/core-loop.md)
- [rules.md](C:/Users/prajw/Desktop/WorkForWHo/rules.md)

## Acceptance Criteria For MVP Completion

- Worker can submit a report in <60 seconds on mobile.
- New report produces structured `ai_analyses` or lands in `needs_review` safely.
- Employer trust score updates after new analyses.
- Worker can search employer and view trust score + risk briefing + recent flags.
- Public surfaces reveal no worker identity or sensitive report-origin metadata.
