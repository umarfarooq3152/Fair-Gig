import { motion } from "motion/react";

export function Logos() {
  const platforms = [
    "Uber", "Lyft", "Foodpanda", "Bykea", "Fiverr", "Upwork", 
    "InDrive", "Careem", "DoorDash", "Instacart", "Daraz", "TaskRabbit"
  ];

  // Duplicate for infinite loop
  const duplicatedPlatforms = [...platforms, ...platforms, ...platforms];

  return (
    <section id="transparency" className="bg-white py-14 border-b border-slate-100 overflow-hidden relative">
      <div className="mx-auto max-w-7xl px-6 lg:px-12 mb-10">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300 text-center">
          Infrastructuring Global & Local Income Streams
        </p>
      </div>

      <div className="relative flex overflow-hidden group">
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

        <motion.div
           animate={{
             x: ["0%", "-33.33%"],
           }}
           transition={{
             duration: 30, // Slightly faster for text ticker
             repeat: Infinity,
             ease: "linear",
           }}
           className="flex items-center gap-12 lg:gap-24 whitespace-nowrap min-w-max px-8"
        >
          {duplicatedPlatforms.map((name, i) => (
            <div
              key={i}
              className="flex items-center justify-center opacity-30 hover:opacity-100 transition-all duration-500 cursor-pointer"
            >
              <span className="text-[14px] font-[800] uppercase tracking-[0.25em] text-slate-900 hover:text-mint-500 transition-colors">
                {name}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
