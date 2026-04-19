'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Menu } from 'lucide-react';
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
  const [ready, setReady] = useState(isPublic);
  const [pageLoading, setPageLoading] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setPageLoading(true);
    const t = window.setTimeout(() => setPageLoading(false), 220);
    return () => window.clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isPublic) {
      setReady(true);
      return;
    }

    setReady(false);

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
    if (pathname.startsWith('/verifier') && role !== 'verifier') {
      router.replace(role === 'advocate' ? '/advocate/analytics' : '/dashboard');
      return;
    }
    if (
      (pathname.startsWith('/dashboard') ||
        pathname.startsWith('/shifts') ||
        pathname.startsWith('/certificate')) &&
      role === 'verifier'
    ) {
      router.replace('/verifier/queue');
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
  }, [isPublic, pathname]);

  if (!isPublic && !ready) {
    return <FullPageLoader />;
  }

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

  if (!ready) {
    return <FullPageLoader />;
  }

  return (
    <>
      {pageLoading ? <FullPageLoader /> : null}
      <div className="flex min-h-screen bg-slate-50">
        <div className="hidden md:block">
          <RoleSidebar variant="desktop" />
        </div>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-700"
              aria-label="Open navigation menu"
            >
              <Menu size={18} />
            </button>
            <div className="ml-3 text-sm font-bold uppercase tracking-[0.16em] text-slate-900">FairGig</div>
          </header>

          <AnimatePresence mode="wait" initial={false}>
            <motion.main
              key={pathname}
              className="flex-1 p-4 sm:p-6"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {children}
            </motion.main>
          </AnimatePresence>
        </div>
      </div>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 bg-slate-900/45"
            aria-label="Close navigation overlay"
          />
          <div className="absolute inset-y-0 left-0">
            <RoleSidebar variant="mobile" onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}
