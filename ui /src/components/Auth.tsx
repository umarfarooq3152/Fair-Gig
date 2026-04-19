import React from "react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Github, Twitter } from "lucide-react";
import { motion } from "motion/react";

export function AuthSection() {
  const [role, setRole] = React.useState("worker");

  const roles = [
    { id: "worker", label: "Worker" },
    { id: "verifier", label: "Verifier" },
    { id: "advocate", label: "Advocate" },
  ];

  return (
    <section id="signin" className="bg-[#E9EBED] py-24 sm:py-32 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-12 flex flex-col items-center">
        <div className="max-w-3xl text-center mb-16">
            <h2 className="text-5xl font-[900] tracking-tighter text-slate-900 sm:text-6xl uppercase leading-tight mb-8">
                Ready to own your <br />
                <span className="text-mint-500">Income Layer?</span>
            </h2>
            <p className="text-lg text-slate-600 font-medium leading-relaxed">
                Join 300,000+ gig professionals who have already professionalized their financial representation.
            </p>
        </div>

        {/* Role Switcher */}
        <div className="mb-10 p-1 bg-slate-200/50 backdrop-blur-md rounded-full flex relative w-full max-w-sm border border-white/20">
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => setRole(r.id)}
              className={cn(
                "relative z-10 flex-1 px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors duration-300",
                role === r.id ? "text-white" : "text-slate-500 hover:text-slate-800"
              )}
            >
              {role === r.id && (
                <motion.div
                  layoutId="active-role"
                  className="absolute inset-0 bg-[#8B5CF6] rounded-full shadow-lg"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-20">{r.label}</span>
            </button>
          ))}
        </div>

        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="w-full max-w-md bg-white border-2 border-slate-900 p-8 lg:p-12 shadow-[20px_20px_0_0_rgba(26,26,26,1)]"
        >
          <Tabs defaultValue="register" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-100/50 backdrop-blur-sm rounded-none p-1 h-12 mb-8 border border-white/20">
              <TabsTrigger value="login" className="rounded-none font-black uppercase tracking-widest text-[11px] data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-lg transition-all duration-300">Sign In</TabsTrigger>
              <TabsTrigger value="register" className="rounded-none font-black uppercase tracking-widest text-[11px] data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-lg transition-all duration-300">Register</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="space-y-6">
               <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email Address</div>
                  <Input className="rounded-none border-2 border-slate-200 h-12 focus:border-slate-900 transition-all font-bold" placeholder="name@company.com" />
               </div>
               <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Security Key</div>
                  <Input className="rounded-none border-2 border-slate-200 h-12 focus:border-slate-900 transition-all font-bold" type="password" placeholder="••••••••" />
               </div>
               <Button className="w-full h-14 bg-slate-900 text-white font-black uppercase tracking-widest rounded-none hover:bg-slate-800 transition-all">
                  Sign In
               </Button>
            </TabsContent>

            <TabsContent value="register" className="space-y-6">
                <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Name</div>
                  <Input className="rounded-none border-2 border-slate-200 h-12 focus:border-slate-900 transition-all font-bold" placeholder="Elena Fisher" />
               </div>
               <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Work Email</div>
                  <Input className="rounded-none border-2 border-slate-200 h-12 focus:border-slate-900 transition-all font-bold" placeholder="elena@fairgig.io" />
               </div>
               <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Set Password</div>
                  <Input className="rounded-none border-2 border-slate-200 h-12 focus:border-slate-900 transition-all font-bold" type="password" placeholder="Min 12 chars" />
               </div>
               <Button className="w-full h-14 bg-mint-500 text-slate-900 font-black uppercase tracking-widest rounded-none hover:bg-mint-600 transition-all">
                  Register Now
               </Button>
            </TabsContent>
          </Tabs>

          <div className="mt-10 pt-8 border-t-2 border-slate-100 flex items-center justify-center gap-4 grayscale opacity-30">
              <Github className="h-6 w-6" />
              <Twitter className="h-6 w-6" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
