'use client';

import { Globe, TrendingUp, Database, Fingerprint } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';

function Item({ title, description, icon, className }: { title: string; description: string; icon: ReactNode; className?: string }) {
  return (
    <div className={`group rounded-[32px] border border-slate-100 bg-white p-8 shadow-sm transition hover:border-mint-500/40 hover:shadow-[0_0_40px_-15px_rgba(0,209,255,0.3)] ${className || ''}`}>
      <div className="mb-3">{icon}</div>
      <h4 className="mb-2 font-bold text-slate-900">{title}</h4>
      <p className="text-xs text-slate-600">{description}</p>
    </div>
  );
}

export function Features() {
  return (
    <section id="features" className="overflow-hidden bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-8 lg:px-12">
        <h2 className="mb-4 text-sm font-black uppercase tracking-[0.3em] text-mint-500">Core Capabilities</h2>
        <h3 className="mb-16 text-4xl font-black leading-none tracking-tighter text-slate-900 lg:text-5xl">Infrastructure for the <br /> New Gig Economy.</h3>
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="grid grid-cols-1 gap-4 md:auto-rows-[18rem] md:grid-cols-3">
          <Item className="md:col-span-2" title="Cross-Platform Sync" description="Aggregate multi-platform earnings with institutional precision from Uber, Fiverr, and Upwork." icon={<TrendingUp className="h-4 w-4 text-mint-500" />} />
          <Item title="Protocol Standardization" description="Convert chaotic platform statements into bank-ready structured assets." icon={<Database className="h-4 w-4 text-slate-500" />} />
          <Item title="Reputation Layers" description="Build a verifiable financial identity that transcends platform lock-in." icon={<Fingerprint className="h-4 w-4 text-slate-500" />} />
          <Item className="md:col-span-2" title="Borderless Verification" description="Your proof of work is now an exportable credential valid across countries." icon={<Globe className="h-4 w-4 text-mint-500" />} />
        </motion.div>
      </div>
    </section>
  );
}
