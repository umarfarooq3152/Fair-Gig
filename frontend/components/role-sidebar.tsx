'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const workerVerifierRoutes: Record<string, Array<{ href: string; label: string }>> = {
  worker: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/shifts', label: 'Shifts' },
    { href: '/certificate', label: 'Certificate' },
    { href: '/community', label: 'Community' },
  ],
  verifier: [{ href: '/queue', label: 'Verifier queue' }],
};

type AdvocateNavItem = { href: string; label: string; hash?: string };

const advocateNav: AdvocateNavItem[] = [
  { href: '/advocate/analytics', label: 'Dashboard' },
  { href: '/advocate/grievances', label: 'Grievance board' },
  { href: '/community', label: 'Community' },
];

function useHash() {
  const [hash, setHash] = useState('');
  useEffect(() => {
    const sync = () => setHash(typeof window !== 'undefined' ? window.location.hash : '');
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  return hash;
}

function advocateLinkHref(item: AdvocateNavItem) {
  return item.hash ? `${item.href}${item.hash}` : item.href;
}

function isAdvocateItemActive(pathname: string, hash: string, item: AdvocateNavItem) {
  if (!item.hash) {
    if (item.href === '/advocate/analytics') {
      return pathname === '/advocate/analytics' && (hash === '' || hash === '#');
    }
    return pathname === item.href;
  }
  return pathname === '/advocate/analytics' && hash === item.hash;
}

export default function RoleSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const hash = useHash();
  const [role, setRole] = useState('worker');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    setRole(localStorage.getItem('fairgig_role') || 'worker');
    setUserName(localStorage.getItem('fairgig_user_name') || '');
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('fairgig_access_token');
    localStorage.removeItem('fairgig_refresh_token');
    localStorage.removeItem('fairgig_role');
    localStorage.removeItem('fairgig_user_id');
    localStorage.removeItem('fairgig_user_name');
    localStorage.removeItem('fairgig_city_zone');
    localStorage.removeItem('fairgig_category');
    document.cookie = 'fairgig_access_token=; path=/; max-age=0';
    router.push('/login');
  }, [router]);

  const isAdvocate = role === 'advocate';

  if (isAdvocate) {
    return (
      <aside className="no-print sidebar flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-100">
        <div className="p-4">
          <div className="mb-8 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-black text-white">
              FG
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight text-white">FairGig</div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Advocate</div>
            </div>
          </div>
          <nav className="space-y-1">
            {advocateNav.map((item) => {
              const active = isAdvocateItemActive(pathname, hash, item);
              const href = advocateLinkHref(item);
              return (
                <Link
                  key={`${item.label}-${item.hash ?? 'root'}`}
                  href={href}
                  className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="mt-auto border-t border-slate-800 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-white">
              {userName ? userName.slice(0, 1).toUpperCase() : 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{userName || 'Advocate'}</p>
              <p className="truncate text-xs text-slate-400">Labour advocate</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full rounded-lg border border-slate-600 px-3 py-2 text-left text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            Sign out
          </button>
        </div>
      </aside>
    );
  }

  const links = workerVerifierRoutes[role] || workerVerifierRoutes.worker;

  return (
    <aside className="no-print sidebar w-64 shrink-0 border-r border-gray-200 bg-white p-4">
      <div className="mb-6 text-xl font-bold text-slate-900">FairGig</div>
      <nav className="space-y-2">
        {links.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded px-3 py-2 text-sm ${active ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-8 border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={logout}
          className="w-full rounded px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-100"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
