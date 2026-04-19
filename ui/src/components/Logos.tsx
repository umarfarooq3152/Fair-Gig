import { motion } from "motion/react";

export function Logos() {
  const platforms = [
    "Uber", "Lyft", "Foodpanda", "Bykea", "Fiverr", "Upwork", 
    "InDrive", "Careem", "DoorDash", "Instacart", "Daraz", "TaskRabbit"
  ];

  const duplicatedPlatforms = [...platforms, ...platforms, ...platforms];

  return (
    <section className="bg-white border-b border-ink/10 py-12 overflow-hidden relative">
      <div className="absolute left-1/2 -translate-x-1/2 top-0 -translate-y-1/2 bg-white px-4 z-20">
        <span className="mono-label !text-blueprint">Verified Ingress Sources</span>
      </div>
      
      <div className="relative flex overflow-hidden group">
        <motion.div
           animate={{
             x: ["0%", "-33.33%"],
           }}
           transition={{
             duration: 40,
             repeat: Infinity,
             ease: "linear",
           }}
           className="flex items-center gap-16 lg:gap-32 whitespace-nowrap min-w-max px-16"
        >
          {duplicatedPlatforms.map((name, i) => (
            <div
              key={i}
              className="flex items-center gap-4 opacity-20 hover:opacity-100 transition-all duration-700 cursor-pointer grayscale hover:grayscale-0"
            >
              <div className="h-2 w-2 bg-ink/10 hover:bg-blueprint transition-colors" />
              <span className="text-2xl lg:text-3xl font-black text-ink tracking-tighter uppercase italic">
                {name}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
