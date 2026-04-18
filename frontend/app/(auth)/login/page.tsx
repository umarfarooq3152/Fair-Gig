'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '@/lib/api';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('worker1@fairgig.demo');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch(`${API_BASE.auth}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        setError('Invalid credentials');
        return;
      }

      const data = await response.json();
      localStorage.setItem('fairgig_access_token', data.access_token);
      localStorage.setItem('fairgig_refresh_token', data.refresh_token);

      const me = await fetch(`${API_BASE.auth}/auth/me`, {
        headers: { Authorization: `Bearer ${data.access_token}` },
        cache: 'no-store',
      });
      const user = await me.json();
      localStorage.setItem('fairgig_role', user.role);
      localStorage.setItem('fairgig_user_id', user.id);
      localStorage.setItem('fairgig_user_name', user.name);
      localStorage.setItem('fairgig_city_zone', user.city_zone || 'DHA');
      localStorage.setItem('fairgig_category', user.category || 'ride_hailing');

      document.cookie = `fairgig_access_token=${data.access_token}; path=/`;

      if (user.role === 'worker') router.push('/dashboard');
      else if (user.role === 'verifier') router.push('/verifier/queue');
      else router.push('/advocate/analytics');
    } catch (err) {
      console.error(err);
      setError('Network error: Unable to connect to the authentication service.');
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#E9EBED] p-6">
      <div className="w-full max-w-md border-2 border-slate-900 bg-white p-8 shadow-[20px_20px_0_0_rgba(26,26,26,1)] lg:p-12">
        <h1 className="mb-2 text-center text-3xl font-black uppercase tracking-tighter text-slate-900">Sign In</h1>
        <p className="mb-8 text-center text-sm font-medium text-slate-500">Access your FairGig dashboard</p>
        <form className="space-y-6" onSubmit={onSubmit}>
          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email Address</div>
            <input className="h-12 w-full rounded-none border-2 border-slate-200 px-3 font-bold focus:border-slate-900 focus:outline-none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
          </div>
          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Security Key</div>
            <input className="h-12 w-full rounded-none border-2 border-slate-200 px-3 font-bold focus:border-slate-900 focus:outline-none" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button className="h-14 w-full bg-slate-900 text-[11px] font-black uppercase tracking-widest text-white hover:bg-slate-800" type="submit">Sign In</button>
        </form>
        <div className="mt-8 border-t-2 border-slate-100 pt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account? <Link href="/register" className="font-bold text-slate-900">Register</Link>
        </div>
      </div>
    </div>
  );
}
