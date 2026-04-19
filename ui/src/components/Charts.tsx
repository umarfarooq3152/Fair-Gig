import { motion } from "motion/react";
import { Database, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function Charts() {
  const data = [
    { name: "Uber", value: 47.9, color: "bg-ink/5" },
    { name: "Lyft", value: 50.4, color: "bg-ink/5" },
    { name: "Upwork", value: 54.1, color: "bg-ink/5" },
    { name: "Fiverr", value: 59.6, color: "bg-ink/5" },
    { name: "Instacart", value: 62.2, color: "bg-ink/10" },
    { name: "TaskRabbit", value: 71.0, color: "bg-ink/10" },
    { name: "FairGig", value: 84.9, color: "bg-blueprint", highlight: true },
  ];

  return (
    <section id="transparency" className="bg-paper py-24 sm:py-32 relative">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#141414 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />

      <div className="mx-auto max-w-7xl px-6 lg:px-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-end mb-20">
            <div>
                <motion.span 
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    className="mono-label block mb-6"
                >
                    Performance Benchmark // v04
                </motion.span>
                <h2 className="text-huge text-ink">
                    Superior <br />
                    <span className="text-ink/20">Data Depth.</span>
                </h2>
            </div>
            <div className="border-l-4 border-blueprint pl-8">
                <p className="text-lg text-ink/60 leading-relaxed font-medium max-w-md">
                    FairGig achieves 84.9% data accuracy by aggregating raw API streams directly from platform nodes, bypassing legacy extraction gaps.
                </p>
            </div>
        </div>

        <div className="blueprint-surface p-6 lg:p-12 relative overflow-hidden">
            {/* Header Rail */}
            <div className="flex justify-between items-center mb-12 border-b border-ink/10 pb-6">
                <div className="flex items-center gap-4">
                    <Database className="h-5 w-5 text-blueprint" />
                    <span className="mono-label text-ink">Comparative Analysis : 2026.Q2</span>
                </div>
                <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 bg-blueprint" />
                        <span className="mono-label text-ink/60">FairGig Protocol</span>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto pb-4">
              <div className="flex items-end justify-between h-[450px] min-w-[700px] lg:min-w-0 gap-4 relative z-10">
                {/* Horizontal Guide Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5">
                    {[0, 1, 2, 3, 4].map(i => <div key={i} className="w-full h-px bg-ink" />)}
                </div>

                {data.map((item, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                        <motion.div
                            initial={{ height: 0 }}
                            whileInView={{ height: `${item.value}%` }}
                            transition={{ duration: 1, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }} 
                            className={cn(
                                "w-full relative",
                                item.color,
                                item.highlight && "shadow-[0_0_30px_rgba(0,209,255,0.2)]"
                            )}
                        >
                            <div className="absolute -top-10 left-0 right-0 text-center">
                                <span className={cn(
                                    "mono-label font-bold",
                                    item.highlight ? "text-blueprint" : "text-ink/40"
                                )}>
                                    {item.value}%
                                </span>
                            </div>
                            
                            {item.highlight && (
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
                                     <Zap className="h-4 w-4 text-white" />
                                </div>
                            )}
                        </motion.div>
                        <div className="mt-6 text-[10px] font-black uppercase tracking-widest text-ink/30 h-12 flex items-center text-center leading-none">
                            {item.name}
                        </div>
                    </div>
                ))}
                
                {/* Y-Axis Labels */}
                <div className="absolute -left-12 top-0 bottom-12 flex flex-col justify-between text-[9px] font-mono text-ink/20 pointer-events-none">
                    <span>100</span>
                    <span>75</span>
                    <span>50</span>
                    <span>25</span>
                    <span>00</span>
                </div>
              </div>
            </div>
        </div>
      </div>
    </section>
  );
}
