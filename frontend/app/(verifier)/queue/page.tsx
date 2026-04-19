'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LegacyQueueRoute() {
	const router = useRouter();

	useEffect(() => {
		router.replace('/verifier/queue');
	}, [router]);

	return (
		<div className="fixed inset-0 z-[210] flex items-center justify-center bg-white/35 backdrop-blur-sm">
			<div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
		</div>
	);
}
