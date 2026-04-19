import { motion } from "motion/react";

export function Charts() {
  const data = [
    { name: "Uber", value: 47.9, color: "bg-slate-200" },
    { name: "Lyft", value: 50.4, color: "bg-slate-200" },
    { name: "DoorDash", value: 50.6, color: "bg-slate-200" },
    { name: "Upwork", value: 54.1, color: "bg-slate-200" },
    { name: "Fiverr", value: 59.6, color: "bg-slate-200" },
    { name: "Instacart", value: 62.2, color: "bg-slate-300" },
    { name: "TaskRabbit", value: 71.0, color: "bg-slate-300" },
    { name: "FairGig", value: 84.9, color: "bg-teal-300", highlight: true },
  ];

  return (
    <section className="bg-[#E9EBED] py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2.5fr] gap-16 items-end">
            <div>
                <h2 className="text-4xl font-[900] tracking-tight text-slate-900 mb-6 leading-tight uppercase">
                    Unrivaled performance <br /> across platforms.
                </h2>
                <div className="space-y-6">
                    <div className="h-0.5 w-12 bg-slate-900" />
                    <p className="text-slate-600 font-medium leading-relaxed">
                        FairGig's structured data engine outperforms standard platform exports by 35% in accuracy and verified depth.
                    </p>
                    <a href="#" className="inline-flex items-center text-[12px] font-black uppercase tracking-widest text-slate-900 border-b-2 border-slate-900 pb-1 hover:text-mint-500 hover:border-mint-500 transition-all">
                        View Benchmark Docs
                    </a>
                </div>
            </div>

            <div className="bg-white border-2 border-slate-300 p-6 lg:p-12 shadow-2xl relative overflow-hidden">
                <div className="overflow-x-auto pb-4">
                  <div className="flex items-end justify-between h-[400px] min-w-[600px] lg:min-w-0 gap-2 lg:gap-4 relative z-10 border-b-2 border-slate-200">
                    {data.map((item, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                            <motion.div
                                initial={{ height: 0 }}
                                whileInView={{ height: `${item.value}%` }}
                                transition={{ duration: 1, delay: i * 0.1, ease: "easeOut" }}
                                className={`w-full ${item.color} relative ${item.highlight ? 'ring-4 ring-teal-500/10 z-20' : ''}`}
                            >
                                <div className="absolute top-4 left-0 right-0 text-center text-[10px] lg:text-[12px] font-black text-white mix-blend-difference">
                                    {item.value}
                                </div>
                                
                                {item.highlight && (
                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-teal-400 text-slate-900 px-3 py-1 text-[10px] font-black uppercase tracking-widest whitespace-nowrap shadow-xl">
                                        Market Leader
                                    </div>
                                )}
                            </motion.div>
                            <div className="mt-4 text-[9px] lg:text-[10px] font-black uppercase tracking-widest text-slate-400 h-10 flex items-center text-center leading-none">
                                {item.name}
                            </div>
                        </div>
                    ))}
                    
                    {/* Y-Axis Labels */}
                    <div className="absolute -left-4 top-0 bottom-0 flex flex-col justify-between text-[10px] font-black text-slate-300 pointer-events-none">
                        <span>100%</span>
                        <span>75%</span>
                        <span>50%</span>
                        <span>25%</span>
                        <span>0%</span>
                    </div>
                  </div>
                </div>
                
                {/* Horizontal Guide Lines */}
                <div className="absolute inset-0 p-8 lg:p-12 flex flex-col justify-between pointer-events-none opacity-50">
                    <div className="flex-1 border-t border-slate-100" />
                    <div className="flex-1 border-t border-slate-100" />
                    <div className="flex-1 border-t border-slate-100" />
                    <div className="flex-1 border-t border-slate-100" />
                </div>
            </div>
        </div>
      </div>
    </section>
  );
}
