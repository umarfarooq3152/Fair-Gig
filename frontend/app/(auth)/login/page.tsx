'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('worker1@fairgig.demo');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
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
  };

  return (
    <div className="mx-auto mt-16 max-w-md card">
      <h1 className="mb-4 text-2xl font-semibold">Login</h1>
      <form className="space-y-3" onSubmit={onSubmit}>
        <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button className="btn w-full" type="submit">Sign in</button>
      </form>
    </div>
  );
}
