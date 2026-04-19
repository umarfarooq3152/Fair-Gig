'use client';

import { Database, Lock, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useRef } from 'react';
import { AnimatedBeam } from '@/components/ui/animated-beam';

const VisualizerBars = () => {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-40">
      <div className="flex h-full translate-y-20 items-end gap-1 py-20">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((height, index) => (
          <motion.div
            key={index}
            initial={{ height: 0 }}
            animate={{ height: `${height * 10}%` }}
            transition={{ duration: 1, delay: index * 0.05, ease: 'easeOut' }}
            className="w-8 bg-gradient-to-t from-transparent via-mint-500/20 to-mint-500/10 lg:w-12"
          />
        ))}
      </div>
    </div>
  );
};

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
      <div className="absolute inset-0">
        <VisualizerBars />
      </div>

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
              <motion.div
                key={idx}
                ref={ref}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.4 + idx * 0.1, duration: 0.7 }}
                className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-slate-100 bg-white shadow-sm"
              >
                <Database className="h-6 w-6 text-slate-400" />
              </motion.div>
            ))}
          </div>

          <motion.div
            ref={hubRef}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.8, duration: 0.9 }}
            className="relative z-30 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-slate-900 shadow-2xl"
          >
            <div className="pointer-events-none absolute -inset-4 animate-[spin_10s_linear_infinite] rounded-full border border-slate-200" />
            <ShieldCheck className="h-10 w-10 text-white" />
          </motion.div>
          <motion.div
            ref={vaultRef}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 2, duration: 0.9 }}
            className="relative z-20 flex h-20 w-20 items-center justify-center rounded-3xl border-4 border-purple-50 bg-white shadow-[0_30px_60px_rgba(139,92,246,0.1)]"
          >
            <div className="absolute inset-0 animate-pulse rounded-3xl bg-purple-500/5" />
            <Lock className="relative z-10 h-8 w-8 text-purple-600" />
          </motion.div>

          <AnimatedBeam containerRef={containerRef} fromRef={sourceOne} toRef={hubRef} curvature={-40} duration={3} pathColor="rgba(0,209,255,0.1)" gradientStartColor="#00d1ff" gradientStopColor="#00b8e6" />
          <AnimatedBeam containerRef={containerRef} fromRef={sourceTwo} toRef={hubRef} curvature={40} duration={3.5} pathColor="rgba(0,209,255,0.1)" gradientStartColor="#00d1ff" gradientStopColor="#00b8e6" />
          <AnimatedBeam containerRef={containerRef} fromRef={sourceThree} toRef={hubRef} curvature={-60} duration={4} pathColor="rgba(0,209,255,0.1)" gradientStartColor="#00d1ff" gradientStopColor="#00b8e6" />
          <AnimatedBeam containerRef={containerRef} fromRef={sourceFour} toRef={hubRef} curvature={60} duration={4.5} pathColor="rgba(0,209,255,0.1)" gradientStartColor="#00d1ff" gradientStopColor="#00b8e6" />
          <AnimatedBeam containerRef={containerRef} fromRef={hubRef} toRef={vaultRef} duration={2.5} pathColor="rgba(139,92,246,0.1)" pathWidth={4} gradientStartColor="#8B5CF6" gradientStopColor="#D8B4FE" />
        </div>

        <div className="mt-12 flex flex-col justify-center gap-4 sm:flex-row">
          <Link href="/register" className="h-14 bg-slate-900 px-10 py-4 text-[14px] font-black uppercase tracking-widest text-white">Get Started</Link>
          <a href="#features" className="h-14 border-2 border-slate-200 bg-white px-10 py-4 text-[14px] font-black uppercase tracking-widest text-slate-900">Explore Features</a>
        </div>
      </div>
    </section>
  );
}
