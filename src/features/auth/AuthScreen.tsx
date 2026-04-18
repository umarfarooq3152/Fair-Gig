import { FormEvent, useState } from 'react';
import { authBases, categories, roles, zones } from '../app/config';
import { fetchWithFallback, getErrorMessage } from '../app/helpers';
import type { RegisterForm, UserRole } from '../app/types';

type Props = {
  onAuthenticated: (token: string, userId: string) => void;
};

export default function AuthScreen({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState<RegisterForm>({
    name: '',
    email: '',
    password: '',
    role: 'worker',
    city_zone: 'DHA',
    category: 'ride_hailing',
    phone: '',
  });

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const { response, payload } = await fetchWithFallback(authBases, '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });

      if (!response.ok) {
        setAuthError(getErrorMessage(payload, 'Login failed'));
        return;
      }

      if (!payload?.access_token || !payload?.user_id) {
        setAuthError('Invalid login response from auth service');
        return;
      }

      onAuthenticated(payload.access_token, payload.user_id);
    } catch {
      setAuthError('Unable to connect to auth service');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const registerPayload: Record<string, unknown> = {
        name: registerForm.name,
        email: registerForm.email,
        password: registerForm.password,
        role: registerForm.role,
      };

      if (registerForm.role === 'worker') {
        registerPayload.city_zone = registerForm.city_zone;
        registerPayload.category = registerForm.category;
        registerPayload.phone = registerForm.phone || null;
      }

      const { response: registerRes, payload: registerData } = await fetchWithFallback(authBases, '/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerPayload),
      });

      if (!registerRes.ok) {
        setAuthError(getErrorMessage(registerData, 'Signup failed'));
        return;
      }

      const { response: loginRes, payload: loginData } = await fetchWithFallback(authBases, '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registerForm.email,
          password: registerForm.password,
        }),
      });

      if (!loginRes.ok) {
        setAuthError(getErrorMessage(loginData, 'Signup complete but auto-login failed'));
        return;
      }

      onAuthenticated(loginData.access_token, loginData.user_id);
    } catch {
      setAuthError('Unable to connect to auth service');
    } finally {
      setAuthLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-100 via-white to-cyan-100 px-4 py-10">
      <div className="mx-auto max-w-5xl rounded-3xl border border-emerald-200 bg-white/90 p-6 shadow-xl backdrop-blur sm:p-10">
        <div className="grid gap-8 md:grid-cols-2">
          <section>
            <p className="mb-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">FairGig Startup</p>
            <h1 className="text-3xl font-black text-slate-900 sm:text-4xl">Login or Sign Up to Continue</h1>
            <p className="mt-3 text-sm text-slate-600">
              Choose your role while signing up, and start tracking verified gig earnings from day one.
            </p>
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              Duplicate email protection is enabled. You cannot create two accounts with the same email.
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex gap-2 rounded-xl bg-slate-100 p-1">
              <button
                className={`w-1/2 rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === 'login' ? 'bg-white text-slate-900 shadow' : 'text-slate-600'}`}
                onClick={() => {
                  setMode('login');
                  setAuthError('');
                }}
                type="button"
              >
                Login
              </button>
              <button
                className={`w-1/2 rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === 'signup' ? 'bg-white text-slate-900 shadow' : 'text-slate-600'}`}
                onClick={() => {
                  setMode('signup');
                  setAuthError('');
                }}
                type="button"
              >
                Sign Up
              </button>
            </div>

            {mode === 'login' ? (
              <form className="space-y-3" onSubmit={handleLogin}>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Email"
                  type="email"
                  required
                  value={loginForm.email}
                  onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))}
                />
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Password"
                  type="password"
                  required
                  value={loginForm.password}
                  onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                />
                <button className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" type="submit" disabled={authLoading}>
                  {authLoading ? 'Logging in...' : 'Login'}
                </button>
              </form>
            ) : (
              <form className="space-y-3" onSubmit={handleSignup}>
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Full Name" required value={registerForm.name} onChange={(e) => setRegisterForm((prev) => ({ ...prev, name: e.target.value }))} />
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Email" type="email" required value={registerForm.email} onChange={(e) => setRegisterForm((prev) => ({ ...prev, email: e.target.value }))} />
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Password" type="password" minLength={6} required value={registerForm.password} onChange={(e) => setRegisterForm((prev) => ({ ...prev, password: e.target.value }))} />
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={registerForm.role} onChange={(e) => setRegisterForm((prev) => ({ ...prev, role: e.target.value as UserRole }))}>
                  {roles.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>

                {registerForm.role === 'worker' && (
                  <>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={registerForm.city_zone} onChange={(e) => setRegisterForm((prev) => ({ ...prev, city_zone: e.target.value }))}>
                      {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
                    </select>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={registerForm.category} onChange={(e) => setRegisterForm((prev) => ({ ...prev, category: e.target.value }))}>
                      {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                    <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Phone Number (optional)" value={registerForm.phone} onChange={(e) => setRegisterForm((prev) => ({ ...prev, phone: e.target.value }))} />
                  </>
                )}

                <button className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" type="submit" disabled={authLoading}>
                  {authLoading ? 'Creating account...' : 'Create Account'}
                </button>
              </form>
            )}

            {authError && <p className="mt-3 text-sm font-medium text-red-600">{authError}</p>}
          </section>
        </div>
      </div>
    </main>
  );
}
