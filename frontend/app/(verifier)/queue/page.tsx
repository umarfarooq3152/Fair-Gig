'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LegacyQueueRoute() {
	const router = useRouter();

	useEffect(() => {
		router.replace('/verifier/queue');
	}, [router]);

	return <main className="p-6 text-sm text-slate-500">Redirecting to verifier queue…</main>;
}
