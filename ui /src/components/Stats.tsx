import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export function Stats() {
  const stats = [
    { label: "Aggregate Volume", value: "1.2B+", detail: "US Dollars Verified" },
    { label: "Request Velocity", value: "50M+", detail: "Monthly API Ingress" },
    { label: "Identity Wallets", value: "300k+", detail: "Unique Verified Nodes" },
  ];

  return (
    <section className="bg-white border-y border-ink/10">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid grid-cols-1 md:grid-cols-3">
          {stats.map((stat, i) => (
            <div 
                key={i} 
                className={cn(
                    "flex flex-col p-12 lg:p-20 relative group hover:bg-paper transition-colors duration-500",
                    i < stats.length - 1 && "md:grid-divider-v",
                    i > 0 && "border-t border-ink/10 md:border-t-0"
                )}
            >
                <div className="absolute top-8 left-12 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 bg-blueprint" />
                    <span className="mono-label">{stat.label}</span>
                </div>
                
                <div className="mt-8">
                    <motion.span 
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 1, delay: i * 0.1 }}
                        className="text-7xl lg:text-8xl font-black text-ink tracking-tighter"
                    >
                        {stat.value}
                    </motion.span>
                </div>

                <div className="mt-4 flex justify-between items-end">
                    <p className="text-[10px] font-bold text-ink/40 uppercase tracking-widest">{stat.detail}</p>
                    <span className="text-[10px] font-mono text-blueprint opacity-0 group-hover:opacity-100 transition-opacity">OK.verified</span>
                </div>

                {/* Decorative Grid Corner */}
                <div className="absolute bottom-4 right-4 h-4 w-4 border-b border-r border-ink/5" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
