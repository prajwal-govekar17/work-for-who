-- WorkForWho Demo Seed Data
-- Provides a realistic set of employers and worker reports to showcase AI intelligence.

-- 1. Clear existing data (in order of dependencies)
TRUNCATE public.report_flags CASCADE;
TRUNCATE public.score_events CASCADE;
TRUNCATE public.employer_scores CASCADE;
TRUNCATE public.ai_analyses CASCADE;
TRUNCATE public.reports CASCADE;
TRUNCATE public.employer_aliases CASCADE;
TRUNCATE public.employers CASCADE;

-- 2. Seed Employers
INSERT INTO public.employers (id, canonical_name, location_city, location_area) VALUES
('e1000000-0000-0000-0000-000000000001', 'Star Logistics & Delivery', 'Mumbai', 'Andheri East'),
('e1000000-0000-0000-0000-000000000002', 'Modern Heights Construction', 'Bangalore', 'Whitefield'),
('e1000000-0000-0000-0000-000000000003', 'Apex Manpower Agency', 'Delhi', 'Okhla'),
('e1000000-0000-0000-0000-000000000004', 'Green Earth Landscaping', 'Pune', 'Baner');

-- 3. Seed Employer Aliases
INSERT INTO public.employer_aliases (employer_id, alias_name) VALUES
('e1000000-0000-0000-0000-000000000001', 'Star Logistics'),
('e1000000-0000-0000-0000-000000000001', 'Star Delivery'),
('e1000000-0000-0000-0000-000000000002', 'Modern Heights'),
('e1000000-0000-0000-0000-000000000003', 'Apex Agency'),
('e1000000-0000-0000-0000-000000000003', 'Apex Manpower');

-- 4. Seed Reports (Raw Worker Voices)
INSERT INTO public.reports (id, employer_id, raw_text, source_type, status, submitted_at) VALUES
-- Star Logistics (Mixed)
('r1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'Working with Star Logistics. Payment is usually on time but they make us work 14 hours without extra pay.', 'text', 'analyzed', NOW() - INTERVAL '10 days'),
('r1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 'Star delivery is okay. I get my money every week.', 'text', 'analyzed', NOW() - INTERVAL '5 days'),

-- Modern Heights (Risky - Safety)
('r1000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000002', 'The scaffolding at Modern Heights site in Whitefield is very loose. I told the supervisor but he just yelled at me. Very dangerous.', 'text', 'analyzed', NOW() - INTERVAL '2 days'),
('r1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000002', 'No safety gloves or boots provided at Modern Heights. Two people got hurt last week.', 'text', 'analyzed', NOW() - INTERVAL '1 day'),

-- Apex Manpower (Scam)
('r1000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000003', 'Apex Manpower asked me for 5000 rupees for registration fee. They promised a job in a big factory but then they stopped picking up my calls. Total scam.', 'text', 'analyzed', NOW() - INTERVAL '15 days'),
('r1000000-0000-0000-0000-000000000006', 'e1000000-0000-0000-0000-000000000003', 'They took my original Aadhaar card and said they will give it back after one week. Now they are demanding money to return it.', 'text', 'analyzed', NOW() - INTERVAL '7 days'),

-- Green Earth (Good)
('r1000000-0000-0000-0000-000000000007', 'e1000000-0000-0000-0000-000000000004', 'Good company. They pay daily and provide lunch. Manager is very kind.', 'text', 'analyzed', NOW() - INTERVAL '20 days');

-- 5. Seed AI Analyses
INSERT INTO public.ai_analyses (report_id, employer_id, issues_json, sentiment, severity, summary, prompt_version, model) VALUES
('r1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', '["unpaid_overtime", "excessive_hours"]', 'negative', 3, 'Worker reports 14-hour shifts without overtime compensation.', 'v1', 'gemini-1.5-flash'),
('r1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', '[]', 'positive', 1, 'Worker reports consistent weekly payments.', 'v1', 'gemini-1.5-flash'),
('r1000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000002', '["unsafe_conditions", "verbal_abuse"]', 'negative', 4, 'Reports of unstable scaffolding and hostile management regarding safety concerns.', 'v1', 'gemini-1.5-flash'),
('r1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000002', '["unsafe_conditions", "missing_equipment"]', 'negative', 5, 'Failure to provide safety gear resulting in worker injuries.', 'v1', 'gemini-1.5-flash'),
('r1000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000003', '["scam", "upfront_fees"]', 'negative', 5, 'Agency charging illegal registration fees for non-existent jobs.', 'v1', 'gemini-1.5-flash'),
('r1000000-0000-0000-0000-000000000006', 'e1000000-0000-0000-0000-000000000003', '["document_withholding", "extortion"]', 'negative', 5, 'Withholding official identification documents to extort money from workers.', 'v1', 'gemini-1.5-flash'),
('r1000000-0000-0000-0000-000000000007', 'e1000000-0000-0000-0000-000000000004', '[]', 'positive', 1, 'Positive feedback regarding daily pay and work environment.', 'v1', 'gemini-1.5-flash');

-- 6. Seed Employer Scores
INSERT INTO public.employer_scores (employer_id, trust_score, risk_level, risk_briefing, report_count) VALUES
('e1000000-0000-0000-0000-000000000001', 75, 'medium', 'Generally reliable payment history, but multiple workers report excessive 14-hour shifts without overtime pay.', 2),
('e1000000-0000-0000-0000-000000000002', 35, 'high', 'Critical safety warning. Frequent reports of unstable scaffolding and lack of basic safety equipment (gloves, boots). Multiple injuries reported in the last week.', 2),
('e1000000-0000-0000-0000-000000000003', 10, 'high', 'Extreme risk. Community alerts indicate this agency is a scam, charging illegal fees and withholding original identity documents to extort workers.', 2),
('e1000000-0000-0000-0000-000000000004', 98, 'low', 'Highly recommended. Workers report daily payments, provided meals, and respectful management.', 1);

-- 7. Seed Score Events (Audit Trail)
INSERT INTO public.score_events (employer_id, previous_score, new_score, reason_summary) VALUES
('e1000000-0000-0000-0000-000000000001', 100, 75, 'Initial aggregation of reports showing overtime issues.'),
('e1000000-0000-0000-0000-000000000002', 100, 35, 'Multiple high-severity safety violations reported.'),
('e1000000-0000-0000-0000-000000000003', 100, 10, 'Confirmed scam patterns including document withholding.'),
('e1000000-0000-0000-0000-000000000004', 100, 98, 'Consistent positive worker sentiment.');

-- 8. Seed Report Flags
INSERT INTO public.report_flags (report_id, reason) VALUES
('r1000000-0000-0000-0000-000000000005', 'Pattern analysis indicates definite scam behavior.'),
('r1000000-0000-0000-0000-000000000006', 'Critical document withholding reported.');
