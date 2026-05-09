-- Ensure anonymous workers can submit reports with the anon key (no login).
-- Safe to run after initial_schema.sql even if 20240508000001 already ran.

ALTER TABLE public.reports
    ALTER COLUMN company_id DROP NOT NULL;

ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'text',
    ADD COLUMN IF NOT EXISTS raw_text TEXT,
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new',
    ADD COLUMN IF NOT EXISTS moderation_state TEXT DEFAULT 'clean';

UPDATE public.reports
SET raw_text = COALESCE(raw_text, content_text)
WHERE raw_text IS NULL AND content_text IS NOT NULL;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow auth users to submit reports" ON public.reports;
DROP POLICY IF EXISTS "Allow public insert on reports" ON public.reports;

CREATE POLICY "Allow public insert on reports"
ON public.reports FOR INSERT
WITH CHECK (true);
