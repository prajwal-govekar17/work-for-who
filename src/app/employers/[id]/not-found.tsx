import Link from "next/link";

export default function EmployerNotFound() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="max-w-md space-y-6">
        <div className="h-24 w-24 mx-auto bg-slate-200 rounded-[2rem] flex items-center justify-center shadow-inner">
          <svg className="w-12 h-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Profile Not Found</h1>
        <p className="text-slate-500 font-bold leading-relaxed">
          The employer profile you are looking for does not exist or has been removed from the community index.
        </p>
        <div className="pt-8">
          <Link
            href="/employers"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-[1.5rem] font-black shadow-lg shadow-blue-200 hover:bg-blue-700 transition"
          >
            BACK TO SEARCH
          </Link>
        </div>
      </div>
    </main>
  );
}
