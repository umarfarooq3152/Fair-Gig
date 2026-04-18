'use client';

import { usePathname } from 'next/navigation';
import RoleSidebar from '@/components/role-sidebar';

const publicRoutes = ['/', '/login', '/register'];

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = publicRoutes.includes(pathname);

  if (isPublic) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className="flex min-h-screen">
      <RoleSidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
