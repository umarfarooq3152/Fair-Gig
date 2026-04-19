import React from "react";
import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { Logos } from "./components/Logos";
import { Stats } from "./components/Stats";
import { Charts } from "./components/Charts";
import { Features } from "./components/Features";
import { Testimonials } from "./components/Testimonials";
import { IncomeCertificate } from "./components/IncomeCertificate";
import { LoginPage, RegisterPage } from "./components/AuthPages";
import { Footer } from "./components/Footer";

export default function App() {
  const [pathname, setPathname] = React.useState(window.location.pathname);

  React.useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  if (pathname === "/login") {
    return (
      <div className="min-h-screen bg-white font-sans selection:bg-mint-500/30 selection:text-mint-600">
        <Navbar />
        <LoginPage />
      </div>
    );
  }

  if (pathname === "/register") {
    return (
      <div className="min-h-screen bg-white font-sans selection:bg-mint-500/30 selection:text-mint-600">
        <Navbar />
        <RegisterPage />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-mint-500/30 selection:text-mint-600">
      <Navbar />
      <main>
        <Hero />
        <Logos />
        <Stats />
        <Charts />
        <Features />
        <Testimonials />
        <IncomeCertificate />
      </main>
      <Footer />
    </div>
  );
}

