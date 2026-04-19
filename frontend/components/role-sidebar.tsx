'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';

const workerVerifierRoutes: Record<string, Array<{ href: string; label: string }>> = {
  worker: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/shifts', label: 'Shifts' },
    { href: '/certificate', label: 'Certificate' },
    { href: '/community', label: 'Community' },
  ],
  verifier: [{ href: '/verifier/queue', label: 'Verifier queue' }],
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

type RoleSidebarProps = {
  variant?: 'desktop' | 'mobile';
  onNavigate?: () => void;
};

export default function RoleSidebar({ variant = 'desktop', onNavigate }: RoleSidebarProps) {
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

  const links = isAdvocate ? advocateNav.map((item) => ({ href: advocateLinkHref(item), label: item.label })) : (workerVerifierRoutes[role] || workerVerifierRoutes.worker);

  const isActive = (href: string, label: string) => {
    if (isAdvocate) {
      const navItem = advocateNav.find((item) => item.label === label);
      if (!navItem) return pathname === href;
      return isAdvocateItemActive(pathname, hash, navItem);
    }
    return pathname === href || (href === '/queue' && pathname === '/verifier/queue');
  };

  const roleLabel = isAdvocate ? 'Labour advocate' : role === 'verifier' ? 'Verifier' : 'Worker';

  const desktop = variant === 'desktop';

  return (
    <aside
      className={`no-print sidebar flex shrink-0 flex-col border-r border-slate-200 bg-white text-slate-700 ${
        desktop ? 'sticky top-0 h-screen w-64' : 'h-full w-72 max-w-[85vw]'
      }`}
    >
      <div className="border-b border-slate-100 p-4">
        <div className="mb-8 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-sm font-black text-white">
            FG
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight text-slate-900">FairGig</div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{role}</div>
          </div>
          </div>
          {!desktop ? (
            <button
              type="button"
              onClick={onNavigate}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600"
              aria-label="Close navigation"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <nav className="space-y-1">
        {links.map((item) => {
          const active = isActive(item.href, item.label);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      </div>

      <div className="mt-auto border-t border-slate-200 bg-slate-50/60 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
            {userName ? userName.slice(0, 1).toUpperCase() : roleLabel.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{userName || roleLabel}</p>
            <p className="truncate text-xs text-slate-500">{roleLabel}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            logout();
          }}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
