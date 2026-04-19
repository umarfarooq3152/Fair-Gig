import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { Logos } from "./components/Logos";
import { Stats } from "./components/Stats";
import { Charts } from "./components/Charts";
import { Features } from "./components/Features";
import { Testimonials } from "./components/Testimonials";
import { IncomeCertificate } from "./components/IncomeCertificate";
import { AuthSection } from "./components/Auth";
import { Footer } from "./components/Footer";

export default function App() {
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
        <AuthSection />
      </main>
      <Footer />
    </div>
  );
}

