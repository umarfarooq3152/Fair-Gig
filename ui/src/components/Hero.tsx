import { motion } from "motion/react";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { Spotlight } from "@/components/ui/spotlight";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import { useRef } from "react";
import { Share2, Lock, CheckCircle2, ShieldCheck, Database, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const VisualizerBars = () => {
    return (
        <div className="absolute inset-0 flex items-center justify-center opacity-40">
            <div className="flex gap-1 items-end h-full py-20 translate-y-20">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((h, i) => (
                    <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${h * 10}%` }}
                        transition={{
                            duration: 1,
                            delay: i * 0.05,
                            ease: "easeOut"
                        }}
                        className="w-8 lg:w-12 bg-gradient-to-t from-transparent via-mint-500/20 to-mint-500/10"
                    />
                ))}
            </div>
        </div>
    );
};

export function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const vaultRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLDivElement>(null); // FairGig Hub
  const uberRef = useRef<HTMLDivElement>(null);
  const fiverrRef = useRef<HTMLDivElement>(null);
  const upworkRef = useRef<HTMLDivElement>(null);
  const foodpandaRef = useRef<HTMLDivElement>(null);

  const words = "Own Your Earnings. Prove Your Worth.".split(" ");

  const container = {
    hidden: { opacity: 0 },
    visible: (i = 1) => ({
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.3 * i },
    }),
  };

  const child = {
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        damping: 12,
        stiffness: 200,
      },
    },
    hidden: {
      opacity: 0,
      y: 40,
      transition: {
        type: "spring",
        damping: 12,
        stiffness: 200,
      },
    },
  };

  return (
    <section ref={containerRef} className="relative overflow-hidden min-h-screen bg-paper flex flex-col items-center pt-20">
      {/* Structural Decoration */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] overflow-hidden">
         <div className="absolute top-0 left-1/4 w-px h-full bg-ink" />
         <div className="absolute top-0 left-2/4 w-px h-full bg-ink" />
         <div className="absolute top-0 left-3/4 w-px h-full bg-ink" />
         <div className="absolute top-1/4 left-0 w-full h-px bg-ink" />
         <div className="absolute top-2/4 left-0 w-full h-px bg-ink" />
      </div>

      <div className="relative z-10 w-full">
        {/* Top Header Rail */}
        <div className="w-full border-b border-ink/10 flex justify-between h-14 items-center px-6 lg:px-12 bg-white/50">
            <div className="flex items-center gap-6">
                <span className="mono-label">Protocol v2.0.26</span>
                <span className="mono-label">Lat: 31.4826 N / Lon: 74.3252 E</span>
            </div>
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-mint-500 animate-pulse" />
                    <span className="mono-label text-ink">SOFTEC 2026 Innovation Awards</span>
                </div>
            </div>
        </div>

        <div className="flex flex-col items-center text-center py-20 lg:py-32 border-b border-ink/10">
            <div className="px-6">
                <motion.h1 
                  variants={container}
                  initial="hidden"
                  animate="visible"
                  className="text-huge text-ink max-w-[1400px]"
                >
                  {words.map((word, index) => (
                    <motion.span
                      variants={child}
                      key={index}
                      className={cn(
                        "inline-block mr-[0.25em]",
                        word.includes("Worth.") && "text-blueprint"
                      )}
                    >
                      {word}
                    </motion.span>
                  ))}
                </motion.h1>
                
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 1.2 }}
                  className="mt-12 flex flex-col lg:flex-row items-center justify-center gap-12"
                >
                    <p className="max-w-xl text-lg text-ink/60 leading-relaxed font-medium lg:text-left px-4 border-l-4 border-blueprint lg:pl-8">
                        The standardized protocol to aggregate, verify, and leverage your multi-platform gig earnings. A cryptographically secure data layer for the modern economy.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-0 border border-ink overflow-hidden">
                      <Button size="lg" className="h-16 px-10 text-[12px] font-black uppercase tracking-widest bg-ink text-paper hover:bg-blueprint hover:text-ink rounded-none transition-all">
                        Get Started
                      </Button>
                      <Button variant="ghost" size="lg" className="h-16 px-10 text-[12px] font-black uppercase tracking-widest text-ink hover:bg-white rounded-none border-t sm:border-t-0 sm:border-l border-ink/10">
                        View Specs
                      </Button>
                    </div>
                </motion.div>
            </div>
        </div>

        {/* Technical Visualization Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr_1.5fr] w-full border-b border-ink/10 bg-white/30 p-2 lg:p-0">
            <div className="flex flex-col p-12 lg:p-24 lg:grid-divider-v items-center lg:items-start justify-center relative overflow-hidden">
                <span className="rail-text absolute left-4 top-1/2 -translate-y-1/2 opacity-10">Platform Ingress</span>
                <div className="z-20 grid grid-cols-2 gap-4 lg:gap-8">
                    {[
                        { ref: uberRef, label: "Uber" },
                        { ref: fiverrRef, label: "Fiverr" },
                        { ref: upworkRef, label: "Upwork" },
                        { ref: foodpandaRef, label: "Foodpanda" },
                    ].map((platform, i) => (
                        <motion.div 
                            key={i}
                            ref={platform.ref}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 1.6 + i * 0.1, duration: 0.8 }}
                            className="blueprint-surface flex h-20 w-20 flex-col items-center justify-center gap-2 group hover:border-blueprint transition-colors"
                        >
                            <Database className="h-6 w-6 text-ink/30 group-hover:text-blueprint transition-colors" />
                            <span className="mono-label text-[8px] group-hover:text-ink">{platform.label}</span>
                        </motion.div>
                    ))}
                </div>
            </div>

            <div className="flex items-center justify-center p-12 lg:p-24 lg:grid-divider-v relative">
                <motion.div 
                   ref={hubRef}
                   initial={{ opacity: 0, scale: 0.8 }}
                   animate={{ opacity: 1, scale: 1 }}
                   transition={{ delay: 2, duration: 1 }}
                   className="z-30 flex h-32 w-32 items-center justify-center border-2 border-ink bg-white relative"
                >
                    <div className="absolute -inset-6 border border-blueprint/20 animate-pulse" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-full w-px bg-blueprint/10 animate-[scale-y_2s_infinite]" />
                        <div className="h-px w-full bg-blueprint/10 animate-[scale-x_2s_infinite]" />
                    </div>
                    <ShieldCheck className="h-12 w-12 text-ink" />
                    <span className="mono-label absolute -bottom-8 whitespace-nowrap">FairGig Node 01</span>
                </motion.div>
            </div>

            <div className="flex flex-col p-12 lg:p-24 items-center lg:items-end justify-center relative overflow-hidden">
                <span className="rail-text absolute right-4 top-1/2 -translate-y-1/2 opacity-10">Verified Asset</span>
                <motion.div 
                    ref={vaultRef}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 2.2, duration: 1 }}
                    className="z-20 blueprint-surface flex h-32 w-32 flex-col items-center justify-center gap-4 group"
                >
                    <div className="h-12 w-12 bg-ink/5 flex items-center justify-center">
                        <Lock className="h-6 w-6 text-ink" />
                    </div>
                    <span className="mono-label text-ink">Vault.Proof</span>
                </motion.div>
            </div>

            {/* Beams */}
            <AnimatedBeam containerRef={containerRef} fromRef={uberRef} toRef={hubRef} curvature={-40} duration={3} pathColor="rgba(139,92,246,0.1)" gradientStartColor="#8B5CF6" gradientStopColor="#00D1FF" />
            <AnimatedBeam containerRef={containerRef} fromRef={fiverrRef} toRef={hubRef} curvature={40} duration={3.5} pathColor="rgba(139,92,246,0.1)" gradientStartColor="#8B5CF6" gradientStopColor="#00D1FF" />
            <AnimatedBeam containerRef={containerRef} fromRef={upworkRef} toRef={hubRef} curvature={-60} duration={4} pathColor="rgba(139,92,246,0.1)" gradientStartColor="#8B5CF6" gradientStopColor="#00D1FF" />
            <AnimatedBeam containerRef={containerRef} fromRef={foodpandaRef} toRef={hubRef} curvature={60} duration={4.5} pathColor="rgba(139,92,246,0.1)" gradientStartColor="#8B5CF6" gradientStopColor="#00D1FF" />

            <AnimatedBeam
              containerRef={containerRef}
              fromRef={hubRef}
              toRef={vaultRef}
              curvature={0}
              duration={2.5}
              pathColor="rgba(139,92,246,0.2)"
              gradientStartColor="#8B5CF6"
              gradientStopColor="#8B5CF6"
              pathWidth={3}
            />
        </div>
      </div>
    </section>
  );
}
