"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type EmployerListItem = {
  id: string;
  canonical_name: string;
  location_city: string | null;
};

type EmployerData = {
  id: string;
  canonical_name: string;
  location_city: string | null;
  location_area: string | null;
  employer_scores: {
    trust_score: number;
    risk_level: string;
    risk_briefing: string;
    report_count: number;
    safety_rating?: number;
    wage_reliability?: number;
    fairness_score?: number;
    communication_score?: number;
  }[];
};

export default function CompareEmployersPage() {
  const [employers, setEmployers] = useState<EmployerListItem[]>([]);
  const [selectedId1, setSelectedId1] = useState<string>("");
  const [selectedId2, setSelectedId2] = useState<string>("");
  const [data1, setData1] = useState<EmployerData | null>(null);
  const [data2, setData2] = useState<EmployerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEmployers() {
      try {
        const res = await fetch("/api/employers/search?q=");
        if (res.ok) {
          const data = await res.json();
          setEmployers(data.employers || []);
        }
      } catch (error) {
        console.error("Failed to load employers", error);
      } finally {
        setLoading(false);
      }
    }
    loadEmployers();
  }, []);

  useEffect(() => {
    if (selectedId1) {
      fetch(`/api/employers/${selectedId1}`)
        .then((res) => res.json())
        .then((data) => setData1(data.employer));
    } else {
      setData1(null);
    }
  }, [selectedId1]);

  useEffect(() => {
    if (selectedId2) {
      fetch(`/api/employers/${selectedId2}`)
        .then((res) => res.json())
        .then((data) => setData2(data.employer));
    } else {
      setData2(null);
    }
  }, [selectedId2]);

  const renderEmployerCard = (data: EmployerData | null, side: 1 | 2) => {
    if (!data) {
      return (
        <div className="group bg-white/40 backdrop-blur-md border-2 border-slate-100/50 rounded-[4rem] p-12 flex flex-col items-center justify-center text-center h-[650px] transition-all duration-700 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-50/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="w-24 h-24 bg-white/80 rounded-[2rem] shadow-xl border border-white flex items-center justify-center mb-8 text-5xl group-hover:scale-110 transition-transform duration-500">
            {side === 1 ? "🛡️" : "⚖️"}
          </div>
          <h3 className="text-2xl font-black text-slate-300 uppercase tracking-widest leading-none">Choose Intel {side === 1 ? 'A' : 'B'}</h3>
          <p className="text-slate-400 font-bold mt-4 max-w-[240px] leading-relaxed">
            Select a community member from the directory above to begin the comparison.
          </p>
          <div className="mt-10 flex gap-2">
            {[1,2,3].map(i => (
              <div key={i} className="h-1.5 w-8 bg-slate-100 rounded-full animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
            ))}
          </div>
        </div>
      );
    }

    const scores = data.employer_scores?.[0];
    const trustScore = scores?.trust_score ?? 50;
    const riskLevel = scores?.risk_level ?? 'low';
    
    const axis = {
      safety:        Math.round(scores?.safety_rating        ?? Math.max(0, trustScore - (riskLevel === 'high' ? 20 : riskLevel === 'medium' ? 8 : 0))),
      wages:         Math.round(scores?.wage_reliability     ?? Math.max(0, trustScore + (riskLevel === 'low' ? 5 : -5))),
      fairness:      Math.round(scores?.fairness_score       ?? Math.max(0, trustScore + (riskLevel === 'low' ? 8 : riskLevel === 'high' ? -15 : -3))),
      communication: Math.round(scores?.communication_score  ?? Math.max(0, trustScore + (riskLevel === 'low' ? 3 : -8))),
    };

    return (
      <div className="bg-white rounded-[4rem] shadow-[0_40px_80px_-15px_rgba(0,0,0,0.05)] p-12 space-y-12 border-2 border-slate-50 relative overflow-hidden transition-all duration-500 hover:shadow-[0_50px_100px_-20px_rgba(37,99,235,0.1)] hover:-translate-y-2 h-full group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/30 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none group-hover:bg-blue-100/40 transition-colors" />
        
        {/* Header Section */}
        <div className="space-y-6 relative z-10">
          <div className={`inline-flex px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-2xl transition-transform group-hover:scale-105 ${
            riskLevel === 'low' ? 'bg-green-600 shadow-green-200' : riskLevel === 'medium' ? 'bg-amber-500 shadow-amber-200' : 'bg-red-600 shadow-red-200'
          }`}>
            {riskLevel} Risk Signal
          </div>
          <div>
            <h2 className="text-5xl font-black text-slate-900 tracking-tighter leading-[0.85] mb-2">{data.canonical_name}</h2>
            <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              {data.location_city || "Location Unknown"}
            </p>
          </div>
        </div>

        {/* Big Trust Score Card */}
        <div className="flex items-center justify-between p-10 bg-slate-50/50 rounded-[3rem] border-2 border-white shadow-inner relative overflow-hidden group/score">
           <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
           <div className="relative z-10">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Worker Trust</p>
             <p className="text-sm font-black text-slate-600">From {scores?.report_count ?? 0} Community Signals</p>
           </div>
           <div className={`text-7xl font-black tracking-tighter relative z-10 transition-transform group-hover/score:scale-110 ${
             trustScore > 70 ? 'text-green-600' : trustScore > 40 ? 'text-amber-500' : 'text-red-600'
           }`}>
             {trustScore}
           </div>
        </div>

        {/* Axis Breakdown */}
        <div className="space-y-8 relative z-10">
           {([
              { label: 'Wage Reliability', value: axis.wages, icon: '💰' },
              { label: 'Safety Standards', value: axis.safety, icon: '🛡️' },
              { label: 'Fairness Score', value: axis.fairness, icon: '⚖️' },
              { label: 'Clear Comms', value: axis.communication, icon: '💬' },
           ]).map((item) => {
              const color = item.value > 70 ? 'bg-green-500' : item.value > 40 ? 'bg-amber-400' : 'bg-red-500';
              const textColor = item.value > 70 ? 'text-green-600' : item.value > 40 ? 'text-amber-600' : 'text-red-600';
              return (
                <div key={item.label} className="space-y-3">
                   <div className="flex justify-between items-end px-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-2">
                        <span className="opacity-60">{item.icon}</span>
                        {item.label}
                      </span>
                      <span className={`text-sm font-black ${textColor}`}>{item.value}<span className="text-slate-300 font-bold">/100</span></span>
                   </div>
                   <div className="h-4 w-full bg-slate-100/50 rounded-full overflow-hidden p-1 border border-slate-50">
                      <div className={`h-full rounded-full transition-all duration-1000 shadow-sm ${color}`} style={{ width: `${item.value}%` }} />
                   </div>
                </div>
              );
           })}
        </div>

        {/* Action Link */}
        <div className="pt-4 relative z-10">
          <Link 
            href={`/employers/${data.id}`}
            className="group/btn w-full inline-flex items-center justify-center gap-3 py-6 rounded-[2rem] bg-slate-900 text-white text-xs font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-blue-600 transition-all active:scale-[0.98]"
          >
            Full Intelligence
            <svg className="w-5 h-5 transition-transform group-hover/btn:translate-x-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-12">
        <header className="flex flex-col md:flex-row justify-between items-start gap-8">
           <div className="space-y-2">
             <Link 
                href="/employers"
                className="group inline-flex items-center text-[10px] font-black text-slate-400 hover:text-blue-600 transition uppercase tracking-[0.2em]"
             >
                <svg className="mr-2 w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Intel
             </Link>
             <h1 className="text-6xl font-black text-slate-900 tracking-tighter">Compare Intel</h1>
             <p className="text-slate-500 font-bold text-lg max-w-xl">
               Side-by-side community metrics to help you choose the safest workplace.
             </p>
           </div>
           
           <div className="flex gap-4 items-center">
             <div className="p-1.5 bg-white rounded-3xl shadow-xl border border-slate-100 flex items-center gap-2">
                <div className="h-10 w-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">⚖️</div>
                <div className="pr-4">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Status</p>
                   <p className="text-xs font-black text-slate-900 uppercase">Live Comparison</p>
                </div>
             </div>
           </div>
        </header>

        {/* Selectors Section */}
        <div className="grid md:grid-cols-2 gap-8">
           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Worker Shield A</label>
              <div className="relative group">
                <select 
                  value={selectedId1}
                  onChange={(e) => setSelectedId1(e.target.value)}
                  className="w-full h-16 px-6 rounded-3xl bg-white shadow-xl shadow-slate-200/50 border-2 border-slate-100 focus:border-blue-600 focus:ring-4 focus:ring-blue-50 focus:outline-none font-black text-slate-900 cursor-pointer transition-all"
                >
                  <option value="">{loading ? "LOADING DIRECTORY..." : "CHOOSE EMPLOYER..."}</option>
                  {employers.map(e => (
                    <option key={e.id} value={e.id}>{e.canonical_name.toUpperCase()} — {e.location_city?.toUpperCase() || "GLOBAL"}</option>
                  ))}
                </select>
              </div>
           </div>

           <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Worker Shield B</label>
              <div className="relative group">
                <select 
                  value={selectedId2}
                  onChange={(e) => setSelectedId2(e.target.value)}
                  className="w-full h-16 px-6 rounded-3xl bg-white shadow-xl shadow-slate-200/50 border-2 border-slate-100 focus:border-blue-600 focus:ring-4 focus:ring-blue-50 focus:outline-none font-black text-slate-900 cursor-pointer transition-all"
                >
                  <option value="">{loading ? "LOADING DIRECTORY..." : "CHOOSE EMPLOYER..."}</option>
                  {employers.map(e => (
                    <option key={e.id} value={e.id}>{e.canonical_name.toUpperCase()} — {e.location_city?.toUpperCase() || "GLOBAL"}</option>
                  ))}
                </select>
              </div>
           </div>
        </div>

        {/* Comparison Grid */}
        <div className="grid md:grid-cols-2 gap-10 items-stretch">
           {renderEmployerCard(data1, 1)}
           {renderEmployerCard(data2, 2)}
        </div>

        {/* Bottom CTA */}
        <div className="bg-slate-900 p-12 rounded-[4rem] text-center space-y-8 shadow-3xl">
           <h2 className="text-4xl font-black text-white tracking-tighter max-w-2xl mx-auto leading-[0.9]">
             "The best time to know about a bad employer is before you take the job."
           </h2>
           <p className="text-slate-400 font-bold text-lg">Use this intel to protect yourself and your community.</p>
           <div className="flex flex-wrap justify-center gap-6">
              <Link 
                href="/report" 
                className="bg-blue-600 px-10 py-5 rounded-[2rem] text-white font-black text-sm uppercase tracking-widest shadow-2xl shadow-blue-900/50 hover:bg-blue-500 transition active:scale-95"
              >
                Submit A Signal
              </Link>
           </div>
        </div>
      </div>
    </div>
  );
}
