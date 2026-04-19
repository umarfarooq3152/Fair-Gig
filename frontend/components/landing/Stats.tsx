'use client';

import { motion } from 'motion/react';

export function Stats() {
  const stats = [
    { value: '1B+', label: 'Income Verified', gradient: 'from-blue-500 to-purple-500' },
    { value: '50M+', label: 'Monthly API Calls', gradient: 'from-orange-500 to-red-500' },
    { value: '300k+', label: 'Verified Workers', gradient: 'from-mint-500 to-blue-500' },
  ];

  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="grid grid-cols-1 gap-16 md:grid-cols-3">
          {stats.map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: i * 0.1 }} viewport={{ once: true }}>
              <h2 className={`mb-4 bg-gradient-to-r ${stat.gradient} bg-clip-text text-5xl font-black tracking-tighter text-transparent sm:text-7xl lg:text-8xl`}>{stat.value}</h2>
              <p className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-400">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
