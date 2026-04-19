import { Footer } from '@/components/landing/Footer';
import { AuthSection } from '@/components/landing/Auth';
import { Charts } from '@/components/landing/Charts';
import { Features } from '@/components/landing/Features';
import { Hero } from '@/components/landing/Hero';
import { IncomeCertificate } from '@/components/landing/IncomeCertificate';
import { Logos } from '@/components/landing/Logos';
import { Navbar } from '@/components/landing/Navbar';
import { Stats } from '@/components/landing/Stats';
import { Testimonials } from '@/components/landing/Testimonials';

export default function Page() {
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
