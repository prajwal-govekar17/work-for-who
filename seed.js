import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('Seeding Hackathon Demo Data...');

  // Helper to try modern, fallback to legacy
  async function insertEmployer(name) {
    let res = await supabase.from('employers').insert({ canonical_name: name }).select().single();
    if (res.error && (res.error.code === 'PGRST205' || res.error.message.includes('employer'))) {
      res = await supabase.from('companies').insert({ name: name }).select().single();
    }
    if (res.error) throw res.error;
    return res.data;
  }

  async function insertReport(employerId, text) {
    let res = await supabase.from('reports').insert({ 
      employer_id: employerId, 
      raw_text: text, 
      source_type: 'text' 
    });
    if (res.error && (res.error.code === 'PGRST205' || res.error.message.includes('employer_id') || res.error.message.includes('column'))) {
      res = await supabase.from('reports').insert({ 
        company_id: employerId, 
        content_text: text 
      });
    }
    if (res.error) throw res.error;
    return res.data;
  }

  async function insertScore(employerId, score, riskLevel) {
    let res = await supabase.from('employer_scores').insert({
      employer_id: employerId,
      trust_score: score,
      risk_level: riskLevel,
      safety_rating: score,
      wage_reliability: score
    });
    if (res.error && (res.error.code === 'PGRST205' || res.error.message.includes('employer'))) {
      res = await supabase.from('trust_scores').insert({
        company_id: employerId,
        score: score,
        risk_level: riskLevel
      });
    }
    if (res.error) throw res.error;
    return res.data;
  }

  try {
    console.log('Creating Apex Logistics...');
    const apex = await insertEmployer('Apex Logistics Delivery');
    
    console.log('Creating Sunrise Construction...');
    const sunrise = await insertEmployer('Sunrise Construction Corp');

    console.log('Inserting reports...');
    await insertReport(apex.id, 'They made us work 14 hours straight delivering packages and refused to pay overtime. The vans have broken brakes and they say if we refuse to drive we are fired. This is extremely dangerous.');
    await insertReport(apex.id, 'My manager at Apex held my final paycheck because I quit after they forced me to drive an unsafe vehicle with a cracked windshield.');
    await insertReport(sunrise.id, 'Supervisor at the downtown site threatened to call immigration on 5 workers if they complained about missing wages. We have not been paid in 3 weeks.');

    console.log('Inserting high-risk scores...');
    await insertScore(apex.id, 25, 'high');
    await insertScore(sunrise.id, 10, 'high');

    console.log('Demo Data Seeded Successfully!');
  } catch (err) {
    console.error('Seeding error:', err);
  }
}

seed();
