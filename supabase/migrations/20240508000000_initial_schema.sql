-- Initial Schema for Local Worker Shield

-- 1. Users Table (Extensions for Supabase Auth)
-- Note: Supabase auth.users is handled by Supabase. 
-- We'll create a public.profiles/users table if needed, but for anonymous workers, 
-- we might just rely on auth.uid() in other tables.
-- For this MVP, let's create a public.users table to store user roles.

CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    role TEXT DEFAULT 'worker' CHECK (role IN ('worker', 'admin'))
);

-- 2. Companies Table
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    phone_number TEXT,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Reports Table
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users ON DELETE SET NULL,
    content_text TEXT,
    audio_url TEXT,
    language TEXT DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. AI Analysis Table
CREATE TABLE IF NOT EXISTS public.ai_analysis (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE NOT NULL,
    extracted_risks JSONB DEFAULT '[]'::jsonb,
    sentiment_score FLOAT,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. Trust Scores Table
CREATE TABLE IF NOT EXISTS public.trust_scores (
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE PRIMARY KEY,
    score INT DEFAULT 100 CHECK (score >= 0 AND score <= 100),
    risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
    risk_briefing TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. Scam Flags Table
CREATE TABLE IF NOT EXISTS public.scam_flags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    flag_reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scam_flags ENABLE ROW LEVEL SECURITY;

-- Basic Policies (Allow reading for all, writing for auth users)
CREATE POLICY "Allow public read on companies" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Allow public read on reports" ON public.reports FOR SELECT USING (true);
CREATE POLICY "Allow public read on ai_analysis" ON public.ai_analysis FOR SELECT USING (true);
CREATE POLICY "Allow public read on trust_scores" ON public.trust_scores FOR SELECT USING (true);
CREATE POLICY "Allow public read on scam_flags" ON public.scam_flags FOR SELECT USING (true);

-- Workers can submit reports
CREATE POLICY "Allow auth users to submit reports" ON public.reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');
