import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Wipe existing data to remove duplicates and poorly written test data
    console.log("Wiping old data...");
    
    // Wipe modern tables
    await supabase.from('report_flags').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('ai_analyses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('employer_scores').delete().neq('employer_id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('employers').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Wipe legacy tables (catching errors if they don't exist)
    await supabase.from('scam_flags').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('ai_analysis').delete().neq('report_id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('trust_scores').delete().neq('company_id', '00000000-0000-0000-0000-000000000000');
    // For legacy reports, some don't have id so we just delete where content_text is not null, or actually we already cleared `reports` table above since it shares the same name.
    await supabase.from('companies').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Helper to try modern, fallback to legacy
    async function insertEmployer(name: string) {
      let res = await supabase.from('employers').insert({ canonical_name: name }).select().single();
      if (res.error && (res.error.code === 'PGRST205' || res.error.message.includes('employer'))) {
        res = await supabase.from('companies').insert({ name: name }).select().single();
      }
      if (res.error) throw res.error;
      return res.data;
    }

    async function insertReport(employerId: string, text: string) {
      let res = await supabase.from('reports').insert({ 
        employer_id: employerId, 
        raw_text: text, 
        source_type: 'text' 
      }).select().single();
      if (res.error && (res.error.code === 'PGRST205' || res.error.message.includes('employer_id') || res.error.message.includes('column'))) {
        res = await supabase.from('reports').insert({ 
          company_id: employerId, 
          content_text: text 
        }).select().single();
      }
      if (res.error) throw res.error;
      return res.data;
    }

    async function insertScore(employerId: string, score: number, riskLevel: string, briefing: string) {
      let res = await supabase.from('employer_scores').insert({
        employer_id: employerId,
        trust_score: score,
        risk_level: riskLevel,
        safety_rating: score,
        wage_reliability: score,
        risk_briefing: briefing,
        report_count: 5
      });
      if (res.error && (res.error.code === 'PGRST205' || res.error.message.includes('employer'))) {
        res = await supabase.from('trust_scores').insert({
          company_id: employerId,
          score: score,
          risk_level: riskLevel,
          risk_briefing: briefing
        });
      }
      if (res.error) throw res.error;
      return res.data;
    }

    async function insertAnalysis(employerId: string, reportId: string, issues: string[]) {
      let res = await supabase.from('ai_analyses').insert({
        report_id: reportId,
        employer_id: employerId,
        issues_json: issues,
        sentiment: 'negative',
        severity: 4
      });
      if (res.error && (res.error.code === 'PGRST205' || res.error.message.includes('employer'))) {
        res = await supabase.from('ai_analysis').insert({
          report_id: reportId,
          extracted_risks: issues,
          sentiment_score: -0.8
        });
      }
      if (res.error) throw res.error;
      return res.data;
    }

    async function insertFlag(employerId: string, reportId: string, reason: string) {
      let res = await supabase.from('report_flags').insert({
        report_id: reportId,
        reason: reason
      });
      if (res.error && (res.error.code === 'PGRST205' || res.error.message.includes('report_flags'))) {
        res = await supabase.from('scam_flags').insert({
          company_id: employerId,
          flag_reason: reason
        });
      }
      if (res.error) throw res.error;
      return res.data;
    }

    const companiesData = [
      { name: 'Apex Logistics Delivery', risk: 'high', score: 25,
        reports: ['Forced 14 hour shifts with no overtime.', 'Manager held final paycheck because I quit after they forced me to drive unsafe vehicle.'],
        patterns: ['Wage Theft', 'Unsafe Equipment', 'Coercion'],
        flags: ['Critical Safety Hazard: Brake failure on vans.', 'Wage Theft: Withholding final pay'] },
      { name: 'Sunrise Construction Corp', risk: 'high', score: 10,
        reports: ['Supervisor threatened immigration if we complained about missing wages.', 'No safety harnesses provided on 3rd floor scaffolding.'],
        patterns: ['Intimidation', 'Immigration Threats', 'Unpaid Wages', 'No Fall Protection'],
        flags: ['Human Rights Violation: Immigration threats.', 'Imminent Danger: No fall protection'] },
      { name: 'Global Freight Networks', risk: 'high', score: 15,
        reports: ['They skim 20% off every paycheck saying it is for uniform fees.', 'Refused to pay medical bills when I broke my arm loading.'],
        patterns: ['Illegal Deductions', 'Workplace Injury', 'Medical Negligence'],
        flags: ['Wage Theft: Illegal uniform fees.', 'Safety Liability: Denied medical care'] },
      { name: 'Metro Janitorial', risk: 'medium', score: 65,
        reports: ['Pay is on time but no proper gloves for strong chemicals.', 'Asked to work off the clock for 15 mins every day.'],
        patterns: ['Inadequate PPE', 'Off-the-clock Work', 'Chemical Exposure'],
        flags: ['Safety Gap: Missing PPE.', 'Minor Wage Theft: 15m unpaid daily'] },
      { name: 'Urban Retail Partners', risk: 'medium', score: 55,
        reports: ['Manager plays favorites with shifts.', 'Sometimes checks bounce but they pay us eventually.'],
        patterns: ['Unreliable Hours', 'Bouncing Checks'],
        flags: ['Financial Risk: Bouncing paychecks.'] },
      { name: 'Blue Ribbon Cleaning', risk: 'medium', score: 70,
        reports: ['Good pay, but we have to drive our own cars between sites without gas reimbursement.', 'Lots of lifting, some back pain.'],
        patterns: ['No Mileage Reimbursement', 'Physical Strain'],
        flags: ['Expense Risk: No gas reimbursement'] },
      { name: 'Green Valley Retail', risk: 'low', score: 95,
        reports: ['Good place to work. Pay is always correct.', 'Manager is respectful.'],
        patterns: ['Reliable Pay', 'Respectful Management', 'Safe Environment'],
        flags: [] },
      { name: 'City Construction Group', risk: 'low', score: 100,
        reports: ['They provide all safety gear and breaks are strictly enforced.', 'Paid every Friday on the dot.'],
        patterns: ['Excellent Safety Compliance', 'Strict Breaks', 'Reliable Wages'],
        flags: [] },
      { name: 'Reliable Delivery Services', risk: 'low', score: 88,
        reports: ['Stable employer with no systemic risks.', 'Vans are new and well maintained.'],
        patterns: ['Reliable Wages', 'Well-Maintained Equipment'],
        flags: [] },
      { name: 'Fresh Farms Produce', risk: 'low', score: 92,
        reports: ['Fair pay for agricultural work.', 'Provides plenty of water and shade.'],
        patterns: ['Fair Pay', 'Heat Safety Compliance', 'Good Conditions'],
        flags: [] },
      { name: 'Pinnacle Security', risk: 'low', score: 90,
        reports: ['Clear instructions and good training.', 'Pay is average but extremely reliable.'],
        patterns: ['Good Training', 'Reliable Pay'],
        flags: [] },
      { name: 'Local Eats Hospitality', risk: 'low', score: 85,
        reports: ['Tips are fully distributed.', 'Kitchen gets hot but managers rotate us.'],
        patterns: ['Fair Tip Distribution', 'Good Rotation Policies'],
        flags: [] },
      { name: 'Evergreen Landscapes', risk: 'low', score: 94,
        reports: ['They supply all tools and PPE.', 'Owner is very transparent about pay.'],
        patterns: ['Provided PPE', 'Transparent Pay'],
        flags: [] },
      { name: 'NextGen Warehousing', risk: 'medium', score: 60,
        reports: ['Mandatory overtime with little notice.', 'Pay is good but the quota is extremely stressful.'],
        patterns: ['Mandatory Overtime', 'Stressful Quotas'],
        flags: ['Work-Life Balance: Surprise mandatory shifts.'] },
      { name: 'Summit Movers', risk: 'high', score: 20,
        reports: ['Cash under the table, always shorting us $20-$30 a day.', 'If you drop something they take it out of your daily pay.'],
        patterns: ['Cash Under Table', 'Illegal Deductions', 'Wage Theft'],
        flags: ['Illegal Deductions: Charging employees for damages.', 'Wage Theft: Shorting daily pay.'] }
    ];

    for (const comp of companiesData) {
      const employer = await insertEmployer(comp.name);
      const repIds = [];
      for (const text of comp.reports) {
        const rep = await insertReport(employer.id, text);
        repIds.push(rep.id);
      }
      
      const briefing = comp.risk === 'high' 
        ? 'CRITICAL ALERT: Multiple verified reports indicating systemic issues.' 
        : comp.risk === 'medium' 
        ? 'MODERATE WARNING: Scattered reports of friction points, but no severe immediate danger.'
        : 'CLEAR: Verified positive consensus. Stable working conditions reported.';
        
      await insertScore(employer.id, comp.score, comp.risk, briefing);
      
      if (repIds.length > 0) {
        await insertAnalysis(employer.id, repIds[0], comp.patterns);
      }
      
      for (let i = 0; i < comp.flags.length; i++) {
        if (repIds[i]) {
          await insertFlag(employer.id, repIds[i], comp.flags[i]);
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Database cleaned and 15 Employers Seeded Successfully!' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
