import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-50">
      <div className="max-w-2xl w-full text-center space-y-8">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
          Local Worker Shield
        </h1>
        <p className="text-xl text-slate-600">
          Community safety infrastructure for informal workers. 
          Check employer trust scores before you work.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/companies"
            className="rounded-md bg-blue-600 px-6 py-3 text-lg font-semibold text-white shadow-sm hover:bg-blue-500 transition"
          >
            Search Employers
          </Link>
          <Link
            href="/report"
            className="rounded-md bg-white px-6 py-3 text-lg font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 transition"
          >
            Submit a Report
          </Link>
        </div>

        <div className="pt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="p-4 bg-white rounded-lg shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-800">Voice Reports</h3>
            <p className="text-sm text-slate-600">Submit reports in your local language via voice or text.</p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-800">AI Risk Signals</h3>
            <p className="text-sm text-slate-600">AI extracts salary delays, unsafe conditions, and scam patterns.</p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-800">Trust Scores</h3>
            <p className="text-sm text-slate-600">Real-time trust scores updated by community intelligence.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
