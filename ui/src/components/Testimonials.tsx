import React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

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
    <section id="advocacy" className="bg-paper py-24 sm:py-32 border-b border-ink/10 relative overflow-hidden">
      {/* Structural Accent */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-white/30 skew-x-[-20deg] translate-x-1/2 pointer-events-none" />

      <div className="mx-auto max-w-7xl px-6 lg:px-12 relative z-10">
        <div className="flex flex-col mb-20">
          <div className="flex items-center gap-4 mb-6">
            <span className="h-0.5 w-12 bg-blueprint" />
            <span className="mono-label">Human Consensus</span>
          </div>
          <h2 className="text-huge text-ink">
            Economic <br />
            <span className="text-ink/20">Mobility.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-ink/10">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: i * 0.1 }}
              viewport={{ once: true }}
              className={cn(
                "flex flex-col p-10 bg-white hover:bg-paper transition-colors duration-500",
                i < testimonials.length - 1 && "md:grid-divider-v",
                i > 0 && "border-t border-ink/10 md:border-t-0"
              )}
            >
              <div className="flex items-center gap-4 mb-10">
                <img 
                   src={t.avatar} 
                   alt={t.name} 
                   className="h-12 w-12 rounded-none grayscale group-hover:grayscale-0 transition-all border border-ink/10"
                   referrerPolicy="no-referrer"
                />
                <div className="flex flex-col">
                  <span className="text-[11px] font-black text-ink uppercase tracking-wider leading-none mb-1">{t.name}</span>
                  <span className="mono-label text-[8px] leading-none">{t.role}</span>
                </div>
              </div>

              <blockquote className="flex-1 mb-10">
                <p className="text-[20px] font-bold text-ink leading-tight tracking-tight">
                  &ldquo;{t.quote}&rdquo;
                </p>
              </blockquote>

              <div className="flex justify-between items-center">
                <div className="inline-flex items-center gap-3">
                   <div className="h-1.5 w-1.5 rounded-full bg-blueprint" />
                   <span className="mono-label !text-ink/80">{t.platform}</span>
                </div>
                <div className="h-4 w-4 border-r border-b border-ink/10" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
