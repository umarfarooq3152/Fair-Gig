'use client';

import { FormEvent, useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';

export default function CommunityPage() {
  const [role, setRole] = useState('worker');
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({ platform: 'Careem', category: 'commission_hike', description: '' });

  const load = async () => {
    const workerId = localStorage.getItem('fairgig_user_id');
    const query = role === 'worker' ? `?worker_id=${workerId}` : '';
    const res = await fetch(`${API_BASE.grievance}/complaints${query}`);
    setList(await res.json());
  };

  useEffect(() => {
    const r = localStorage.getItem('fairgig_role') || 'worker';
    setRole(r);
  }, []);

  useEffect(() => {
    load();
  }, [role]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const worker_id = localStorage.getItem('fairgig_user_id');
    await fetch(`${API_BASE.grievance}/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worker_id, ...form }),
    });
    setForm({ ...form, description: '' });
    await load();
  };

  if (role === 'worker') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Community Grievance Board</h1>
        <form className="card grid gap-3" onSubmit={submit}>
          <select className="input" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
            <option>Careem</option><option>Bykea</option><option>foodpanda</option><option>Upwork</option>
          </select>
          <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Category" />
          <textarea className="input" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" />
          <button className="btn w-fit" type="submit">Post Complaint</button>
        </form>

        <div className="card">
          <h2 className="mb-3 text-lg font-medium">My Posts</h2>
          <ul className="space-y-2 text-sm">
            {list.map((c) => (
              <li key={c.id} className="rounded border p-2">
                <p className="font-medium">{c.platform} · {c.category}</p>
                <p>{c.description}</p>
                <p className="text-xs text-gray-500">Status: {c.status}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Community Grievance Board</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Platform</th>
              <th>Category</th>
              <th>Description</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-b">
                <td className="py-2">{c.platform}</td>
                <td>{c.category}</td>
                <td>{c.description}</td>
                <td>{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
