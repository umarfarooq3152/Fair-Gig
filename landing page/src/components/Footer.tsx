import { ShieldCheck } from "lucide-react";

export function Footer() {
  return (
    <footer className="relative border-t border-slate-200 py-16 bg-white overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-20">
            <div className="flex flex-col gap-6">
                <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded bg-slate-900 flex items-center justify-center">
                        <ShieldCheck className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-xl font-bold text-slate-900 tracking-tight uppercase">Fair<span className="text-slate-400 font-medium">Gig</span></span>
                </div>
                <p className="text-slate-500 max-w-xs font-medium leading-relaxed">
                    The standardized protocol for gig earnings. Verified, structured, and ready for the future of work.
                </p>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-16 lg:gap-24">
                <div>
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Security</p>
                   <ul className="space-y-4">
                       <li><a href="#" className="text-[13px] font-bold text-slate-900 hover:text-mint-500 transition-colors uppercase">Privacy</a></li>
                       <li><a href="#" className="text-[13px] font-bold text-slate-900 hover:text-mint-500 transition-colors uppercase">Proof</a></li>
                       <li><a href="#" className="text-[13px] font-bold text-slate-900 hover:text-mint-500 transition-colors uppercase">Audit</a></li>
                   </ul>
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Support</p>
                   <ul className="space-y-4">
                       <li><a href="#" className="text-[13px] font-bold text-slate-900 hover:text-mint-500 transition-colors uppercase">Docs</a></li>
                       <li><a href="#" className="text-[13px] font-bold text-slate-900 hover:text-mint-500 transition-colors uppercase">Help</a></li>
                       <li><a href="#" className="text-[13px] font-bold text-slate-900 hover:text-mint-500 transition-colors uppercase">Safety</a></li>
                   </ul>
                </div>
                <div className="hidden sm:block">
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Social</p>
                   <ul className="space-y-4">
                       <li><a href="#" className="text-[13px] font-bold text-slate-900 hover:text-mint-500 transition-colors uppercase">Twitter</a></li>
                       <li><a href="#" className="text-[13px] font-bold text-slate-900 hover:text-mint-500 transition-colors uppercase">Discord</a></li>
                   </ul>
                </div>
            </div>
        </div>
        
        <div className="pt-10 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                &copy; 2026 FairGig Protocol &bull; SOFTEC 2026 OFFICIAL
            </p>
            <div className="flex gap-8">
                <a href="#" className="text-[11px] font-black text-slate-900 hover:text-mint-500 uppercase tracking-widest transition-colors">Legal</a>
                <a href="#" className="text-[11px] font-black text-slate-900 hover:text-mint-500 uppercase tracking-widest transition-colors">Privacy</a>
            </div>
        </div>
      </div>
      
      {/* Decorative LlamaIndex style background element */}
      <div className="absolute top-0 right-0 h-full w-1 bg-gradient-to-b from-mint-500 via-purple-500 to-orange-500 opacity-20" />
    </footer>
  );
}
