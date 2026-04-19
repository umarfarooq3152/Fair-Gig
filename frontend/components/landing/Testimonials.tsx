'use client';

import { motion } from 'motion/react';

const testimonials = [
  {
    name: 'Ahmed Khan',
    role: 'Top-Rated Full-Stack Developer',
    quote: 'FairGig solved the biggest hurdle for Pakistani freelancers—financial proof. I used my verified global earnings to secure a business loan.',
    platform: 'Upwork & Fiverr',
    gradient: 'from-blue-50 to-indigo-100',
    avatar: 'https://i.pravatar.cc/150?u=ahmed',
  },
  {
    name: 'Zainab Malik',
    role: 'Creative Content Strategist',
    quote: 'Standardizing my scattered income from multiple platforms was a game-changer for my visa application.',
    platform: 'Fiverr & LinkedIn',
    gradient: 'from-purple-50 to-pink-100',
    avatar: 'https://i.pravatar.cc/150?u=zainab',
  },
  {
    name: 'Hamza Siddiqui',
    role: 'Logistics & Delivery Expert',
    quote: 'Tracking my multi-app earnings in one place helped me manage expenses and save for my first car.',
    platform: 'Bykea & Foodpanda',
    gradient: 'from-mint-50 to-blue-100',
    avatar: 'https://i.pravatar.cc/150?u=hamza',
  },
];

export function Testimonials() {
  return (
    <section id="advocacy" className="bg-[#F5F5F5] py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-8 lg:px-12">
        <h2 className="mb-4 text-sm font-black uppercase tracking-[0.3em] text-purple-600">Worker Success</h2>
        <h3 className="mb-16 text-4xl font-black leading-none tracking-tighter text-slate-900 lg:text-5xl">Proven Results in the <br /> Real Economy.</h3>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.div key={t.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: i * 0.1 }} viewport={{ once: true }} className={`relative flex h-full flex-col rounded-[40px] border border-white/50 bg-gradient-to-br p-10 shadow-sm ${t.gradient}`}>
              <div className="mb-10 flex items-center gap-4">
                <img src={t.avatar} alt={t.name} className="h-14 w-14 rounded-full border-2 border-white object-cover shadow-md" referrerPolicy="no-referrer" />
                <div>
                  <div className="text-[13px] font-black uppercase tracking-wide text-slate-900">{t.name}</div>
                  <div className="text-[10px] font-medium uppercase tracking-widest text-slate-500">{t.role}</div>
                </div>
              </div>
              <p className="mb-8 flex-1 text-[22px] font-bold leading-tight tracking-tight text-slate-800">“{t.quote}”</p>
              <div className="inline-flex w-fit items-center rounded-full border border-white/50 bg-white/40 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">{t.platform}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
