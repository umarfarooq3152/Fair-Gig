'use client';

import { Database, Lock, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useRef } from 'react';
import { AnimatedBeam } from '@/components/ui/animated-beam';

export function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  const vaultRef = useRef<HTMLDivElement>(null);
  const sourceOne = useRef<HTMLDivElement>(null);
  const sourceTwo = useRef<HTMLDivElement>(null);
  const sourceThree = useRef<HTMLDivElement>(null);
  const sourceFour = useRef<HTMLDivElement>(null);

  const words = 'FairGig: Own Your Earnings. Prove Your Worth.'.split(' ');

  return (
    <section ref={containerRef} className="relative flex min-h-screen items-center overflow-hidden bg-[#F5F5F5] px-6 pt-32 lg:px-12">
      <div className="relative z-10 mx-auto w-full max-w-7xl py-16 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mb-10 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.2em]">
          <span className="h-2 w-2 rounded-full bg-mint-500" />SOFTEC 2026 Innovation Awards
        </motion.div>

        <h1 className="mx-auto flex max-w-5xl flex-wrap justify-center text-5xl font-extrabold tracking-[-0.04em] text-slate-900 sm:text-8xl lg:text-[6.5rem] lg:leading-[0.88]">
          {words.map((word, index) => (
            <motion.span key={index} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 12, stiffness: 200, delay: index * 0.08 }} className={`mr-[0.25em] inline-block ${word.includes('Worth.') ? 'text-mint-500' : ''}`}>
              {word}
            </motion.span>
          ))}
        </h1>

        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }} className="mx-auto mt-8 max-w-2xl text-lg font-medium leading-relaxed text-slate-600">
          FairGig is the standardized protocol to aggregate, verify, and leverage your multi-platform earnings.
        </motion.p>

        <div className="relative mt-12 flex flex-col items-center justify-center gap-14 lg:flex-row">
          <div className="z-20 grid grid-cols-2 gap-4 lg:gap-6">
            {[sourceOne, sourceTwo, sourceThree, sourceFour].map((ref, idx) => (
              <div key={idx} ref={ref} className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-slate-100 bg-white shadow-sm"><Database className="h-6 w-6 text-slate-400" /></div>
            ))}
          </div>

          <div ref={hubRef} className="z-30 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-slate-900 shadow-2xl"><ShieldCheck className="h-10 w-10 text-white" /></div>
          <div ref={vaultRef} className="z-20 flex h-20 w-20 items-center justify-center rounded-3xl border-4 border-purple-50 bg-white shadow-[0_30px_60px_rgba(139,92,246,0.1)]"><Lock className="h-8 w-8 text-purple-600" /></div>

          <AnimatedBeam containerRef={containerRef} fromRef={sourceOne} toRef={hubRef} curvature={-40} gradientStartColor="#00d1ff" gradientStopColor="#00b8e6" />
          <AnimatedBeam containerRef={containerRef} fromRef={sourceTwo} toRef={hubRef} curvature={40} gradientStartColor="#00d1ff" gradientStopColor="#00b8e6" />
          <AnimatedBeam containerRef={containerRef} fromRef={sourceThree} toRef={hubRef} curvature={-60} gradientStartColor="#00d1ff" gradientStopColor="#00b8e6" />
          <AnimatedBeam containerRef={containerRef} fromRef={sourceFour} toRef={hubRef} curvature={60} gradientStartColor="#00d1ff" gradientStopColor="#00b8e6" />
          <AnimatedBeam containerRef={containerRef} fromRef={hubRef} toRef={vaultRef} pathWidth={4} gradientStartColor="#8B5CF6" gradientStopColor="#D8B4FE" />
        </div>

        <div className="mt-12 flex flex-col justify-center gap-4 sm:flex-row">
          <Link href="/register" className="h-14 bg-slate-900 px-10 py-4 text-[14px] font-black uppercase tracking-widest text-white">Get Started</Link>
          <a href="#features" className="h-14 border-2 border-slate-200 bg-white px-10 py-4 text-[14px] font-black uppercase tracking-widest text-slate-900">Explore Features</a>
        </div>
      </div>
    </section>
  );
}
