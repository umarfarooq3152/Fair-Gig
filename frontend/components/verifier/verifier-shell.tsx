'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  Clock3,
  Home,
  List,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { API_BASE, authFetch } from '@/lib/api';

type VerifierShellProps = {
  children: React.ReactNode;
};

const navItems = [
  { href: '/verifier/dashboard', label: 'Dashboard', icon: Home },
  { href: '/verifier/queue', label: 'Queue', icon: List },
  { href: '/verifier/history', label: 'History', icon: Clock3 },
];

const titleMap: Record<string, string> = {
  '/verifier/dashboard': 'Dashboard',
  '/verifier/queue': 'Queue',
  '/verifier/history': 'History',
};

function getInitials(name: string) {
  const parts = name
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || '').join('') || 'V';
}

export default function VerifierShell({ children }: VerifierShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('Verifier');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const boot = async () => {
      const token = localStorage.getItem('fairgig_access_token') || localStorage.getItem('fairgig_token') || '';
      if (!token) {
        router.replace('/login');
        return;
      }

      const role = localStorage.getItem('fairgig_role') || '';
      if (role !== 'verifier') {
        router.replace('/unauthorized');
        return;
      }

      const savedName = localStorage.getItem('fairgig_user_name') || 'Verifier';
      setName(savedName);

      try {
        const meRes = await authFetch(`${API_BASE.auth}/me`, { cache: 'no-store' });
        if (meRes.ok) {
          const me = await meRes.json();
          if (typeof me?.name === 'string' && me.name.trim()) {
            setName(me.name);
            localStorage.setItem('fairgig_user_name', me.name);
          }
          if (typeof me?.email === 'string') {
            setEmail(me.email);
          }
        }
      } catch {
        // no-op
      }

      setReady(true);
    };

    void boot();
  }, [router]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const pageTitle = useMemo(() => {
    const exact = titleMap[pathname];
    if (exact) return exact;
    if (pathname.startsWith('/verifier/dashboard')) return 'Dashboard';
    if (pathname.startsWith('/verifier/queue')) return 'Queue';
    if (pathname.startsWith('/verifier/history')) return 'History';
    return 'Verifier';
  }, [pathname]);

  const initials = getInitials(name);

  const onLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch {
      // no-op
    }

    localStorage.removeItem('fairgig_access_token');
    localStorage.removeItem('fairgig_refresh_token');
    localStorage.removeItem('fairgig_role');
    localStorage.removeItem('fairgig_user_id');
    localStorage.removeItem('fairgig_user_name');
    document.cookie = 'fairgig_access_token=; Max-Age=0; path=/';
    router.replace('/login');
  };

  if (!ready) {
    return <div className="min-h-screen bg-[#F8FAFC] p-8 text-sm text-slate-500">Loading verifier workspace…</div>;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-gray-200 bg-white text-slate-900 md:flex md:flex-col no-print sidebar">
        <div className="px-4 py-6 text-xl font-bold">FairGig</div>
        <nav className="flex-1 space-y-2 px-4">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded px-3 py-2 text-sm transition ${
                  active
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon size={16} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-200 px-4 py-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{name}</p>
              {email ? <p className="truncate text-xs text-slate-500">{email}</p> : null}
              <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">Verifier</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-red-600 transition hover:bg-red-50"
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-30 flex h-[60px] items-center justify-between border-b border-slate-200 bg-white px-4 md:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 md:hidden"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
            <h1 className="text-xl font-medium text-slate-900">{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-700"
              aria-label="Notifications"
            >
              <Bell size={16} />
              <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] text-white">
                0
              </span>
            </button>
          </div>
        </header>

        <main className="min-h-[calc(100vh-60px)] overflow-x-hidden p-4 md:p-8">{children}</main>
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/45"
            aria-label="Close menu overlay"
          />
          <div className="absolute inset-y-0 left-0 flex w-60 flex-col border-r border-gray-200 bg-white text-slate-900">
            <div className="flex items-center justify-between px-6 py-6">
              <span className="text-xl font-bold text-slate-900">FairGig</span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-slate-700"
                aria-label="Close menu"
              >
                <X size={16} />
              </button>
            </div>
            <nav className="flex-1 space-y-1 px-3">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 rounded px-3 py-2 text-sm transition ${
                      active
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-gray-200 px-4 py-4">
              <button
                type="button"
                onClick={onLogout}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-red-600 transition hover:bg-red-50"
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}