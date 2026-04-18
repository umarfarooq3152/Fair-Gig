'use client';

import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import RoleSidebar from '@/components/role-sidebar';

const publicRoutes = ['/', '/login', '/register'];

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = publicRoutes.includes(pathname);

  if (isPublic) {
    return (
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
    );
  }

  return (
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
  );
}
