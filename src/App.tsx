import { useEffect, useState } from 'react';
import AuthScreen from './features/auth/AuthScreen.tsx';
import WorkerDashboard from './features/dashboard/WorkerDashboard.tsx';
import WorkerEarnings from './features/earnings/WorkerEarnings.tsx';
import CommunityBoard from './features/grievance/CommunityBoard.tsx';
import AdvocateQueue from './features/grievance/AdvocateQueue.tsx';
import VerifierQueue from './features/verifier/VerifierQueue.tsx';
import AnomalyInsights from './features/anomaly/AnomalyInsights.tsx';
import AppSidebar from './features/layout/AppSidebar.tsx';
import type { AppSection, AuthUser } from './features/app/types';
import { authBases } from './features/app/config';
import { fetchWithFallback } from './features/app/helpers';

// --- Main Component ---
export default function App() {
  const [token, setToken] = useState(localStorage.getItem('fairgig_token'));
  const [userId, setUserId] = useState(localStorage.getItem('fairgig_user_id'));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeSection, setActiveSection] = useState<AppSection>('dashboard');

  async function fetchProfile(authToken: string) {
    try {
      const { response, payload } = await fetchWithFallback(authBases, '/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        setUser(null);
        return;
      }

      setUser(payload);
      if (payload.role === 'worker') {
        setActiveSection('dashboard');
      }
      if (payload.role === 'verifier') {
        setActiveSection('verifier');
      }
      if (payload.role === 'advocate') {
        setActiveSection('community');
      }
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    if (token && userId) {
      void fetchProfile(token);
    }
  }, [token, userId]);

  function handleAuthenticated(nextToken: string, nextUserId: string) {
    localStorage.setItem('fairgig_token', nextToken);
    localStorage.setItem('fairgig_user_id', nextUserId);
    setToken(nextToken);
    setUserId(nextUserId);
    void fetchProfile(nextToken);
  }

  function logout() {
    localStorage.removeItem('fairgig_token');
    localStorage.removeItem('fairgig_user_id');
    setToken(null);
    setUserId(null);
    setUser(null);
    setActiveSection('dashboard');
  }

  if (!token || !userId) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Loading profile...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 lg:flex">
      <AppSidebar
        role={user.role}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        onLogout={logout}
        userName={user.name || 'User'}
      />

      <div className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h1 className="text-2xl font-black text-slate-900">FairGig</h1>
            <p className="text-sm text-slate-600">
              Logged in as <span className="font-semibold">{user.name}</span> ({user.role})
            </p>
          </header>

          {user.role === 'worker' && activeSection === 'dashboard' && (
            <WorkerDashboard
              workerId={userId}
              cityZone={user.city_zone || null}
              category={user.category || null}
            />
          )}
          {user.role === 'worker' && activeSection === 'earnings' && <WorkerEarnings workerId={userId} />}
          {user.role === 'worker' && activeSection === 'community' && <CommunityBoard role="worker" token={token} />}
          {user.role === 'worker' && activeSection === 'advocate' && <AnomalyInsights workerId={userId} />}

          {user.role === 'verifier' && <VerifierQueue verifierId={userId} />}

          {user.role === 'advocate' && activeSection === 'community' && (
            <CommunityBoard role="advocate" token={token} />
          )}
          {user.role === 'advocate' && activeSection === 'advocate' && <AdvocateQueue token={token} />}
        </div>
      </div>
    </main>
  );
}
