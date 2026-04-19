export default function GlobalLoading() {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white/35 backdrop-blur-sm">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
    </div>
  );
}
