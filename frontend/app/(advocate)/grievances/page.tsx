'use client';

import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';

export default function AdvocateGrievancesPage() {
  const [items, setItems] = useState<any[]>([]);
  const advocateId = typeof window !== 'undefined' ? localStorage.getItem('fairgig_user_id') : '';

  const load = async () => {
    const res = await fetch(`${API_BASE.grievance}/complaints`);
    setItems(await res.json());
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    await fetch(`${API_BASE.grievance}/complaints/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, advocate_id: advocateId }),
    });
    await load();
  };

  const updateTags = async (id: string, tagsText: string) => {
    const tags = tagsText.split(',').map((t) => t.trim()).filter(Boolean);
    await fetch(`${API_BASE.grievance}/complaints/${id}/tags`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    });
    await load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Grievances</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Platform</th>
              <th>Category</th>
              <th>Description</th>
              <th>Tags</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b align-top">
                <td className="py-2">{c.platform}</td>
                <td>{c.category}</td>
                <td>{c.description}</td>
                <td>
                  <input
                    className="input"
                    defaultValue={(c.tags || []).join(',')}
                    onBlur={(e) => updateTags(c.id, e.target.value)}
                  />
                </td>
                <td>
                  <select className="input" value={c.status} onChange={(e) => updateStatus(c.id, e.target.value)}>
                    <option value="open">open</option>
                    <option value="escalated">escalated</option>
                    <option value="resolved">resolved</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
