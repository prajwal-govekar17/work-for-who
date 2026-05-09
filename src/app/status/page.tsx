"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type StatusData = {
  id: string;
  status: string;
  submitted_at: string;
  employerName: string;
};

function StatusTrackerContent() {
  const searchParams = useSearchParams();
  const initCode = searchParams.get("code") || "";
  
  const [code, setCode] = useState(initCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StatusData | null>(null);

  const checkStatus = async (codeToCheck: string) => {
    if (!codeToCheck || codeToCheck.length < 6) {
      setError("Please enter a valid access code (at least 6 characters).");
      return;
    }
    
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch(`/api/reports/status?code=${encodeURIComponent(codeToCheck)}`);
      const payload = await res.json();
      
      if (!res.ok) throw new Error(payload.error || "Could not find report.");
      
      setData(payload.report);
    } catch (err: any) {
      setError(err.message || "Failed to check status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initCode.length >= 6) {
      checkStatus(initCode);
    }
  }, [initCode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    checkStatus(code);
  };

  const getTimelineSteps = (status: string) => {
    // Determine active step based on status
    let activeStep = 1;
    if (status === "needs_review") activeStep = 2;
    if (status === "processed" || status === "published") activeStep = 3;

    return [
      {
        step: 1,
        title: "Signal Secured",
        desc: "Your anonymous report was encrypted and safely received.",
        isActive: activeStep >= 1,
        isCurrent: activeStep === 1
      },
      {
        step: 2,
        title: "AI & Community Validation",
        desc: "AI extracted risk patterns. Awaiting community verification.",
        isActive: activeStep >= 2,
        isCurrent: activeStep === 2
      },
      {
        step: 3,
        title: "Shield Active",
        desc: "Signal is live on the employer's profile, warning future workers.",
        isActive: activeStep >= 3,
        isCurrent: activeStep === 3
      }
    ];
  };

  return (
    <div className="max-w-xl mx-auto space-y-12">
      <div className="bg-white p-10 rounded-[4rem] shadow-2xl shadow-slate-100 border-2 border-slate-50">
        <form onSubmit={handleSubmit} className="space-y-6 text-center">
          <div className="w-20 h-20 bg-slate-900 rounded-[2rem] mx-auto flex items-center justify-center text-4xl shadow-xl shadow-slate-200">
            🔐
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Check Signal Status</h2>
            <p className="text-slate-400 font-bold mt-2">Enter your secure access code to track your report anonymously.</p>
          </div>
          
          <div className="relative max-w-xs mx-auto">
            <input 
              type="text" 
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. A1B2C3D4"
              className="w-full text-center text-2xl font-mono font-black tracking-[0.2em] p-6 rounded-3xl bg-slate-50 border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all uppercase text-slate-900 placeholder:text-slate-300 shadow-inner"
            />
          </div>

          <button 
            type="submit"
            disabled={loading || code.length < 6}
            className="w-full max-w-xs mx-auto block py-5 rounded-[2rem] bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {loading ? "SEARCHING VAULT..." : "TRACK SIGNAL"}
          </button>
        </form>

        {error && (
          <div className="mt-8 p-5 bg-red-50 border-2 border-red-100 text-red-700 rounded-3xl font-bold text-sm text-center">
            {error}
          </div>
        )}
      </div>

      {data && (
        <div className="bg-slate-900 p-10 sm:p-12 rounded-[4rem] shadow-3xl text-white relative overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
          
          <div className="relative z-10 space-y-12">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-slate-800 pb-8">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Subject Employer</p>
                <h3 className="text-3xl font-black text-white leading-none">{data.employerName}</h3>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Submitted</p>
                <p className="text-sm font-bold text-slate-300">{new Date(data.submitted_at).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="space-y-8 relative">
              {/* Timeline line */}
              <div className="absolute left-[23px] top-4 bottom-4 w-1 bg-slate-800 rounded-full" />
              
              {getTimelineSteps(data.status).map((step, idx) => (
                <div key={step.step} className={`relative flex gap-6 items-start transition-opacity duration-500 ${step.isActive ? 'opacity-100' : 'opacity-30'}`}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 relative z-10 transition-all ${
                    step.isCurrent ? 'bg-blue-600 shadow-[0_0_30px_rgba(37,99,235,0.4)] scale-110' : 
                    step.isActive ? 'bg-green-500' : 'bg-slate-800'
                  }`}>
                    {step.isActive ? (
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-slate-500 font-black">{step.step}</span>
                    )}
                  </div>
                  <div className="pt-2">
                    <h4 className={`text-lg font-black tracking-tight ${step.isActive ? 'text-white' : 'text-slate-400'}`}>
                      {step.title}
                    </h4>
                    <p className={`text-sm mt-1 font-bold ${step.isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StatusPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-16 font-sans">
      <header className="max-w-xl mx-auto mb-10 flex justify-between items-center">
        <Link 
          href="/"
          className="group inline-flex items-center text-[10px] font-black text-slate-400 hover:text-blue-600 transition uppercase tracking-[0.2em]"
        >
          <svg className="mr-2 w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back Home
        </Link>
        <Link 
          href="/report"
          className="inline-flex px-4 py-2 bg-blue-100 text-blue-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-200 transition"
        >
          New Report
        </Link>
      </header>
      
      <Suspense fallback={<div className="text-center text-slate-400 font-bold p-12">Loading tracker...</div>}>
        <StatusTrackerContent />
      </Suspense>
    </div>
  );
}
