-- Lock Foundation: Consolidate and refine schema for WorkForWho MVP

-- 1. Cleanup redundant tables from early drafts
DROP TABLE IF EXISTS public.scam_flags CASCADE;
DROP TABLE IF EXISTS public.trust_scores CASCADE;
DROP TABLE IF EXISTS public.ai_analysis CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;
DROP TABLE IF EXISTS public.users CASCADE; -- Relying on auth.users and role-based RLS for now

-- 2. Core Entities

-- Employers (Canonical records)
CREATE TABLE IF NOT EXISTS public.employers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    canonical_name TEXT NOT NULL,
    location_city TEXT,
    location_area TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_seen_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS employers_canonical_name_idx ON public.employers (lower(canonical_name));

-- Employer Aliases (Deduplication support)
CREATE TABLE IF NOT EXISTS public.employer_aliases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_id UUID REFERENCES public.employers(id) ON DELETE CASCADE NOT NULL,
    alias_name TEXT NOT NULL,
    confidence NUMERIC(4,3) DEFAULT 1.000 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS employer_aliases_alias_name_idx ON public.employer_aliases (lower(alias_name));

-- Reports (Raw worker submissions)
-- Note: Re-creating or Altering to ensure exact structure
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_id UUID REFERENCES public.employers(id) ON DELETE SET NULL,
    source_type TEXT DEFAULT 'text' CHECK (source_type IN ('text', 'audio')) NOT NULL,
    raw_text TEXT NOT NULL,
    audio_url TEXT,
    language TEXT DEFAULT 'en' NOT NULL,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'analyzed', 'needs_review')) NOT NULL,
    moderation_state TEXT DEFAULT 'clean' CHECK (moderation_state IN ('clean', 'flagged')) NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS reports_status_idx ON public.reports (status);
CREATE INDEX IF NOT EXISTS reports_employer_id_idx ON public.reports (employer_id);

-- AI Analyses (Structured extraction per report)
CREATE TABLE IF NOT EXISTS public.ai_analyses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE NOT NULL UNIQUE,
    employer_id UUID REFERENCES public.employers(id) ON DELETE SET NULL,
    issues_json JSONB DEFAULT '[]'::jsonb NOT NULL,
    sentiment TEXT DEFAULT 'neutral' CHECK (sentiment IN ('negative', 'neutral', 'positive')) NOT NULL,
    severity INT DEFAULT 3 CHECK (severity BETWEEN 1 AND 5) NOT NULL,
    summary TEXT DEFAULT '' NOT NULL,
    prompt_version TEXT NOT NULL,
    model TEXT NOT NULL,
    raw_model_output JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS ai_analyses_employer_id_idx ON public.ai_analyses (employer_id);

-- Employer Scores (Trust snapshot)
CREATE TABLE IF NOT EXISTS public.employer_scores (
    employer_id UUID REFERENCES public.employers(id) ON DELETE CASCADE PRIMARY KEY,
    trust_score INT DEFAULT 100 CHECK (trust_score BETWEEN 0 AND 100) NOT NULL,
    risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')) NOT NULL,
    risk_briefing TEXT DEFAULT '' NOT NULL,
    report_count INT DEFAULT 0 NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Score Events (Audit trail)
CREATE TABLE IF NOT EXISTS public.score_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employer_id UUID REFERENCES public.employers(id) ON DELETE CASCADE NOT NULL,
    previous_score INT,
    new_score INT NOT NULL,
    reason_summary TEXT DEFAULT '' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Report Flags (Moderation)
CREATE TABLE IF NOT EXISTS public.report_flags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Security (RLS)
ALTER TABLE public.employers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_flags ENABLE ROW LEVEL SECURITY;

-- Public read access for everything in MVP (except potentially raw AI output if sensitive, but for now allowed)
CREATE POLICY "Public Read Access" ON public.employers FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON public.employer_aliases FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON public.reports FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON public.ai_analyses FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON public.employer_scores FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON public.score_events FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON public.report_flags FOR SELECT USING (true);

-- Public insert for reports (anonymous intake)
CREATE POLICY "Public Insert Reports" ON public.reports FOR INSERT WITH CHECK (true);

-- Service role bypass for system updates
CREATE POLICY "Service Role All Access" ON public.employers FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service Role All Access" ON public.employer_aliases FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service Role All Access" ON public.reports FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service Role All Access" ON public.ai_analyses FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service Role All Access" ON public.employer_scores FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service Role All Access" ON public.score_events FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service Role All Access" ON public.report_flags FOR ALL USING (auth.role() = 'service_role');
