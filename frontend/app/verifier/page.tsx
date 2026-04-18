import { redirect } from 'next/navigation';

export default function LegacyVerifierPage() {
  redirect('/queue');
}
