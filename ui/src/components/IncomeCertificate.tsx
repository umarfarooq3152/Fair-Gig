import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ShieldCheck, Download, ExternalLink } from "lucide-react";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { Button } from "@/components/ui/button";

export function IncomeCertificate() {
  return (
    <section id="certificate" className="bg-white py-24 sm:py-32 relative overflow-hidden border-b border-ink/10">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-start">
            <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
                className="lg:sticky lg:top-32"
            >
                <div className="flex items-center gap-4 mb-8">
                    <span className="h-0.5 w-12 bg-blueprint" />
                    <span className="mono-label">Authentication Layer</span>
                </div>
                <h2 className="text-huge text-ink mb-12">
                    Verified <br />
                    <span className="text-blueprint">Liquidity.</span>
                </h2>
                <p className="text-lg text-ink/60 font-medium leading-relaxed max-w-md">
                    FairGig translates your multi-platform data into a standardized, cryptographically verified certificate that global lenders recognize as a primary asset.
                </p>
                
                <div className="grid grid-cols-2 gap-x-4 gap-y-12 mt-16">
                    {[
                        { title: "Standard", value: "FG-Protocol 4.0" },
                        { title: "Verification", value: "SHA-256 Chain" },
                        { title: "Connectivity", value: "Direct Node" },
                        { title: "Archival", value: "IMMUTABLE" }
                    ].map((item, i) => (
                        <div key={i} className="flex flex-col gap-2">
                            <span className="mono-label">{item.title}</span>
                            <p className="text-ink font-bold tracking-tight">{item.value}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-16 w-full">
                    <Button size="lg" className="w-full sm:w-auto h-16 px-10 text-[12px] font-black uppercase tracking-widest bg-ink text-paper hover:bg-blueprint hover:text-ink rounded-none transition-all">
                        Generate Proof
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
                {/* Layered Document Stack */}
                <div className="relative">
                    {/* Shadow Layer */}
                    <div className="absolute top-8 left-8 w-full h-full border border-ink/5 bg-paper z-0" />
                    
                    <div className="relative bg-white border border-ink p-8 lg:p-12 z-10 shadow-[20px_20px_0_0_rgba(0,209,255,1)] md:shadow-[40px_40px_0_0_rgba(0,209,255,1)]">
                        <div className="flex justify-between items-start mb-16 border-b border-ink/10 pb-10">
                             <div className="flex items-center gap-4">
                                <div className="h-10 w-10 bg-ink flex items-center justify-center">
                                    <ShieldCheck className="h-6 w-6 text-paper" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-ink tracking-tighter uppercase leading-none mb-1">Worker.Asset</h3>
                                    <span className="mono-label text-[8px]">Network ID: FG-8829-XL</span>
                                </div>
                             </div>
                             <div className="mono-label bg-paper px-4 py-2 border border-ink/5">2026.VERIFIED</div>
                        </div>
                        
                        <div className="space-y-12">
                            <div className="grid grid-cols-2 gap-12">
                                <div>
                                    <span className="mono-label block mb-2">Carrier Platform</span>
                                    <p className="text-ink font-bold text-lg tracking-tight">Unified Consensus</p>
                                </div>
                                <div>
                                    <span className="mono-label block mb-2">Timestamp</span>
                                    <p className="text-ink font-mono font-bold">19-APR-2026 00:15</p>
                                </div>
                            </div>

                            <div className="py-12 border-y border-ink/5 relative overflow-hidden">
                                <span className="mono-label block mb-6">Aggregated Annual Liquidity</span>
                                <h3 className="text-6xl sm:text-7xl font-black text-ink tracking-tighter tabular-nums truncate">
                                    $58,829.40
                                </h3>
                                <div className="absolute top-0 right-0 h-full w-24 bg-gradient-to-l from-white to-transparent pointer-events-none" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <a href="#" className="flex items-center justify-center h-16 border border-ink font-black uppercase tracking-widest text-[10px] hover:bg-ink hover:text-paper transition-all">
                                    <Download className="h-4 w-4 mr-3" /> Export PDF
                                </a>
                                <a href="#" className="flex items-center justify-center h-16 bg-blueprint font-black uppercase tracking-widest text-[10px] text-ink hover:bg-blueprint/80 transition-all">
                                    <ExternalLink className="h-4 w-4 mr-3" /> Block Search
                                </a>
                            </div>

                            <div className="pt-8 flex justify-between items-center opacity-20">
                                <div className="h-px flex-1 bg-ink mx-4" />
                                <span className="mono-label">END OF SPECIFICATION</span>
                                <div className="h-px flex-1 bg-ink mx-4" />
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
      </div>
    </section>
  );
}
