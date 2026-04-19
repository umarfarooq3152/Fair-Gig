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

  const words = "FairGig: Own Your Earnings. Prove Your Worth.".split(" ");

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
    <section ref={containerRef} className="relative overflow-hidden min-h-screen bg-[#F5F5F5] flex items-center pt-32 px-6 lg:px-12">
      {/* LlamaIndex Style Background Bars */}
      <VisualizerBars />

      <div className="relative z-10 mx-auto max-w-7xl w-full py-16">
        <div className="flex flex-col items-center text-center">
          <div className="flex flex-col items-center">
            {/* ... (Innovation Awards badge remains unchanged) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: [0, 0.71, 0.2, 1.01] }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-[11px] font-[900] uppercase tracking-[0.2em] text-slate-800 mb-10 shadow-sm"
            >
              <span className="h-2 w-2 rounded-full bg-mint-500" />
              SOFTEC 2026 Innovation Awards
            </motion.div>
            
            <motion.h1 
              variants={container}
              initial="hidden"
              animate="visible"
              className="text-5xl font-[800] tracking-[-0.04em] sm:text-8xl lg:text-[6.5rem] leading-[0.95] lg:leading-[0.88] text-slate-900 max-w-5xl flex flex-wrap justify-center overflow-visible"
            >
              {words.map((word, index) => (
                <motion.span
                  variants={child}
                  key={index}
                  className={cn(
                    "inline-block mr-[0.25em]",
                    word.includes("Worth.") && "text-mint-500"
                  )}
                >
                  {word}
                </motion.span>
              ))}
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.2 }}
              className="mt-8 lg:mt-12 max-w-2xl text-base lg:text-lg text-slate-600 leading-relaxed font-medium px-4"
            >
              FairGig is the standardized protocol to aggregate, verify, and leverage your multi-platform earnings. The data layer that empowers 2026's mobile workforce.
            </motion.p>
            
            <div className="mt-12 lg:mt-20 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-24 w-full max-w-5xl relative">
                {/* Platform Sources Grid (Left) */}
                <div className="z-20 grid grid-cols-2 gap-4 lg:gap-6">
                    {[
                        { ref: uberRef, label: "Uber" },
                        { ref: fiverrRef, label: "Fiverr" },
                        { ref: upworkRef, label: "Upwork" },
                        { ref: foodpandaRef, label: "Foodpanda" },
                    ].map((platform, i) => (
                        <motion.div 
                            key={i}
                            ref={platform.ref}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 1.6 + i * 0.1, duration: 0.8 }}
                            className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-slate-100 bg-white shadow-sm"
                        >
                            <Database className="h-6 w-6 text-slate-400" />
                        </motion.div>
                    ))}
                </div>

                {/* FairGig Central Hub (Process Node) */}
                <motion.div 
                   ref={hubRef}
                   initial={{ opacity: 0, scale: 0.8 }}
                   animate={{ opacity: 1, scale: 1 }}
                   transition={{ delay: 2, duration: 1 }}
                   className="z-30 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-slate-900 shadow-2xl relative"
                >
                    <div className="absolute -inset-4 rounded-full border border-slate-200 animate-[spin_10s_linear_infinite] pointer-events-none" />
                    <ShieldCheck className="h-10 w-10 text-white" />
                </motion.div>

                {/* Verified Vault (Right) */}
                <motion.div 
                    ref={vaultRef}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 2.2, duration: 1 }}
                    className="z-20 flex h-20 w-20 items-center justify-center rounded-3xl border-4 border-purple-50 bg-white shadow-[0_30px_60px_rgba(139,92,246,0.1)] relative"
                >
                    <div className="absolute inset-0 rounded-3xl bg-purple-500/5 animate-pulse" />
                    <Lock className="h-8 w-8 text-purple-600 relative z-10" />
                </motion.div>

                {/* Animated Beams: Platforms -> FairGig */}
                <AnimatedBeam containerRef={containerRef} fromRef={uberRef} toRef={hubRef} curvature={-40} duration={3} pathColor="rgba(0,209,255,0.1)" gradientStartColor="#00d1ff" gradientStopColor="#00b8e6" />
                <AnimatedBeam containerRef={containerRef} fromRef={fiverrRef} toRef={hubRef} curvature={40} duration={3.5} pathColor="rgba(0,209,255,0.1)" gradientStartColor="#00d1ff" gradientStopColor="#00b8e6" />
                <AnimatedBeam containerRef={containerRef} fromRef={upworkRef} toRef={hubRef} curvature={-60} duration={4} pathColor="rgba(0,209,255,0.1)" gradientStartColor="#00d1ff" gradientStopColor="#00b8e6" />
                <AnimatedBeam containerRef={containerRef} fromRef={foodpandaRef} toRef={hubRef} curvature={60} duration={4.5} pathColor="rgba(0,209,255,0.1)" gradientStartColor="#00d1ff" gradientStopColor="#00b8e6" />

                {/* Animated Beam: FairGig Logo -> Verified Vault (Electric Purple Core Request) */}
                <AnimatedBeam
                  containerRef={containerRef}
                  fromRef={hubRef}
                  toRef={vaultRef}
                  curvature={0} // Straight hub-to-vault beam
                  duration={2.5}
                  pathColor="rgba(139,92,246,0.1)"
                  gradientStartColor="#8B5CF6"
                  gradientStopColor="#D8B4FE"
                  pathWidth={4} // Slightly thicker core beam
                />
            </div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.8 }}
              className="mt-12 lg:mt-20 flex flex-col sm:flex-row gap-4 items-center w-full px-6 justify-center"
            >
              <Button size="lg" className="w-full sm:w-auto h-14 px-10 text-[14px] font-[900] uppercase tracking-widest bg-slate-900 text-white hover:bg-slate-800 shadow-2xl rounded-none">
                Get Started
              </Button>
              <Button variant="outline" size="lg" className="w-full sm:w-auto h-14 px-10 text-[14px] font-[900] uppercase tracking-widest border-slate-200 bg-white text-slate-900 hover:bg-slate-50 rounded-none border-2">
                Book a Demo
              </Button>
            </motion.div>
          </div>

          {/* Central Layered Card Visual (Moved down slightly) */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 2 }}
            className="mt-32 relative w-full max-w-2xl aspect-[4/3] flex items-center justify-center p-12"
          >
            {/* Sheet Stack Effect */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[80%] h-[80%] bg-white border-2 border-slate-200 translate-y-8 translate-x-8 shadow-sm opacity-50" />
                <div className="absolute w-[80%] h-[80%] bg-white border-2 border-slate-200 translate-y-4 translate-x-4 shadow-md opacity-80" />
                <div className="absolute w-[80%] h-[80%] bg-white border-b-4 border-r-4 border-mint-500 shadow-2xl flex flex-col items-center justify-center p-12 -translate-y-4 -translate-x-4">
                    <div className="h-24 w-24 bg-mint-500/10 rounded-full flex items-center justify-center mb-6">
                        <Lock className="h-12 w-12 text-mint-500" />
                    </div>
                    <div className="text-[12px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">FairGig Protocol</div>
                    <div className="text-xl font-black text-slate-900 text-center uppercase tracking-tighter">
                        [ FROM 'INCOME' TO <br /> 'STRUCTURED ASSET' ... ]
                    </div>
                    
                    {/* Decorative Code Lines */}
                    <div className="mt-12 w-full space-y-2 opacity-10">
                        <div className="h-1.5 w-full bg-slate-900 rounded" />
                        <div className="h-1.5 w-2/3 bg-slate-900 rounded" />
                        <div className="h-1.5 w-3/4 bg-slate-900 rounded" />
                    </div>
                </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
