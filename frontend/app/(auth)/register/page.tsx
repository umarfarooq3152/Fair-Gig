'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '@/lib/api';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
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

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.name || !form.email || !form.password || !form.confirmPassword) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
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
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#E9EBED] p-4 lg:p-6">
      <div className="w-full max-w-2xl border-2 border-slate-900 bg-white p-6 shadow-[10px_10px_0_0_rgba(26,26,26,1)] lg:p-8">
        <h1 className="mb-2 text-center text-3xl font-black uppercase tracking-tighter text-slate-900">Register</h1>
        <p className="mb-6 text-center text-sm font-medium text-slate-500">Create your FairGig account</p>
        <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={onSubmit}>
          <input className="h-12 w-full rounded-none border-2 border-slate-200 px-3 font-bold focus:border-slate-900 focus:outline-none" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="h-12 w-full rounded-none border-2 border-slate-200 px-3 font-bold focus:border-slate-900 focus:outline-none" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="h-12 w-full rounded-none border-2 border-slate-200 px-3 font-bold focus:border-slate-900 focus:outline-none" type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <input className="h-12 w-full rounded-none border-2 border-slate-200 px-3 font-bold focus:border-slate-900 focus:outline-none" type="password" placeholder="Confirm Password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
          <select className="h-12 w-full rounded-none border-2 border-slate-200 px-3 font-bold focus:border-slate-900 focus:outline-none" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="worker">Worker</option>
            <option value="verifier">Verifier</option>
            <option value="advocate">Advocate</option>
          </select>
          <select className="h-12 w-full rounded-none border-2 border-slate-200 px-3 font-bold focus:border-slate-900 focus:outline-none" value={form.city_zone} onChange={(e) => setForm({ ...form, city_zone: e.target.value })}>
            <option>Gulberg</option><option>DHA</option><option>Saddar</option><option>Johar Town</option><option>Cantt</option>
          </select>
          <select className="h-12 w-full md:col-span-2 rounded-none border-2 border-slate-200 px-3 font-bold focus:border-slate-900 focus:outline-none" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="ride_hailing">Ride Hailing</option><option value="food_delivery">Food Delivery</option><option value="freelance">Freelance</option><option value="domestic">Domestic</option>
          </select>
          <div className="md:col-span-2 flex flex-col items-center gap-2">
            {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
            <button className="h-14 w-full bg-mint-500 text-[11px] font-black uppercase tracking-widest text-slate-900 hover:bg-mint-600" type="submit">Register Now</button>
          </div>
        </form>
        <div className="mt-6 border-t-2 border-slate-100 pt-6 text-center text-sm text-slate-500">
          Already have an account? <Link href="/login" className="font-bold text-slate-900">Sign In</Link>
        </div>
      </div>
    </div>
  );
}
