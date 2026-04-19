'use client';

import { Database, Lock, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useRef } from 'react';
import { AnimatedBeam } from '@/components/ui/animated-beam';
import { cn } from '@/lib/cn';

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
  const vaultRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  const uberRef = useRef<HTMLDivElement>(null);
  const fiverrRef = useRef<HTMLDivElement>(null);
  const upworkRef = useRef<HTMLDivElement>(null);
  const foodpandaRef = useRef<HTMLDivElement>(null);

  const words = 'Own Your Earnings. Prove Your Worth.'.split(' ');

  return (
    <section
      ref={containerRef}
      className="relative flex min-h-screen flex-col items-center overflow-hidden bg-[#F8F8F7] pt-20"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.03]">
        <div className="absolute left-1/4 top-0 h-full w-px bg-slate-900" />
        <div className="absolute left-2/4 top-0 h-full w-px bg-slate-900" />
        <div className="absolute left-3/4 top-0 h-full w-px bg-slate-900" />
        <div className="absolute left-0 top-1/4 h-px w-full bg-slate-900" />
        <div className="absolute left-0 top-2/4 h-px w-full bg-slate-900" />
      </div>

      <div className="relative z-10 w-full">
        <div className="border-b border-slate-900/10 py-16 lg:py-24">
          <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-10 px-6 lg:grid-cols-2 lg:gap-12 lg:px-12">
            <div className="text-center lg:text-left">
              <motion.h1
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="max-w-[760px] text-[clamp(2.8rem,8.5vw,6.4rem)] font-black leading-[0.9] tracking-[-0.04em] text-slate-900"
              >
                {words.map((word, index) => (
                  <motion.span
                    key={index}
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', damping: 12, stiffness: 200, delay: index * 0.08 }}
                    className={cn('mr-[0.25em] inline-block', word.includes('Worth.') && 'text-mint-500')}
                  >
                    {word}
                  </motion.span>
                ))}
              </motion.h1>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1.2 }}
                className="mt-12 flex flex-col items-center justify-center gap-12 lg:flex-row lg:items-start lg:justify-start"
              >
                <p className="max-w-lg border-l-4 border-mint-500 px-4 text-base font-medium leading-relaxed text-slate-600 lg:pl-8 lg:text-left">
                  The standardized protocol to aggregate, verify, and leverage your multi-platform gig earnings.
                  A secure data layer for the modern economy.
                </p>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.9, delay: 0.8 }}
              className="relative flex items-end justify-center lg:justify-end"
            >
              <div className="pointer-events-none absolute -inset-3 -z-10 rounded-3xl bg-gradient-to-br from-mint-500/15 via-transparent to-slate-900/10 blur-2xl" />
              <motion.img
                src="/fonts/bg-rem-hero.png"
                alt="FairGig workers"
                className="relative z-10 h-auto w-full max-w-[980px] object-contain lg:translate-x-8"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              />
            </motion.div>
          </div>
        </div>

        <div className="grid w-full grid-cols-1 border-b border-slate-900/10 bg-white/30 p-2 lg:grid-cols-[1.5fr_1fr_1.5fr] lg:p-0">
          <div className="relative flex flex-col items-center justify-center overflow-hidden p-12 lg:grid-divider-v lg:items-start lg:p-24">
            <VisualizerBars />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-700/10 [writing-mode:vertical-rl]">
              Platform Ingress
            </span>
            <div className="z-20 grid grid-cols-2 gap-4 lg:gap-8">
              {[
                { ref: uberRef, label: 'Uber' },
                { ref: fiverrRef, label: 'Fiverr' },
                { ref: upworkRef, label: 'Upwork' },
                { ref: foodpandaRef, label: 'Foodpanda' },
              ].map((platform, i) => (
                <motion.div
                  key={i}
                  ref={platform.ref}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.6 + i * 0.1, duration: 0.8 }}
                  className="group flex h-20 w-20 flex-col items-center justify-center gap-2 border border-slate-900/10 bg-white hover:border-mint-500"
                >
                  <Database className="h-6 w-6 text-slate-500 transition-colors group-hover:text-mint-500" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">{platform.label}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="relative flex items-center justify-center p-12 lg:grid-divider-v lg:p-24">
            <motion.div
              ref={hubRef}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 2, duration: 1 }}
              className="relative z-30 flex h-32 w-32 items-center justify-center border-2 border-slate-900 bg-white"
            >
              <div className="absolute -inset-6 animate-pulse border border-mint-500/20" />
              <ShieldCheck className="h-12 w-12 text-slate-900" />
              <span className="absolute -bottom-8 whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-slate-500">
                FairGig Node 01
              </span>
            </motion.div>
          </div>

          <div className="relative flex flex-col items-center justify-center overflow-hidden p-12 lg:items-end lg:p-24">
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-700/10 [writing-mode:vertical-rl]">
              Verified Asset
            </span>
            <motion.div
              ref={vaultRef}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 2.2, duration: 1 }}
              className="z-20 flex h-32 w-32 flex-col items-center justify-center gap-4 border border-slate-900/10 bg-white"
            >
              <div className="flex h-12 w-12 items-center justify-center bg-slate-900/5">
                <Lock className="h-6 w-6 text-slate-900" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Vault.Proof</span>
            </motion.div>
          </div>

          <AnimatedBeam containerRef={containerRef} fromRef={uberRef} toRef={hubRef} curvature={-40} duration={3} pathColor="rgba(139,92,246,0.1)" gradientStartColor="#8B5CF6" gradientStopColor="#00D1FF" />
          <AnimatedBeam containerRef={containerRef} fromRef={fiverrRef} toRef={hubRef} curvature={40} duration={3.5} pathColor="rgba(139,92,246,0.1)" gradientStartColor="#8B5CF6" gradientStopColor="#00D1FF" />
          <AnimatedBeam containerRef={containerRef} fromRef={upworkRef} toRef={hubRef} curvature={-60} duration={4} pathColor="rgba(139,92,246,0.1)" gradientStartColor="#8B5CF6" gradientStopColor="#00D1FF" />
          <AnimatedBeam containerRef={containerRef} fromRef={foodpandaRef} toRef={hubRef} curvature={60} duration={4.5} pathColor="rgba(139,92,246,0.1)" gradientStartColor="#8B5CF6" gradientStopColor="#00D1FF" />
          <AnimatedBeam containerRef={containerRef} fromRef={hubRef} toRef={vaultRef} curvature={0} duration={2.5} pathColor="rgba(139,92,246,0.2)" gradientStartColor="#8B5CF6" gradientStopColor="#8B5CF6" pathWidth={3} />
        </div>
      </div>
    </section>
  );
}
