import './globals.css';
import type { Metadata } from 'next';
import RoleSidebar from '@/components/role-sidebar';

export const metadata: Metadata = {
  title: 'FairGig',
  description: 'Gig worker income and rights platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <RoleSidebar />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
