import { redirect } from 'next/navigation';

export default function LegacyVerifierPage() {
  redirect('/verifier/dashboard');
}
