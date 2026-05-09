"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type ReportSubmitResult = {
  report: { id: string };
  intake: {
    employerId?: string;
    employerName?: string;
    analysis?: { summary?: string };
    status?: string;
  };
  intelligence: {
    intelligence?: { trust_score: number; risk_level: string };
  } | null;
};

const AI_REASONING_STATES = [
  "Detecting worker language patterns...",
  "Identifying wage or payment signals...",
  "Matching recurring safety flags...",
  "Comparing against community history...",
  "Generating real-time risk briefing...",
  "Updating community shield status...",
  "Securing anonymous signal..."
];

function ReportFormContent() {
  const searchParams = useSearchParams();
  const employerIdFromLink = searchParams.get("employerId");
  const [reportText, setReportText] = useState("");
  const [sourceType, setSourceType] = useState<"text" | "audio">("text");
  const [audioUrl, setAudioUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeAIState, setActiveAIState] = useState(0);
  const [result, setResult] = useState<ReportSubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const downloadPdf = async () => {
    if (!result) return;
    setPdfLoading(true);
    try {
      const res = await fetch('/api/reports/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: result.report?.id,
          summary: result.intake?.analysis?.summary,
          riskLevel: result.intelligence?.intelligence?.risk_level,
          trustScore: result.intelligence?.intelligence?.trust_score,
          employerName: result.intake?.employerName,
        }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `WorkForWho-Receipt-${result.report?.id?.slice(0, 8) ?? 'report'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail — PDF is a bonus feature
    } finally {
      setPdfLoading(false);
    }
  };

  
  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (statusIntervalRef.current !== null) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        stream.getTracks().forEach((track) => track.stop());
        
        setIsTranscribing(true);
        setError(null);
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          try {
            const base64data = reader.result?.toString().split(',')[1];
            if (!base64data) throw new Error("Failed to encode audio");

            const res = await fetch("/api/ai/transcribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                base64Audio: base64data,
                mimeType: mediaRecorder.mimeType || "audio/webm",
              }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to transcribe audio");
            
            if (data.text) {
              setReportText((prev) => (prev ? prev + " " + data.text : data.text));
              setSourceType("text"); // Switch back to text so they can review and submit
            } else {
               setError("Could not understand the audio. Please try again or type your report.");
            }
          } catch (err: any) {
            setError(err.message || "Failed to process audio");
          } finally {
            setIsTranscribing(false);
          }
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      setError("Microphone access denied or not available. " + (err.message || ""));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedReportText = reportText.trim();
    if (trimmedReportText.length < 10) {
      setError("Please enter at least 10 characters.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setActiveAIState(0);

    if (statusIntervalRef.current !== null) clearInterval(statusIntervalRef.current);
    statusIntervalRef.current = setInterval(() => {
      setActiveAIState((prev) => (prev < AI_REASONING_STATES.length - 1 ? prev + 1 : prev));
    }, 1200);

    try {
      // 1. Save Report
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_text: trimmedReportText,
          source_type: sourceType,
          audio_url: sourceType === "audio" ? audioUrl.trim() : null,
          language: "en",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save report");

      const report = data.report as { id: string };
      
      // 2. AI Intake (Extraction)
      const intakeRes = await fetch("/api/ai/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: report.id }),
      });
      const intake = (await intakeRes.json()) as ReportSubmitResult["intake"];
      if (!intakeRes.ok) throw new Error((intake as { error?: string }).error ?? "AI extraction failed");

      // 3a. Get employer name from intake response (returned directly by the API)
      const employerName: string | undefined = (intake as any)?.employerName ?? undefined;

      // 3b. AI Intelligence (Aggregation)
      let intelligence: ReportSubmitResult["intelligence"] = null;
      if (intake.employerId) {
        const intelligenceRes = await fetch("/api/ai/intelligence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employerId: intake.employerId }),
        });
        const intelligencePayload =
          (await intelligenceRes.json()) as ReportSubmitResult["intelligence"] & { error?: string };
        if (!intelligenceRes.ok) throw new Error(intelligencePayload.error ?? "Intelligence update failed");
        intelligence = intelligencePayload;
      }

      // Ensure at least some of the cool states show
      await new Promise(resolve => setTimeout(resolve, 800));

      setResult({ report, intake: { ...intake, employerName }, intelligence });
      setReportText("");
      setAudioUrl("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      if (statusIntervalRef.current !== null) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {employerIdFromLink &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        employerIdFromLink
      ) ? (
        <div
          role="status"
          className="rounded-2xl border border-blue-100 bg-blue-50/90 px-4 py-3 text-sm font-bold text-blue-900"
        >
          You opened this report from an employer profile. Clear employer names and locations help the AI match safely.
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
          <button
            type="button"
            onClick={() => setSourceType("text")}
            className={`rounded-xl px-3 py-2.5 text-sm font-black transition-all ${
              sourceType === "text" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            TEXT
          </button>
          <button
            type="button"
            onClick={() => setSourceType("audio")}
            className={`rounded-xl px-3 py-2.5 text-sm font-black transition-all ${
              sourceType === "audio" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            VOICE
          </button>
        </div>

        <div>
          <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">
            Describe the situation
          </label>
            <textarea
              className="w-full p-5 border-2 border-slate-100 rounded-[2rem] shadow-sm focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all bg-white text-slate-900 text-base sm:text-lg"
              rows={5}
              placeholder="What happened? Name the employer and location."
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        {sourceType === "audio" && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300 bg-white border-2 border-slate-100 rounded-[2rem] p-8 text-center space-y-6 shadow-xl shadow-slate-100/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
              <svg className="w-48 h-48 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            </div>
            
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-full text-blue-600 text-[10px] font-black uppercase tracking-widest mb-4">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                Google Gemini Multimodal AI
              </div>
              <h3 className="text-slate-900 font-black text-2xl mb-2 tracking-tight">Speak Naturally</h3>
              <p className="text-slate-500 font-medium text-sm max-w-sm mx-auto leading-relaxed">
                Gemini will instantly transcribe your voice into structured text. You can review it before submitting to the community shield.
              </p>
            </div>

            <div className="flex justify-center relative z-10 py-4">
              {isTranscribing ? (
                <div className="h-28 w-28 rounded-full bg-blue-600 flex items-center justify-center shadow-[0_0_50px_rgba(37,99,235,0.4)]">
                   <svg className="animate-spin h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : (
                <button
                  type="button"
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  onMouseLeave={stopRecording}
                  className={`h-28 w-28 rounded-full flex items-center justify-center transition-all duration-300 relative group ${
                    isRecording 
                      ? "bg-red-500 scale-110 shadow-[0_0_50px_rgba(239,68,68,0.5)] border-none" 
                      : "bg-white hover:bg-slate-50 shadow-xl border-4 border-slate-100 hover:border-blue-100 hover:scale-105"
                  }`}
                >
                  <div className={`absolute inset-0 rounded-full bg-blue-400 opacity-0 group-hover:opacity-10 transition-opacity blur-xl ${isRecording ? 'hidden' : 'block'}`} />
                  <svg className={`w-12 h-12 relative z-10 transition-colors ${isRecording ? "text-white animate-pulse" : "text-blue-500"}`} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                </button>
              )}
            </div>
            
            <p className="font-black text-[11px] uppercase tracking-widest relative z-10 transition-colors duration-300">
              {isTranscribing 
                ? <span className="text-blue-600 animate-pulse">Processing via Gemini API...</span>
                : isRecording 
                  ? <span className="text-red-500 animate-pulse">Recording... Release to process</span>
                  : <span className="text-slate-400">Hold to record your report</span>}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || isRecording || isTranscribing || !reportText}
          className={`group w-full py-5 px-6 rounded-[2rem] font-black text-white shadow-2xl transition-all ${
            loading || isRecording || isTranscribing || !reportText
              ? "bg-slate-200 cursor-not-allowed shadow-none text-slate-400"
              : "bg-blue-600 hover:bg-blue-700 hover:shadow-blue-200 active:scale-[0.98]"
          }`}
        >
          {loading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-3">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span key={activeAIState} className="animate-in fade-in slide-in-from-bottom-2 duration-500 font-black tracking-wide">
                  {AI_REASONING_STATES[activeAIState]}
                </span>
              </div>
            </div>
          ) : (
            <span className="flex items-center justify-center gap-2">
              SUBMIT ANONYMOUS REPORT
              <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </span>
          )}
        </button>
      </form>

      {error && (
        <div className="p-5 bg-red-50 border-2 border-red-100 text-red-700 rounded-[2rem] font-bold text-sm flex gap-3 animate-in shake duration-500">
          <span className="shrink-0 text-xl">⚠️</span>
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-1000">
          <div className="p-8 bg-white border-4 border-blue-500 rounded-[3rem] shadow-2xl shadow-blue-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <svg className="w-24 h-24 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
              </svg>
            </div>

            <div className="flex items-center gap-4 mb-8 relative z-10">
              <div className="h-14 w-14 rounded-2xl bg-green-500 text-white flex items-center justify-center shadow-lg shadow-green-100 shrink-0">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 leading-none">Intelligence Received</h2>
                <p className="text-blue-600 font-black mt-1 uppercase text-[10px] tracking-widest animate-pulse">Community Protection Active</p>
              </div>
            </div>
            
            <div className="space-y-8 relative z-10">
              {result.intake?.analysis?.summary && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black mb-2">AI Extraction Summary</p>
                  <p className="text-lg text-slate-700 font-medium leading-relaxed bg-slate-50 p-6 rounded-[2rem] italic border-l-4 border-blue-500">
                    <span aria-hidden="true">{"\u201C"}</span>
                    {result.intake.analysis.summary}
                    <span aria-hidden="true">{"\u201D"}</span>
                  </p>
                </div>
              )}

              {result.intelligence?.intelligence ? (
                <div className="pt-8 border-t-2 border-slate-50">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black mb-2">Live Community Consensus</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-black text-slate-900">{result.intelligence.intelligence.trust_score}</span>
                        <span className="text-xl font-black text-slate-300">/ 100</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-5 py-2 rounded-2xl text-sm font-black uppercase tracking-widest border-2 ${
                        result.intelligence.intelligence.risk_level === 'low' ? 'bg-green-50 text-green-700 border-green-100' :
                        result.intelligence.intelligence.risk_level === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-red-50 text-red-700 border-red-100'
                      }`}>
                        {result.intelligence.intelligence.risk_level} Risk
                      </span>
                    </div>
                  </div>
                </div>
              ) : result.intake?.employerId ? (
                <div className="pt-8 border-t-2 border-slate-50">
                  <p className="text-sm font-bold text-slate-500">
                    Your report is being woven into the community shield. Trust scores will reflect this signal shortly.
                  </p>
                </div>
              ) : (
                <div className="pt-8 border-t-2 border-slate-50">
                  <p className="text-sm font-bold text-slate-500">
                    Anonymous report secured. Our AI is matching this to regional patterns to identify the employer.
                  </p>
                </div>
              )}

              {/* TRACKING CODE */}
              <div className="pt-8 border-t-2 border-slate-50">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black mb-3">Your Secure Access Code</p>
                <div className="bg-slate-900 p-6 rounded-[2rem] flex items-center justify-between shadow-inner">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-black text-white tracking-widest font-mono">
                      {result.report?.id?.split('-')[0].toUpperCase()}
                    </span>
                  </div>
                  <a href={`/status?code=${result.report?.id?.split('-')[0].toUpperCase()}`} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition">
                    Check Status
                  </a>
                </div>
                <p className="text-xs text-slate-400 font-bold mt-3">Save this code to check the status of your report later. No account required.</p>
              </div>
            </div>
            
            <div className="mt-10 flex flex-col sm:flex-row gap-4 relative z-10">
              <button 
                onClick={() => setResult(null)}
                className="flex-1 py-4 px-6 rounded-2xl bg-slate-100 text-sm font-black text-slate-500 hover:bg-slate-200 transition"
              >
                SUBMIT ANOTHER
              </button>
              <button
                onClick={downloadPdf}
                disabled={pdfLoading}
                className="flex-1 py-4 px-6 rounded-2xl bg-slate-900 text-sm font-black text-white hover:bg-slate-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {pdfLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    GENERATING...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    DOWNLOAD RECEIPT
                  </>
                )}
              </button>
              {result.intake?.employerId && (
                <a 
                  href={`/employers/${result.intake.employerId}`}
                  className="flex-1 py-4 px-6 rounded-2xl bg-blue-600 text-sm font-black text-white text-center hover:bg-blue-700 transition shadow-xl shadow-blue-200"
                >
                  VIEW UPDATED INTEL
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReportPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-16">
      <div className="max-w-xl mx-auto">
        <header className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full text-blue-600 text-[10px] font-black uppercase tracking-widest mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
            </span>
            Live Community Intelligence
          </div>
          <h1 className="text-5xl font-black text-slate-900 mb-3 tracking-tighter">Report Issue</h1>
          <p className="text-slate-500 font-medium text-lg max-w-sm mx-auto">
            Speak up anonymously. Our AI turns your voice into community armor.
          </p>
        </header>

        <Suspense fallback={<div className="text-center py-12 text-slate-400 font-bold italic">Establishing secure connection...</div>}>
          <ReportFormContent />
        </Suspense>
      </div>
    </main>
  );
}
