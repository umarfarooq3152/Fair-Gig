'use client';

import { FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '@/lib/api';
import Link from 'next/link';
import { motion } from 'motion/react';
import { AnimatedBeam } from '@/components/ui/animated-beam';
import { CheckCircle2, Database, ShieldCheck, UserRoundPlus } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const sourceOne = useRef<HTMLDivElement>(null);
  const sourceTwo = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'worker',
    city_zone: 'DHA',
    category: 'ride_hailing',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    if (!form.name || !form.email || !form.password || !form.confirmPassword) {
      setError('Please fill in all required fields.');
      setSubmitting(false);
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      setError('Please enter a valid email address.');
      setSubmitting(false);
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setSubmitting(false);
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      setSubmitting(false);
      return;
    }

    const { confirmPassword, ...submitData } = form;

    try {
      const response = await fetch(`${API_BASE.auth}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        setError('Could not register user');
        return;
      }

      router.push('/login');
    } catch (err) {
      console.error(err);
      setError('Network error: Unable to connect to the authentication service.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center overflow-hidden bg-[#f2f8f8] px-4 py-4 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(34,211,238,0.16),transparent_30%),radial-gradient(circle_at_85%_5%,rgba(16,24,40,0.14),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(to_right,rgba(15,23,42,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.08)_1px,transparent_1px)] [background-size:30px_30px]" />

      <div ref={containerRef} className="relative mx-auto grid max-h-[96vh] w-full max-w-[1220px] overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-[0_45px_110px_-42px_rgba(15,23,42,0.55)] backdrop-blur-xl lg:grid-cols-[0.95fr_1.05fr]">
        <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-slate-50 via-white to-cyan-50/45 p-6 lg:border-b-0 lg:border-r lg:p-10">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500"
          >
            FairGig Onboarding Network
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mt-3 max-w-xl text-4xl font-black leading-[0.95] tracking-[-0.03em] text-slate-900 lg:text-[3.4rem]"
          >
            Create Your Account in One Trusted Flow
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 }}
            className="mt-4 max-w-lg text-sm font-medium leading-relaxed text-slate-600 lg:text-base"
          >
            Set your identity, category, and city once. FairGig links your profile to verification, earnings, and grievance rails.
          </motion.p>

          <div className="mt-6 space-y-2 text-sm font-semibold text-slate-600">
            <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-600" />Role-aware dashboards out of the box</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-600" />City and category aligned records</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-600" />Secure claim and certificate lifecycle</p>
          </div>

          <div className="relative mt-7 flex min-h-[190px] items-center justify-center lg:min-h-[210px]">
            <div className="grid grid-cols-2 gap-5">
              {[sourceOne, sourceTwo].map((ref, index) => (
                <motion.div
                  key={index}
                  ref={ref}
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1, y: [0, -4, 0] }}
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
              transition={{ delay: 0.65 }}
              className="absolute z-20 flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-slate-900 shadow-2xl"
            >
              <ShieldCheck className="h-9 w-9 text-white" />
              <div className="pointer-events-none absolute -inset-3 animate-pulse rounded-full border border-cyan-300/55" />
              <span className="absolute -bottom-8 whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-slate-500">Secure Core</span>
            </motion.div>

            <motion.div
              ref={profileRef}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.85 }}
              className="absolute right-1 top-10 z-20 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50 shadow-[0_0_40px_rgba(34,211,238,0.35)]"
            >
              <UserRoundPlus className="h-6 w-6 text-cyan-700" />
              <div className="pointer-events-none absolute -inset-2 animate-pulse rounded-2xl border border-cyan-300/70" />
              <span className="absolute -bottom-7 whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-slate-500">Output Profile</span>
            </motion.div>

            <AnimatedBeam containerRef={containerRef} fromRef={sourceOne} toRef={hubRef} curvature={-32} duration={3.2} pathColor="rgba(15,23,42,0.12)" gradientStartColor="#00d1ff" gradientStopColor="#06b6d4" />
            <AnimatedBeam containerRef={containerRef} fromRef={sourceTwo} toRef={hubRef} curvature={24} duration={3.5} pathColor="rgba(15,23,42,0.12)" gradientStartColor="#00d1ff" gradientStopColor="#06b6d4" />
            <AnimatedBeam containerRef={containerRef} fromRef={hubRef} toRef={profileRef} duration={2.4} pathWidth={3} pathColor="rgba(8,145,178,0.3)" gradientStartColor="#0891b2" gradientStopColor="#67e8f9" />
          </div>
        </div>

        <div className="flex items-center p-5 lg:p-8">
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.45)] lg:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-700">Create Profile</p>
            <h2 className="mt-2 text-2xl font-black text-slate-900">Get Started</h2>

            <form className="mt-4 space-y-3" onSubmit={onSubmit}>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <input
                  className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none"
                  placeholder="Full Name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <input
                  className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none"
                  placeholder="Work Email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                <input
                  className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none"
                  type="password"
                  placeholder="Set Password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <input
                  className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none"
                  type="password"
                  placeholder="Confirm Password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                />
                <select
                  className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 text-sm font-semibold text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="worker">Worker</option>
                  <option value="verifier">Verifier</option>
                  <option value="advocate">Advocate</option>
                </select>
                <select
                  className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 text-sm font-semibold text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none"
                  value={form.city_zone}
                  onChange={(e) => setForm({ ...form, city_zone: e.target.value })}
                >
                  <option value="Gulberg">Gulberg</option>
                  <option value="DHA">DHA</option>
                  <option value="Saddar">Saddar</option>
                  <option value="Johar Town">Johar Town</option>
                  <option value="Cantt">Cantt</option>
                </select>
              </div>

              <select
                className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 text-sm font-semibold text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="ride_hailing">Ride Hailing</option>
                <option value="food_delivery">Food Delivery</option>
                <option value="freelance">Freelance</option>
                <option value="domestic">Domestic</option>
              </select>

              {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

              <button
                className="h-11 w-full rounded-xl bg-slate-900 text-[11px] font-black uppercase tracking-widest text-white transition hover:bg-slate-700 disabled:opacity-60"
                type="submit"
                disabled={submitting}
              >
                {submitting ? 'Creating account…' : 'Register Now'}
              </button>
            </form>

            <div className="mt-5 border-t border-slate-100 pt-5 text-center text-sm text-slate-500">
              Already have an account?{' '}
              <Link href="/login" className="font-bold text-cyan-700">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
