export default function GlobalLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#E9EBED]">
      <div className="w-full max-w-sm border-2 border-slate-900 bg-white p-8 shadow-[12px_12px_0_0_rgba(26,26,26,1)]">
        <div className="mb-4 flex items-center gap-3">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
          <p className="text-sm font-black uppercase tracking-widest text-slate-700">Loading Screen</p>
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full animate-pulse bg-slate-200" />
          <div className="h-3 w-5/6 animate-pulse bg-slate-200" />
          <div className="h-3 w-2/3 animate-pulse bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
