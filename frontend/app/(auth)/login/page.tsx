'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '@/lib/api';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Database, Lock, KeyRound } from 'lucide-react';
import { AnimatedBeam } from '@/components/ui/animated-beam';

export default function LoginPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  const vaultRef = useRef<HTMLDivElement>(null);
  const sourceOne = useRef<HTMLDivElement>(null);
  const sourceTwo = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    router.prefetch('/dashboard');
    router.prefetch('/queue');
    router.prefetch('/advocate/analytics');
  }, [router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE.auth}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        setError('Invalid credentials');
        setIsSubmitting(false);
        return;
      }

      const data = await response.json();
      localStorage.setItem('fairgig_access_token', data.access_token);
      localStorage.setItem('fairgig_refresh_token', data.refresh_token);

      let user = data.user as
        | {
            id: string;
            name: string;
            role: string;
            city_zone?: string | null;
            category?: string | null;
          }
        | undefined;

      if (!user) {
        const me = await fetch(`${API_BASE.auth}/auth/me`, {
          headers: { Authorization: `Bearer ${data.access_token}` },
          cache: 'no-store',
        });
        if (!me.ok) {
          setError('Could not load profile');
          setIsSubmitting(false);
          return;
        }
        user = await me.json();
      }

      if (!user) {
        setError('Could not load profile');
        setIsSubmitting(false);
        return;
      }

      localStorage.setItem('fairgig_role', user.role);
      localStorage.setItem('fairgig_user_id', user.id);
      localStorage.setItem('fairgig_user_name', user.name);
      localStorage.setItem('fairgig_city_zone', user.city_zone || 'DHA');
      localStorage.setItem('fairgig_category', user.category || 'ride_hailing');

      // Set cookie with proper flags so middleware receives it
      const expiresIn = 8 * 60 * 60 * 1000; // 8 hours
      const expiryDate = new Date(Date.now() + expiresIn);
      document.cookie = `fairgig_access_token=${data.access_token}; path=/; expires=${expiryDate.toUTCString()}; SameSite=Strict`;

      if (user.role === 'worker') router.push('/dashboard');
      else if (user.role === 'verifier') router.push('/queue');
      else router.push('/advocate/analytics');
    } catch (err) {
      console.error(err);
      setError('Network error: Unable to connect to the authentication service.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center overflow-hidden bg-[#f3f6fb] px-4 py-3 lg:h-screen lg:px-10 lg:py-2">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,209,255,0.15),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(16,24,40,0.16),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,rgba(15,23,42,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.08)_1px,transparent_1px)] [background-size:32px_32px]" />

      <div ref={containerRef} className="relative mx-auto grid w-full max-w-[1220px] overflow-hidden rounded-3xl border border-slate-200/80 bg-white/88 shadow-[0_45px_110px_-42px_rgba(15,23,42,0.52)] backdrop-blur-xl lg:h-[calc(100vh-1rem)] lg:grid-cols-[1.12fr_0.88fr]">
        <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-slate-50 via-white to-cyan-50/40 p-6 lg:border-b-0 lg:border-r lg:p-10">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500"
          >
            FairGig Identity Cloud
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mt-3 max-w-xl text-4xl font-black leading-[0.95] tracking-[-0.03em] text-slate-900 lg:text-[3.6rem]"
          >
            Sign In to Your Verified Earnings Stack
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 }}
            className="mt-4 max-w-lg text-sm font-medium leading-relaxed text-slate-600 lg:text-base"
          >
            Continue with your trusted profile and unlock worker, verifier, or advocate workflows with live data.
          </motion.p>

          <div className="relative mt-7 flex min-h-[210px] items-center justify-center lg:min-h-[250px]">
            <div className="grid grid-cols-2 gap-5">
              {[sourceOne, sourceTwo].map((ref, index) => (
                <motion.div
                  key={index}
                  ref={ref}
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1, y: [0, -5, 0] }}
                  transition={{ delay: 0.45 + index * 0.1 }}
                  className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-300/80 bg-white shadow-sm"
                >
                  <Database className="h-5 w-5 text-slate-500" />
                </motion.div>
              ))}
            </div>

            <motion.div
              ref={hubRef}
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7 }}
              className="absolute z-20 flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-slate-900 shadow-2xl"
            >
              <KeyRound className="h-9 w-9 text-white" />
              <div className="pointer-events-none absolute -inset-3 animate-pulse rounded-full border border-cyan-300/50" />
              <span className="absolute -bottom-8 whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-slate-500">Secret Node</span>
            </motion.div>

            <motion.div
              ref={vaultRef}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9 }}
              className="absolute right-4 top-12 z-20 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50 shadow-[0_0_40px_rgba(34,211,238,0.35)]"
            >
              <Lock className="h-6 w-6 text-cyan-700" />
              <div className="pointer-events-none absolute -inset-2 animate-pulse rounded-2xl border border-cyan-300/70" />
              <span className="absolute -bottom-7 whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-slate-500">Lock Vault</span>
            </motion.div>

            <AnimatedBeam containerRef={containerRef} fromRef={sourceOne} toRef={hubRef} curvature={-30} duration={3.2} pathColor="rgba(15,23,42,0.12)" gradientStartColor="#00d1ff" gradientStopColor="#06b6d4" />
            <AnimatedBeam containerRef={containerRef} fromRef={sourceTwo} toRef={hubRef} curvature={28} duration={3.5} pathColor="rgba(15,23,42,0.12)" gradientStartColor="#00d1ff" gradientStopColor="#06b6d4" />
            <AnimatedBeam containerRef={containerRef} fromRef={hubRef} toRef={vaultRef} duration={2.2} pathWidth={3} pathColor="rgba(8,145,178,0.3)" gradientStartColor="#0891b2" gradientStopColor="#67e8f9" />
          </div>
        </div>

        <div className="flex items-center p-5 lg:p-8">
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_24px_54px_-32px_rgba(15,23,42,0.45)] lg:p-8">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-700">Secure Access</p>
            <h2 className="mt-2 text-3xl font-black text-slate-900">Welcome Back</h2>

            <form className="mt-5 space-y-5" onSubmit={onSubmit}>
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email Address</div>
                <input
                  className="h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 font-semibold text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                />
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Security Key</div>
                <input
                  className="h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 font-semibold text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

              <button
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-[11px] font-black uppercase tracking-widest text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Signing In...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-500">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="font-bold text-cyan-700">
                Register
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
