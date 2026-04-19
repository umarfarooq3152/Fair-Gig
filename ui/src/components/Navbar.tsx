import React from "react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { ShieldCheck, Github, Twitter, Menu, X } from "lucide-react";
import { Spotlight } from "@/components/ui/spotlight";

export function Navbar() {
  const [isOpen, setIsOpen] = React.useState(false);

  const links = [
    { name: "Protocol", href: "#features" },
    { name: "Verification", href: "#certificate" },
    { name: "Data Layers", href: "#transparency" },
    { name: "Policy", href: "#advocacy" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-ink/10 bg-paper/80 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-[1440px] items-stretch justify-between px-6 lg:px-0">
        {/* Brand Block */}
        <div className="flex items-center gap-4 px-6 lg:px-12 grid-divider-v group cursor-pointer bg-white/50">
          <div className="h-8 w-8 bg-ink flex items-center justify-center rounded-none relative z-10">
             <ShieldCheck className="h-5 w-5 text-paper" />
          </div>
          <span className="text-xl font-black tracking-tighter text-ink uppercase">
            Fair<span className="text-ink/30 font-medium tracking-tight">Gig</span>
          </span>
        </div>
        
        {/* Navigation Grid */}
        <div className="hidden items-stretch lg:flex flex-1">
          {links.map((link) => (
            <a 
              key={link.name} 
              href={link.href} 
              className="relative flex items-center px-8 text-[10px] font-black text-ink/40 uppercase tracking-[0.25em] transition-all duration-300 hover:text-ink hover:bg-white grid-divider-v group/nav"
            >
              <span className="relative z-10">{link.name}</span>
              <span className="absolute bottom-0 left-0 h-0.5 w-0 bg-blueprint transition-all duration-300 group-hover/nav:w-full" />
            </a>
          ))}
        </div>

        {/* Action Block */}
        <div className="flex items-stretch">
          <div className="hidden md:flex items-center gap-6 px-10 grid-divider-v">
             <Github className="h-5 w-5 text-ink/20 hover:text-ink cursor-pointer transition-colors" />
             <Twitter className="h-5 w-5 text-ink/20 hover:text-ink cursor-pointer transition-colors" />
          </div>
          
          <div className="flex items-center gap-0">
            <a 
              href="#signin" 
              className="hidden sm:flex h-full items-center px-8 text-[10px] font-black uppercase tracking-[0.2em] text-ink/40 hover:text-ink hover:bg-white grid-divider-v transition-colors"
            >
               Sign In
            </a>
            <a 
              href="#signin" 
              className="flex h-full items-center px-10 text-[10px] font-black uppercase tracking-[0.2em] bg-ink text-paper hover:bg-blueprint hover:text-ink transition-all"
            >
               Get Started
            </a>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="lg:hidden p-4 text-ink hover:bg-white transition-colors"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div className="absolute top-20 left-0 right-0 bg-paper border-b border-ink/10 p-8 lg:hidden animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex flex-col gap-6">
            {links.map((link) => (
              <a 
                key={link.name}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="text-[12px] font-black uppercase tracking-widest text-ink/40 hover:text-blueprint transition-colors"
              >
                {link.name}
              </a>
            ))}
            <div className="h-px w-full bg-ink/10 my-2" />
            <div className="flex flex-col gap-4">
              <a 
                href="#signin" 
                onClick={() => setIsOpen(false)}
                className="w-full h-14 flex items-center justify-center text-[11px] font-black uppercase tracking-widest border border-ink/20 hover:bg-white"
              >
                Sign In
              </a>
              <a 
                href="#signin" 
                onClick={() => setIsOpen(false)}
                className="w-full h-14 flex items-center justify-center text-[11px] font-black uppercase tracking-widest bg-ink text-paper"
              >
                Get Started
              </a>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
