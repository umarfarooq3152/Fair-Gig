'use client';

import Link from 'next/link';
import { motion } from 'motion/react';

export function AuthSection() {
  return (
    <section id="signin" className="relative overflow-hidden bg-[#E9EBED] py-24 sm:py-32">
      <div className="mx-auto flex max-w-7xl flex-col items-center px-6 lg:px-12">
        <div className="mb-16 max-w-3xl text-center">
          <h2 className="mb-8 text-5xl font-[900] uppercase leading-tight tracking-tighter text-slate-900 sm:text-6xl">
            Ready to own your <br />
            <span className="text-mint-500">Income Layer?</span>
          </h2>
          <p className="text-lg font-medium leading-relaxed text-slate-600">
            Join FairGig and standardize your earnings profile across platforms.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="w-full max-w-md border-2 border-slate-900 bg-white p-8 shadow-[20px_20px_0_0_rgba(26,26,26,1)] lg:p-12"
        >
          <div className="grid grid-cols-2 border border-slate-200 bg-slate-100/50 p-1">
            <Link
              href="/login"
              className="flex h-11 items-center justify-center bg-white text-[11px] font-black uppercase tracking-widest text-slate-900 shadow-sm"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="flex h-11 items-center justify-center text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900"
            >
              Register
            </Link>
          </div>

          <div className="mt-8 space-y-6">
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email Address</div>
              <input
                readOnly
                className="h-12 w-full rounded-none border-2 border-slate-200 px-3 font-bold"
                placeholder="name@company.com"
              />
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Security Key</div>
              <input
                readOnly
                className="h-12 w-full rounded-none border-2 border-slate-200 px-3 font-bold"
                placeholder="••••••••"
                type="password"
              />
            </div>

            <Link
              href="/login"
              className="flex h-14 w-full items-center justify-center bg-slate-900 text-[11px] font-black uppercase tracking-widest text-white hover:bg-slate-800"
            >
              Continue to Sign In
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
