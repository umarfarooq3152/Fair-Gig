'use client';

import React from 'react';
import { Menu, ShieldCheck, X } from 'lucide-react';
import Link from 'next/link';

export function Navbar() {
  const [open, setOpen] = React.useState(false);
  const links = [
    { name: 'Platform', href: '#features' },
    { name: 'Transparency', href: '#transparency' },
    { name: 'Verification', href: '#certificate' },
    { name: 'Advocacy', href: '#advocacy' },
  ];

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-12">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-slate-900"><ShieldCheck className="h-4 w-4 text-white" /></div>
          <span className="text-xl font-black uppercase tracking-tighter">Fair<span className="font-medium text-slate-400">Gig</span></span>
        </div>

        <div className="hidden items-center gap-10 lg:flex">
          {links.map((link) => (
            <a key={link.name} href={link.href} className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-500 hover:text-slate-900">
              {link.name}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 sm:flex">
          <Link href="/login" className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900">Sign In</Link>
          <Link href="/register" className="rounded-none bg-slate-900 px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white">Get Started</Link>
        </div>

        <button className="lg:hidden" onClick={() => setOpen((v) => !v)}>{open ? <X /> : <Menu />}</button>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white p-6 lg:hidden">
          <div className="flex flex-col gap-4">
            {links.map((link) => (
              <a key={link.name} href={link.href} onClick={() => setOpen(false)} className="text-[12px] font-black uppercase tracking-widest text-slate-900">
                {link.name}
              </a>
            ))}
            <div className="mt-3 flex gap-2">
              <Link href="/login" className="flex-1 border-2 border-slate-900 p-3 text-center text-[11px] font-black uppercase">Sign In</Link>
              <Link href="/register" className="flex-1 bg-slate-900 p-3 text-center text-[11px] font-black uppercase text-white">Get Started</Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
