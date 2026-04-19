import { ShieldCheck, Github, Twitter } from "lucide-react";

export function Footer() {
  return (
    <footer className="relative border-t border-ink/10 py-24 bg-white overflow-hidden">
      <div className="mx-auto max-w-[1440px] px-6 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 mb-24 items-start">
            <div className="flex flex-col gap-8 col-span-1 lg:col-span-1">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-ink flex items-center justify-center">
                        <ShieldCheck className="h-5 w-5 text-paper" />
                    </div>
                    <span className="text-xl font-black text-ink tracking-tighter uppercase">Fair<span className="text-ink/30 font-medium tracking-tight">Gig</span></span>
                </div>
                <p className="text-ink/60 max-w-xs font-medium leading-relaxed">
                    The standardized protocol for gig earnings. Verified, structured, and ready for the future of work.
                </p>
                <div className="flex gap-6 mt-4">
                     <Github className="h-5 w-5 text-ink/20 hover:text-ink cursor-pointer transition-colors" />
                     <Twitter className="h-5 w-5 text-ink/20 hover:text-ink cursor-pointer transition-colors" />
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-16 col-span-1 lg:col-span-2">
                <div>
                   <span className="mono-label block mb-8">Security Layer</span>
                   <ul className="space-y-4">
                       <li><a href="#" className="text-[12px] font-bold text-ink hover:text-blueprint transition-colors uppercase tracking-widest">Privacy Protocol</a></li>
                       <li><a href="#" className="text-[12px] font-bold text-ink hover:text-blueprint transition-colors uppercase tracking-widest">Cryptographic Proof</a></li>
                       <li><a href="#" className="text-[12px] font-bold text-ink hover:text-blueprint transition-colors uppercase tracking-widest">Node Audit</a></li>
                   </ul>
                </div>
                <div>
                   <span className="mono-label block mb-8">Structural Support</span>
                   <ul className="space-y-4">
                       <li><a href="#" className="text-[12px] font-bold text-ink hover:text-blueprint transition-colors uppercase tracking-widest">Documentation</a></li>
                       <li><a href="#" className="text-[12px] font-bold text-ink hover:text-blueprint transition-colors uppercase tracking-widest">Help Interface</a></li>
                       <li><a href="#" className="text-[12px] font-bold text-ink hover:text-blueprint transition-colors uppercase tracking-widest">Safety Standards</a></li>
                   </ul>
                </div>
            </div>

            <div className="blueprint-surface p-8 flex flex-col items-center justify-center gap-4 text-center">
                <span className="mono-label !text-blueprint">Mainnet Status</span>
                <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-mint-500 animate-pulse" />
                    <span className="text-xl font-black text-ink">ACTIVE</span>
                </div>
                <span className="mono-label">LATENCY: 14MS</span>
            </div>
        </div>
        
        <div className="pt-12 border-t border-ink/5 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-6">
                <p className="text-[10px] font-bold text-ink/30 uppercase tracking-[0.3em]">
                    &copy; 2026 FairGig Protocol &bull; ALL RIGHTS RESERVED
                </p>
            </div>
            <div className="flex items-center gap-8 border border-ink/10 px-6 py-2">
                <span className="mono-label !text-ink">Certified</span>
                <div className="h-4 w-px bg-ink/10" />
                <span className="mono-label !text-ink">SOFTEC 2026</span>
            </div>
        </div>
      </div>
      
      {/* Structural Decoration */}
      <div className="absolute top-0 right-0 h-full w-4 bg-blueprint opacity-10" />
    </footer>
  );
}
