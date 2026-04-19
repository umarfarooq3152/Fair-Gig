import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ShieldCheck, Download, ExternalLink } from "lucide-react";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { Button } from "@/components/ui/button";

export function IncomeCertificate() {
  return (
    <section id="certificate" className="bg-white py-24 sm:py-32 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
            >
                <div className="h-1 w-12 bg-mint-500 mb-8" />
                <h2 className="text-4xl font-[900] tracking-tighter text-slate-900 sm:text-6xl leading-[1.1] uppercase">
                    Financial Mobility <br />
                    <span className="text-slate-400">for the Workers.</span>
                </h2>
                <p className="mt-8 text-lg text-slate-600 font-medium leading-relaxed">
                    Traditional banks struggle to understand gig income. FairGig translates your multi-platform earnings into a standardized, cryptographically verified certificate that lenders trust.
                </p>
                
                <div className="grid grid-cols-2 gap-x-4 gap-y-8 mt-12">
                    {[
                        { title: "Standardized", value: "FG-Protocol ISO" },
                        { title: "Verified", value: "SHA-256 Proof" },
                        { title: "Direct", value: "Bank Integration" },
                        { title: "Historical", value: "3-Year Depth" }
                    ].map((item, i) => (
                        <div key={i} className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.title}</p>
                            <p className="text-slate-900 font-bold">{item.value}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-12 w-full">
                    <Button size="lg" className="w-full sm:w-auto h-16 px-10 text-[14px] font-black uppercase tracking-widest bg-slate-900 text-white rounded-none hover:bg-slate-800 shadow-2xl">
                        Generate Certificate
                    </Button>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
                className="relative"
            >
                {/* LlamaIndex style background bars */}
                <div className="absolute -inset-10 flex gap-2 items-end opacity-10 blur-xl">
                    <div className="flex-1 h-32 bg-mint-500" />
                    <div className="flex-1 h-64 bg-purple-500" />
                    <div className="flex-1 h-48 bg-orange-500" />
                </div>

                <div className="relative bg-white border-2 border-slate-900 p-6 lg:p-12 shadow-[15px_15px_0_0_rgba(0,209,255,1)] md:shadow-[40px_40px_0_0_rgba(0,209,255,1)]">
                    <div className="flex justify-between items-start mb-12 border-b-2 border-slate-900 pb-8">
                         <div className="flex items-center gap-3">
                            <div className="h-8 w-8 bg-slate-900 flex items-center justify-center">
                                <ShieldCheck className="h-5 w-5 text-white" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Verified Asset</h3>
                         </div>
                         <div className="text-[10px] font-black uppercase tracking-widest bg-slate-100 px-3 py-1">FG-CERT-2026</div>
                    </div>
                    
                    <div className="space-y-10">
                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-2 font-black">Holders Platform</p>
                                <p className="text-slate-900 font-bold text-lg">Cross-Platform Unified</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-2 font-black">Worker ID</p>
                                <p className="text-slate-900 font-mono font-black">FG-8829-XL</p>
                            </div>
                        </div>

                        <div className="py-8 border-y-2 border-slate-100 overflow-hidden">
                            <p className="text-[10px] text-slate-400 mb-2 font-black uppercase tracking-[0.2em]">Verified Net Annual Income</p>
                            <h3 className="text-5xl sm:text-6xl font-black text-slate-900 tracking-tighter truncate">
                                $58,829.40
                            </h3>
                        </div>

                        <div className="flex gap-6">
                            <a href="#" className="flex-1 flex items-center justify-center h-14 border-2 border-slate-900 font-black uppercase tracking-widest text-[12px] hover:bg-slate-900 hover:text-white transition-all">
                                <Download className="h-4 w-4 mr-2" /> Export
                            </a>
                            <a href="#" className="flex-1 flex items-center justify-center h-14 bg-mint-500 font-black uppercase tracking-widest text-[12px] text-slate-900 hover:bg-mint-600 transition-all">
                                <ExternalLink className="h-4 w-4 mr-2" /> Verify
                            </a>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
      </div>
    </section>
  );
}
