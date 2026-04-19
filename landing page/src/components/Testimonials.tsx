import React from "react";
import { motion } from "motion/react";

const testimonials = [
  {
    name: "Ahmed Khan",
    role: "Top-Rated Full-Stack Developer",
    quote: "FairGig solved the biggest hurdle for Pakistani freelancers—financial proof. I used my verified global earnings to secure a business loan from a local bank.",
    platform: "Upwork & Fiverr",
    gradient: "from-blue-50 to-indigo-100",
    avatar: "https://i.pravatar.cc/150?u=ahmed"
  },
  {
    name: "Zainab Malik",
    role: "Creative Content Strategist",
    quote: "Standardizing my scattered income from multiple platforms was a game-changer for my visa application. FairGig provides the credibility we desperately needed.",
    platform: "Fiverr & LinkedIn",
    gradient: "from-purple-50 to-pink-100",
    avatar: "https://i.pravatar.cc/150?u=zainab"
  },
  {
    name: "Hamza Siddiqui",
    role: "Logistics & Delivery Expert",
    quote: "The Verified Vault is incredible. Tracking my multi-app earnings in one place helped me manage my family's expenses and save for my first car.",
    platform: "Bykea & Foodpanda",
    gradient: "from-mint-50 to-blue-100",
    avatar: "https://i.pravatar.cc/150?u=hamza"
  }
];

export function Testimonials() {
  return (
    <section id="advocacy" className="bg-[#F5F5F5] py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-8 lg:px-12">
        <div className="flex flex-col mb-16">
          <h2 className="text-sm font-black uppercase tracking-[0.3em] text-purple-600 mb-4">Worker Success</h2>
          <h3 className="text-4xl lg:text-5xl font-black tracking-tighter text-slate-900 leading-none">
            Proven Results in the <br />
            Real Economy.
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: i * 0.1 }}
              viewport={{ once: true }}
              className={`relative flex flex-col h-full rounded-[40px] p-10 bg-gradient-to-br ${t.gradient} border border-white/50 shadow-sm overflow-hidden`}
            >
              {/* Card Content */}
              <div className="flex items-center gap-4 mb-10">
                <img 
                   src={t.avatar} 
                   alt={t.name} 
                   className="h-14 w-14 rounded-full border-2 border-white shadow-md object-cover"
                   referrerPolicy="no-referrer"
                />
                <div className="flex flex-col">
                  <span className="text-[13px] font-black text-slate-900 uppercase tracking-wide">{t.name}</span>
                  <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">{t.role}</span>
                </div>
              </div>

              <blockquote className="flex-1">
                <p className="text-[22px] font-bold text-slate-800 leading-tight tracking-tight mb-8">
                  &ldquo;{t.quote}&rdquo;
                </p>
              </blockquote>

              <div className="mt-auto">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/40 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600 backdrop-blur-sm border border-white/50">
                   {t.platform}
                </div>
              </div>

              {/* Decorative Subtle Fade at bottom */}
              <div className="absolute -bottom-10 -right-10 h-32 w-32 bg-white/20 rounded-full blur-3xl" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
