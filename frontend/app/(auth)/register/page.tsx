'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'worker',
    city_zone: 'DHA',
    category: 'ride_hailing',
  });
  const [error, setError] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const response = await fetch(`${API_BASE.auth}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      setError('Could not register user');
      return;
    }

    router.push('/login');
  };

  return (
    <div className="mx-auto mt-10 max-w-lg card">
      <h1 className="mb-4 text-2xl font-semibold">Register</h1>
      <form className="grid gap-3" onSubmit={onSubmit}>
        <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="input" type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="worker">worker</option>
          <option value="verifier">verifier</option>
          <option value="advocate">advocate</option>
        </select>
        <select className="input" value={form.city_zone} onChange={(e) => setForm({ ...form, city_zone: e.target.value })}>
          <option>Gulberg</option><option>DHA</option><option>Saddar</option><option>Johar Town</option><option>Cantt</option>
        </select>
        <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          <option value="ride_hailing">ride_hailing</option><option value="food_delivery">food_delivery</option><option value="freelance">freelance</option><option value="domestic">domestic</option>
        </select>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button className="btn" type="submit">Create account</button>
      </form>
    </div>
  );
}
