'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '@/lib/api';

export default function NewShiftPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    platform: 'Careem',
    shift_date: new Date().toISOString().slice(0, 10),
    hours_worked: 8,
    gross_earned: 2500,
    platform_deductions: 600,
    net_received: 1900,
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const worker_id = localStorage.getItem('fairgig_user_id');
    const res = await fetch(`${API_BASE.earnings}/shifts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, worker_id }),
    });

    if (!res.ok) return;
    router.push('/shifts');
  };

  return (
    <div className="mx-auto max-w-xl card">
      <h1 className="mb-4 text-xl font-semibold">Log Shift</h1>
      <form className="grid gap-3" onSubmit={submit}>
        <select className="input" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
          <option>Careem</option><option>Bykea</option><option>foodpanda</option><option>Upwork</option>
        </select>
        <input className="input" type="date" value={form.shift_date} onChange={(e) => setForm({ ...form, shift_date: e.target.value })} />
        <input className="input" type="number" value={form.hours_worked} onChange={(e) => setForm({ ...form, hours_worked: Number(e.target.value) })} placeholder="Hours" />
        <input className="input" type="number" value={form.gross_earned} onChange={(e) => setForm({ ...form, gross_earned: Number(e.target.value) })} placeholder="Gross" />
        <input className="input" type="number" value={form.platform_deductions} onChange={(e) => setForm({ ...form, platform_deductions: Number(e.target.value) })} placeholder="Deductions" />
        <input className="input" type="number" value={form.net_received} onChange={(e) => setForm({ ...form, net_received: Number(e.target.value) })} placeholder="Net" />
        <button className="btn" type="submit">Save Shift</button>
      </form>
    </div>
  );
}
