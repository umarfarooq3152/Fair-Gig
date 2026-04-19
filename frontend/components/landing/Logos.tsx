'use client';

import { motion } from 'motion/react';

export function Logos() {
  const platforms = ['Uber', 'Lyft', 'Foodpanda', 'Bykea', 'Fiverr', 'Upwork', 'InDrive', 'Careem', 'DoorDash', 'Instacart', 'Daraz', 'TaskRabbit'];
  const duplicated = [...platforms, ...platforms, ...platforms];

  return (
    <section id="transparency" className="relative overflow-hidden border-b border-slate-100 bg-white py-14">
      <div className="mx-auto mb-10 max-w-7xl px-6 lg:px-12">
        <p className="text-center text-[10px] font-black uppercase tracking-[0.4em] text-slate-300">Infrastructuring Global & Local Income Streams</p>
      </div>
      <div className="group relative flex overflow-hidden">
        <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-32 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-32 bg-gradient-to-l from-white to-transparent" />
        <motion.div
          animate={{ x: ['0%', '-33.33%'] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          className="flex min-w-max items-center gap-12 whitespace-nowrap px-8 lg:gap-24"
        >
          {duplicated.map((name, i) => (
            <div key={`${name}-${i}`} className="flex cursor-pointer items-center justify-center opacity-30 transition-all duration-500 hover:opacity-100">
              <span className="text-[14px] font-extrabold uppercase tracking-[0.25em] text-slate-900 transition-colors hover:text-mint-500">{name}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
