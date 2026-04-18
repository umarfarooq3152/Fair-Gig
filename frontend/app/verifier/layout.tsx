import VerifierShell from '@/components/verifier/verifier-shell';

export default function VerifierLayout({ children }: { children: React.ReactNode }) {
  return <VerifierShell>{children}</VerifierShell>;
}