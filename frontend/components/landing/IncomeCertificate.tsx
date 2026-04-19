import { Download, ExternalLink, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export function IncomeCertificate() {
  return (
    <section id="certificate" className="relative overflow-hidden bg-white py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-24 px-6 lg:grid-cols-2 lg:px-12">
        <div>
          <div className="mb-8 h-1 w-12 bg-mint-500" />
          <h2 className="text-4xl font-black uppercase tracking-tighter text-slate-900 sm:text-6xl">Financial Mobility <br /><span className="text-slate-400">for the Workers.</span></h2>
          <p className="mt-8 text-lg font-medium leading-relaxed text-slate-600">FairGig translates your multi-platform earnings into a standardized verified certificate lenders trust.</p>
          <div className="mt-12"><Link href="/certificate" className="inline-block h-16 bg-slate-900 px-10 py-5 text-[14px] font-black uppercase tracking-widest text-white">Generate Certificate</Link></div>
        </div>

        <div className="border-2 border-slate-900 bg-white p-6 shadow-[15px_15px_0_0_rgba(0,209,255,1)] md:p-12 md:shadow-[40px_40px_0_0_rgba(0,209,255,1)]">
          <div className="mb-12 flex items-start justify-between border-b-2 border-slate-900 pb-8">
            <div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center bg-slate-900"><ShieldCheck className="h-5 w-5 text-white" /></div><h3 className="text-xl font-black uppercase tracking-tighter text-slate-900">Verified Asset</h3></div>
            <div className="bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest">FG-CERT-2026</div>
          </div>
          <div className="space-y-10">
            <div className="grid grid-cols-2 gap-8">
              <div><p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Holders Platform</p><p className="text-lg font-bold text-slate-900">Cross-Platform Unified</p></div>
              <div><p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Worker ID</p><p className="font-mono font-black text-slate-900">FG-8829-XL</p></div>
            </div>
            <div className="border-y-2 border-slate-100 py-8"><p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Verified Net Annual Income</p><h3 className="truncate text-5xl font-black tracking-tighter text-slate-900 sm:text-6xl">$58,829.40</h3></div>
            <div className="flex gap-6">
              <a href="#" className="flex h-14 flex-1 items-center justify-center border-2 border-slate-900 text-[12px] font-black uppercase tracking-widest"><Download className="mr-2 h-4 w-4" /> Export</a>
              <a href="#" className="flex h-14 flex-1 items-center justify-center bg-mint-500 text-[12px] font-black uppercase tracking-widest text-slate-900"><ExternalLink className="mr-2 h-4 w-4" /> Verify</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
