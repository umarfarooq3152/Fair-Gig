'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import RoleSidebar from '@/components/role-sidebar';

const publicRoutes = ['/', '/login', '/register'];

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = publicRoutes.includes(pathname);
  const [ready, setReady] = useState(isPublic);

  useEffect(() => {
    if (isPublic) {
      setReady(true);
      return;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('fairgig_access_token') : '';
    if (!token) {
      router.replace('/login');
      return;
    }

    const role = localStorage.getItem('fairgig_role') || 'worker';

    if (pathname.startsWith('/advocate') && role !== 'advocate') {
      router.replace(role === 'verifier' ? '/queue' : '/dashboard');
      return;
    }
    if (pathname.startsWith('/queue') && role !== 'verifier') {
      router.replace(role === 'advocate' ? '/advocate/analytics' : '/dashboard');
      return;
    }
    if (
      (pathname.startsWith('/dashboard') ||
        pathname.startsWith('/shifts') ||
        pathname.startsWith('/certificate')) &&
      role === 'verifier'
    ) {
      router.replace('/queue');
      return;
    }
    if (
      (pathname.startsWith('/dashboard') ||
        pathname.startsWith('/shifts') ||
        pathname.startsWith('/certificate')) &&
      role === 'advocate'
    ) {
      router.replace('/advocate/analytics');
      return;
    }

    setReady(true);
  }, [isPublic, pathname, router]);

  if (isPublic) {
    return <main className="min-h-screen">{children}</main>;
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
        Checking session…
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <RoleSidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
