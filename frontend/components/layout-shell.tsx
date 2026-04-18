'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import RoleSidebar from '@/components/role-sidebar';

const publicRoutes = ['/', '/login', '/register', '/unauthorized'];

function FullPageLoader() {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white/35 backdrop-blur-sm">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
    </div>
  );
}

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = publicRoutes.includes(pathname);
  const usesDedicatedLayout = pathname.startsWith('/verifier');
  const [ready, setReady] = useState(isPublic);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    setPageLoading(true);
    const t = window.setTimeout(() => setPageLoading(false), 220);
    return () => window.clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    if (isPublic || usesDedicatedLayout) {
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
  }, [isPublic, pathname, router, usesDedicatedLayout]);

  if (isPublic) {
    return (
      <>
        {pageLoading ? <FullPageLoader /> : null}
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={pathname}
            className="min-h-screen"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </>
    );
  }

  if (usesDedicatedLayout) {
    return (
      <>
        {pageLoading ? <FullPageLoader /> : null}
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={pathname}
            className="min-h-screen"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </>
    );
  }

  if (!ready) {
    return <FullPageLoader />;
  }

  return (
    <>
      {pageLoading ? <FullPageLoader /> : null}
      <div className="flex min-h-screen">
        <RoleSidebar />
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={pathname}
            className="flex-1 p-6"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>
    </>
  );
}
