import './globals.css';
import type { Metadata } from 'next';
import LayoutShell from '@/components/layout-shell';

export const metadata: Metadata = {
  title: 'FairGig',
  description: 'Gig worker income and rights platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
