-- Seed data for companies
INSERT INTO public.companies (name, phone_number, location) VALUES
('City Construction Group', '+91 98765 43210', 'Mumbai, Maharashtra'),
('Green Valley Retail', '+91 87654 32109', 'Bangalore, Karnataka'),
('Reliable Delivery Services', '+91 76543 21098', 'Delhi, NCR'),
('Quick Fix Solutions', '+91 65432 10987', 'Chennai, Tamil Nadu');

-- Initial trust scores
INSERT INTO public.trust_scores (company_id, score, risk_level)
SELECT id, 100, 'low' FROM public.companies;
