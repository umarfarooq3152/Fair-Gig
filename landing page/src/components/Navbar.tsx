import React from "react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { ShieldCheck, Github, Twitter, Menu, X } from "lucide-react";
import { Spotlight } from "@/components/ui/spotlight";

export function Navbar() {
  const [isOpen, setIsOpen] = React.useState(false);

  const links = [
    { name: "Platform", href: "#features" },
    { name: "Transparency", href: "#transparency" },
    { name: "Verification", href: "#certificate" },
    { name: "Advocacy", href: "#advocacy" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-12">
        <div className="flex items-center gap-3 relative group cursor-pointer shrink-0">
          <Spotlight 
            className="-top-20 left-0 scale-[1.5] pointer-events-none opacity-0 group-hover:opacity-10 transition-opacity duration-1000" 
            fill="#8B5CF6" 
          />
          <div className="h-7 w-7 rounded bg-slate-900 flex items-center justify-center relative z-10 shadow-lg group-hover:shadow-purple-500/10 transition-all duration-500">
             <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <span className="text-xl font-black tracking-tighter text-slate-900 uppercase relative z-10 group-hover:text-purple-600 transition-colors duration-500">
            Fair<span className="text-slate-400 group-hover:text-purple-300 font-medium tracking-tight transition-colors duration-500">Gig</span>
          </span>
        </div>
        
        <div className="hidden items-center gap-12 lg:flex">
          {links.map((link) => (
            <div key={link.name} className="relative group/nav overflow-visible flex items-center">
              <a 
                href={link.href} 
                className="relative z-10 block text-[11px] font-[800] text-slate-500 uppercase tracking-[0.2em] transition-all duration-300 hover:text-slate-900"
              >
                {link.name}
                <span className="absolute -bottom-1.5 left-0 h-[1.5px] w-0 bg-purple-500 transition-all duration-300 group-hover/nav:w-full" />
              </a>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 lg:gap-8">
          <div className="hidden md:flex items-center gap-5 text-slate-400">
             <Github className="h-5 w-5 hover:text-slate-900 cursor-pointer transition-colors" />
             <Twitter className="h-5 w-5 hover:text-slate-900 cursor-pointer transition-colors" />
          </div>
          <div className="h-6 w-px bg-slate-200 hidden md:block" />
          <div className="hidden sm:flex items-center gap-6">
            <a 
              href="#signin" 
              className={cn(
                buttonVariants({ variant: "ghost" }), 
                "text-[11px] font-black uppercase tracking-[0.2em] text-slate-900 hover:bg-transparent hover:text-mint-500 px-0 transition-colors cursor-pointer"
              )}
            >
               Sign In
            </a>
            <a 
              href="#signin" 
              className={cn(
                buttonVariants({ variant: "default" }), 
                "bg-slate-900 text-white rounded-none h-11 px-8 text-[11px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-lg hover:shadow-slate-900/10 cursor-pointer"
              )}
            >
               Get Started
            </a>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="lg:hidden p-2 text-slate-900 hover:bg-slate-50 transition-colors"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div className="absolute top-20 left-0 right-0 bg-white border-b border-slate-200 p-8 lg:hidden animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex flex-col gap-6">
            {links.map((link) => (
              <a 
                key={link.name}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="text-[12px] font-black uppercase tracking-widest text-slate-900 hover:text-purple-600 transition-colors"
              >
                {link.name}
              </a>
            ))}
            <div className="h-px w-full bg-slate-100 my-2" />
            <div className="flex flex-col gap-4">
              <a 
                href="#signin" 
                onClick={() => setIsOpen(false)}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "w-full h-12 rounded-none text-[12px] font-black uppercase tracking-widest border-2"
                )}
              >
                Sign In
              </a>
              <a 
                href="#signin" 
                onClick={() => setIsOpen(false)}
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "w-full h-12 rounded-none text-[12px] font-black uppercase tracking-widest bg-slate-900 text-white"
                )}
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
