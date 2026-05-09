-- Phase 1 migration: trust-intelligence MVP schema
-- This migration evolves the project from company-centric reports
-- to an intake -> AI analysis -> employer intelligence flow.

-- 1) Employers and aliases
CREATE TABLE IF NOT EXISTS public.employers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    canonical_name TEXT NOT NULL,
    location_city TEXT,
    location_area TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_seen_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS employers_canonical_name_idx
ON public.employers (lower(canonical_name));

CREATE TABLE IF NOT EXISTS public.employer_aliases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_id UUID REFERENCES public.employers(id) ON DELETE CASCADE NOT NULL,
    alias_name TEXT NOT NULL,
    confidence NUMERIC(4,3) DEFAULT 1.000 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS employer_aliases_alias_name_idx
ON public.employer_aliases (lower(alias_name));

-- 2) Evolve reports table for anonymous intake lifecycle
ALTER TABLE public.reports
    ALTER COLUMN company_id DROP NOT NULL;

ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'text' CHECK (source_type IN ('text', 'audio')),
    ADD COLUMN IF NOT EXISTS raw_text TEXT,
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new' CHECK (status IN ('new', 'analyzed', 'needs_review')),
    ADD COLUMN IF NOT EXISTS moderation_state TEXT DEFAULT 'clean' CHECK (moderation_state IN ('clean', 'flagged')),
    ADD COLUMN IF NOT EXISTS employer_id UUID REFERENCES public.employers(id) ON DELETE SET NULL;

UPDATE public.reports
SET raw_text = COALESCE(raw_text, content_text);

ALTER TABLE public.reports
    ALTER COLUMN raw_text SET NOT NULL;

CREATE INDEX IF NOT EXISTS reports_status_idx ON public.reports (status);
CREATE INDEX IF NOT EXISTS reports_employer_id_idx ON public.reports (employer_id);

-- 3) Structured AI analyses (traceable, prompt-versioned)
CREATE TABLE IF NOT EXISTS public.ai_analyses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE NOT NULL UNIQUE,
    employer_id UUID REFERENCES public.employers(id) ON DELETE SET NULL,
    issues_json JSONB DEFAULT '[]'::jsonb NOT NULL,
    sentiment TEXT DEFAULT 'neutral' CHECK (sentiment IN ('negative', 'neutral', 'positive')),
    severity INT DEFAULT 3 CHECK (severity BETWEEN 1 AND 5),
    summary TEXT DEFAULT '' NOT NULL,
    prompt_version TEXT NOT NULL,
    model TEXT NOT NULL,
    raw_model_output JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS ai_analyses_employer_id_idx ON public.ai_analyses (employer_id);

-- 4) Employer score snapshots + score audit events
CREATE TABLE IF NOT EXISTS public.employer_scores (
    employer_id UUID REFERENCES public.employers(id) ON DELETE CASCADE PRIMARY KEY,
    trust_score INT DEFAULT 100 CHECK (trust_score BETWEEN 0 AND 100),
    risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
    risk_briefing TEXT DEFAULT '' NOT NULL,
    report_count INT DEFAULT 0 NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.score_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_id UUID REFERENCES public.employers(id) ON DELETE CASCADE NOT NULL,
    previous_score INT,
    new_score INT NOT NULL,
    reason_summary TEXT DEFAULT '' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5) Basic moderation flags for safety/polish phase
CREATE TABLE IF NOT EXISTS public.report_flags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6) RLS and public-friendly MVP policies
ALTER TABLE public.employers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insert on reports" ON public.reports;
CREATE POLICY "Allow public insert on reports"
ON public.reports FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read on reports" ON public.reports;
CREATE POLICY "Allow public read on reports"
ON public.reports FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow public read on employers" ON public.employers;
CREATE POLICY "Allow public read on employers"
ON public.employers FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow service role write on employers" ON public.employers;
CREATE POLICY "Allow service role write on employers"
ON public.employers FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Allow public read on employer_aliases" ON public.employer_aliases;
CREATE POLICY "Allow public read on employer_aliases"
ON public.employer_aliases FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow service role write on employer_aliases" ON public.employer_aliases;
CREATE POLICY "Allow service role write on employer_aliases"
ON public.employer_aliases FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Allow public read on ai_analyses" ON public.ai_analyses;
CREATE POLICY "Allow public read on ai_analyses"
ON public.ai_analyses FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow service role write on ai_analyses" ON public.ai_analyses;
CREATE POLICY "Allow service role write on ai_analyses"
ON public.ai_analyses FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Allow public read on employer_scores" ON public.employer_scores;
CREATE POLICY "Allow public read on employer_scores"
ON public.employer_scores FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow service role write on employer_scores" ON public.employer_scores;
CREATE POLICY "Allow service role write on employer_scores"
ON public.employer_scores FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Allow public read on score_events" ON public.score_events;
CREATE POLICY "Allow public read on score_events"
ON public.score_events FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow service role write on score_events" ON public.score_events;
CREATE POLICY "Allow service role write on score_events"
ON public.score_events FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Allow public read on report_flags" ON public.report_flags;
CREATE POLICY "Allow public read on report_flags"
ON public.report_flags FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow service role write on report_flags" ON public.report_flags;
CREATE POLICY "Allow service role write on report_flags"
ON public.report_flags FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
