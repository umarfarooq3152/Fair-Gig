'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const roleRoutes: Record<string, Array<{ href: string; label: string }>> = {
  worker: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/shifts', label: 'Shifts' },
    { href: '/certificate', label: 'Certificate' },
    { href: '/community', label: 'Community' },
  ],
  verifier: [{ href: '/verifier/queue', label: 'Verifier Queue' }],
  advocate: [
    { href: '/advocate/analytics', label: 'Analytics' },
    { href: '/advocate/grievances', label: 'Grievances' },
    { href: '/community', label: 'Community' },
  ],
};

export default function RoleSidebar() {
  const pathname = usePathname();
  const role = typeof window !== 'undefined' ? localStorage.getItem('fairgig_role') || 'worker' : 'worker';
  const links = roleRoutes[role] || roleRoutes.worker;

  return (
    <aside className="w-64 border-r border-gray-200 bg-white p-4 no-print sidebar">
      <div className="mb-6 text-xl font-bold">FairGig</div>
      <nav className="space-y-2">
        {links.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded px-3 py-2 text-sm ${active ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
