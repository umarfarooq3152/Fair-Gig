import type { AppSection, UserRole } from '../app/types';

type Props = {
  role: UserRole;
  activeSection: AppSection;
  setActiveSection: (section: AppSection) => void;
  onLogout: () => void;
  userName: string;
};

export default function AppSidebar({ role, activeSection, setActiveSection, onLogout, userName }: Props) {
  const base = 'w-full rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition';
  const active = 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200';
  const idle = 'border-slate-800 bg-slate-900 text-slate-200 hover:border-slate-700 hover:bg-slate-800';

  return (
    <aside className="border-b border-slate-800 bg-slate-950 px-4 py-4 text-slate-100 lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
      <div className="mb-4 border-b border-slate-800 pb-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">FairGig Workspace</p>
        <h2 className="mt-2 text-lg font-bold">Dashboard</h2>
        <p className="mt-1 text-xs text-slate-400">{userName} · {role}</p>
      </div>

      <nav className="space-y-1.5">
        {role === 'worker' && (
          <>
            <button type="button" className={`${base} ${activeSection === 'dashboard' ? active : idle}`} onClick={() => setActiveSection('dashboard')}>Dashboard</button>
            <button type="button" className={`${base} ${activeSection === 'earnings' ? active : idle}`} onClick={() => setActiveSection('earnings')}>Earnings</button>
            <button type="button" className={`${base} ${activeSection === 'community' ? active : idle}`} onClick={() => setActiveSection('community')}>Community Board</button>
            <button type="button" className={`${base} ${activeSection === 'advocate' ? active : idle}`} onClick={() => setActiveSection('advocate')}>Anomaly Insights</button>
          </>
        )}

        {role === 'advocate' && (
          <>
            <button type="button" className={`${base} ${activeSection === 'community' ? active : idle}`} onClick={() => setActiveSection('community')}>Community Board</button>
            <button type="button" className={`${base} ${activeSection === 'advocate' ? active : idle}`} onClick={() => setActiveSection('advocate')}>Moderation Queue</button>
          </>
        )}

        {role === 'verifier' && (
          <button type="button" className={`${base} ${activeSection === 'verifier' ? active : idle}`} onClick={() => setActiveSection('verifier')}>Verifier Queue</button>
        )}
      </nav>

      <button type="button" onClick={onLogout} className="mt-6 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800">
        Logout
      </button>
    </aside>
  );
}
