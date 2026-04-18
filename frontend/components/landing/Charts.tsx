'use client';

import { motion } from 'motion/react';

export function Charts() {
  const data = [
    { name: 'Uber', value: 47.9, color: 'bg-slate-200' },
    { name: 'Lyft', value: 50.4, color: 'bg-slate-200' },
    { name: 'DoorDash', value: 50.6, color: 'bg-slate-200' },
    { name: 'Upwork', value: 54.1, color: 'bg-slate-200' },
    { name: 'Fiverr', value: 59.6, color: 'bg-slate-200' },
    { name: 'Instacart', value: 62.2, color: 'bg-slate-300' },
    { name: 'TaskRabbit', value: 71.0, color: 'bg-slate-300' },
    { name: 'FairGig', value: 84.9, color: 'bg-teal-300' },
  ];

  return (
    <section className="bg-[#E9EBED] py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-end gap-16 px-6 lg:grid-cols-[1fr_2.5fr] lg:px-12">
        <div>
          <h2 className="mb-6 text-4xl font-black uppercase tracking-tight text-slate-900">Unrivaled performance <br /> across platforms.</h2>
          <p className="font-medium leading-relaxed text-slate-600">FairGig's structured data engine outperforms standard platform exports by 35% in accuracy and verified depth.</p>
        </div>

        <div className="relative overflow-x-auto border-2 border-slate-300 bg-white p-6 shadow-2xl lg:p-12">
          <div className="relative z-10 flex h-[400px] min-w-[600px] items-end justify-between gap-2 border-b-2 border-slate-200 lg:gap-4">
            {data.map((item, i) => (
              <div key={item.name} className="flex h-full flex-1 flex-col items-center justify-end">
                <motion.div initial={{ height: 0 }} whileInView={{ height: `${item.value}%` }} transition={{ duration: 1, delay: i * 0.08, ease: 'easeOut' }} className={`relative w-full ${item.color} ${item.name === 'FairGig' ? 'ring-4 ring-teal-500/10' : ''}`}>
                  <div className="absolute left-0 right-0 top-3 text-center text-[10px] font-black text-white mix-blend-difference">{item.value}</div>
                </motion.div>
                <div className="mt-4 h-10 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">{item.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
