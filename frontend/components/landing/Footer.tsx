import { ShieldCheck } from 'lucide-react';

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-slate-200 bg-white py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="mb-20 flex flex-col items-start justify-between gap-12 md:flex-row">
          <div className="flex max-w-xs flex-col gap-6">
            <div className="flex items-center gap-2"><div className="flex h-6 w-6 items-center justify-center rounded bg-slate-900"><ShieldCheck className="h-4 w-4 text-white" /></div><span className="text-xl font-bold uppercase tracking-tight text-slate-900">Fair<span className="font-medium text-slate-400">Gig</span></span></div>
            <p className="font-medium leading-relaxed text-slate-500">The standardized protocol for gig earnings. Verified, structured, and ready for the future of work.</p>
          </div>

          <div className="grid grid-cols-2 gap-16 sm:grid-cols-3 lg:gap-24">
            <div><p className="mb-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Security</p><ul className="space-y-4"><li className="text-[13px] font-bold uppercase text-slate-900">Privacy</li><li className="text-[13px] font-bold uppercase text-slate-900">Proof</li><li className="text-[13px] font-bold uppercase text-slate-900">Audit</li></ul></div>
            <div><p className="mb-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Support</p><ul className="space-y-4"><li className="text-[13px] font-bold uppercase text-slate-900">Docs</li><li className="text-[13px] font-bold uppercase text-slate-900">Help</li><li className="text-[13px] font-bold uppercase text-slate-900">Safety</li></ul></div>
            <div className="hidden sm:block"><p className="mb-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Social</p><ul className="space-y-4"><li className="text-[13px] font-bold uppercase text-slate-900">Twitter</li><li className="text-[13px] font-bold uppercase text-slate-900">Discord</li></ul></div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-10 md:flex-row">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">© 2026 FairGig Protocol • SOFTEC 2026 OFFICIAL</p>
          <div className="flex gap-8"><a className="text-[11px] font-black uppercase tracking-widest text-slate-900" href="#">Legal</a><a className="text-[11px] font-black uppercase tracking-widest text-slate-900" href="#">Privacy</a></div>
        </div>
      </div>
      <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-mint-500 via-purple-500 to-orange-500 opacity-20" />
    </footer>
  );
}
