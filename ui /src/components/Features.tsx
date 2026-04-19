import React from "react";
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";
import { motion } from "motion/react";
import { 
  TrendingUp, 
  BrainCircuit, 
  FileCheck, 
  ShieldAlert,
  Wallet,
  Lock,
  Globe,
  Database,
  Fingerprint
} from "lucide-react";

export function Features() {
  const items = [
    {
      title: "Cross-Platform Sync",
      description: "Aggregate multi-platform earnings with institutional precision from Uber, Fiverr, and Upwork.",
      header: <SkeletonOne />,
      className: "md:col-span-2",
      icon: <TrendingUp className="h-4 w-4 text-mint-500" />,
    },
    {
      title: "Protocol Standardization",
      description: "Convert chaotic platform statements into bank-ready structured assets.",
      header: <SkeletonTwo />,
      className: "md:col-span-1",
      icon: <Database className="h-4 w-4 text-slate-500" />,
    },
    {
      title: "Reputation Layers",
      description: "Build a verifiable financial identity that transcends platform lock-in.",
      header: <SkeletonThree />,
      className: "md:col-span-1",
      icon: <Fingerprint className="h-4 w-4 text-slate-500" />,
    },
    {
      title: "Borderless Verification",
      description: "Your proof of work is now an exportable credential valid across 180+ countries.",
      header: <SkeletonFour />,
      className: "md:col-span-2",
      icon: <Globe className="h-4 w-4 text-mint-500" />,
    },
  ];

  return (
    <section id="features" className="bg-white py-24 sm:py-32 overflow-hidden">
      <div className="mx-auto max-w-7xl px-8 lg:px-12">
        <div className="flex flex-col mb-16">
          <h2 className="text-sm font-black uppercase tracking-[0.3em] text-mint-500 mb-4">Core Capabilities</h2>
          <h3 className="text-4xl lg:text-5xl font-black tracking-tighter text-slate-900 leading-none">
            Infrastructure for the <br />
            New Gig Economy.
          </h3>
        </div>
        <BentoGrid className="mx-auto">
          {items.map((item, i) => (
            <BentoGridItem
              key={i}
              title={item.title}
              description={item.description}
              header={item.header}
              className={item.className}
              icon={item.icon}
            />
          ))}
        </BentoGrid>
      </div>
    </section>
  );
}

const SkeletonOne = () => (
  <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-2xl bg-slate-50 p-6 border border-slate-100 flex-col gap-2 overflow-hidden group-hover/bento:bg-mint-50/30 transition-colors duration-500">
    <div className="flex gap-2 items-end h-full">
      {[40, 70, 45, 90, 65, 80, 50, 85].map((h, i) => (
        <motion.div
           key={i}
           initial={{ height: 0 }}
           animate={{ height: `${h}%` }}
           whileHover={{ height: `${Math.min(100, h + 15)}%` }}
           transition={{ duration: 1, delay: i * 0.05 }}
           className="flex-1 bg-mint-500/20 border-t border-x border-mint-500/20 rounded-t-lg group-hover/bento:bg-mint-500/40 transition-colors"
        />
      ))}
    </div>
  </div>
);

const SkeletonTwo = () => (
  <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-2xl bg-slate-50 p-8 border border-slate-100 items-center justify-center group-hover/bento:bg-slate-100/50 transition-colors duration-500">
    <div className="grid grid-cols-3 gap-3 w-full max-w-[120px]">
      <motion.div whileHover={{ scale: 1.1 }} className="h-2 bg-slate-200 rounded-full col-span-2" />
      <motion.div whileHover={{ scale: 1.1 }} className="h-2 bg-mint-500/40 rounded-full col-span-1" />
      <motion.div whileHover={{ scale: 1.1 }} className="h-2 bg-slate-200 rounded-full col-span-1" />
      <motion.div whileHover={{ scale: 1.1 }} className="h-2 bg-slate-200 rounded-full col-span-2" />
      <motion.div whileHover={{ scale: 1.1 }} className="h-2 bg-mint-500 rounded-full col-span-3" />
    </div>
  </div>
);

const SkeletonThree = () => (
  <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-2xl bg-slate-50 border border-slate-100 items-center justify-center p-4 group-hover/bento:bg-mint-50/20 transition-colors duration-500">
    <motion.div 
      animate={{ rotate: 360 }}
      transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      className="h-20 w-20 rounded-full border-[6px] border-slate-200 border-t-mint-500 flex items-center justify-center relative"
    >
        <div className="h-2 w-2 bg-mint-500 rounded-full absolute top-0" />
    </motion.div>
  </div>
);

const SkeletonFour = () => (
  <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-2xl bg-slate-50 p-6 border border-slate-100 relative overflow-hidden group-hover/bento:bg-slate-100 transition-colors duration-500">
    <div className="absolute top-4 right-4 group-hover/bento:scale-110 group-hover/bento:rotate-6 transition-transform duration-500">
        <FileCheck className="h-14 w-14 text-mint-500/30" />
    </div>
    <div className="mt-auto space-y-3 pb-2">
      <div className="h-3 w-1/2 bg-slate-200 rounded-lg" />
      <div className="h-3 w-3/4 bg-slate-200 rounded-lg" />
      <div className="h-1.5 w-1/3 bg-mint-500/30 rounded-full" />
    </div>
  </div>
);

