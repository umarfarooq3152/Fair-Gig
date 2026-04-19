import React from 'react';

type AuthRole = 'worker' | 'verifier' | 'advocate';

type ApiResult<T> = {
  response: Response;
  payload: T;
};

type LoginPayload = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  role: AuthRole;
  user_id: string;
};

const env = (import.meta as any).env || {};
const authBases: string[] = env.VITE_AUTH_BASE_URL
  ? [env.VITE_AUTH_BASE_URL]
  : ['http://localhost:8001/auth', '/api/auth'];

async function postWithFallback<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  let lastError: unknown;

  for (const base of authBases) {
    try {
      const response = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const payload = (await response.json().catch(() => ({}))) as T;
      if (response.ok || response.status < 500) {
        return { response, payload };
      }

      lastError = new Error(`Auth service failed at ${base}${path} (${response.status})`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('Auth service unavailable');
}

function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-h-screen bg-paper pt-28">
      <div className="mx-auto w-full max-w-xl px-6 pb-16">
        <div className="rounded-2xl border border-ink/10 bg-white/95 p-8 shadow-[0_16px_45px_rgba(20,20,20,0.08)] backdrop-blur-sm lg:p-10">
          <h1 className="text-4xl font-black uppercase tracking-tight text-ink">{title}</h1>
          <p className="mt-3 text-sm font-medium text-ink/60">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </section>
  );
}

export function LoginPage() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { response, payload } = await postWithFallback<LoginPayload | { detail?: string }>('/login', {
        email,
        password,
      });

      if (!response.ok) {
        setError((payload as { detail?: string })?.detail || 'Login failed.');
        return;
      }

      const result = payload as LoginPayload;
      localStorage.setItem('fairgig_token', result.access_token);
      localStorage.setItem('fairgig_user_id', String(result.user_id));
      window.location.href = '/';
    } catch {
      setError('Unable to reach auth service. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Login" subtitle="Access your FairGig account.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-ink/50">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-12 w-full rounded-lg border border-ink/15 bg-white px-4 outline-none transition focus:border-blueprint"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-ink/50">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-12 w-full rounded-lg border border-ink/15 bg-white px-4 outline-none transition focus:border-blueprint"
            placeholder="••••••••"
          />
        </div>

        {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="h-12 w-full bg-ink text-[11px] font-black uppercase tracking-widest text-paper transition hover:bg-blueprint hover:text-ink disabled:opacity-60"
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </button>

        <p className="text-center text-sm text-ink/60">
          Need an account?{' '}
          <a href="/register" className="font-bold text-blueprint hover:underline">
            Register
          </a>
        </p>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [role, setRole] = React.useState<AuthRole>('worker');
  const [cityZone, setCityZone] = React.useState('Other');
  const [category, setCategory] = React.useState('ride_hailing');
  const [phone, setPhone] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name,
        email,
        password,
        role,
        city_zone: role === 'worker' ? cityZone : null,
        category: role === 'worker' ? category : null,
        phone: phone || null,
      };

      const { response, payload: responsePayload } = await postWithFallback<{ detail?: string }>('/register', payload);

      if (!response.ok) {
        setError(responsePayload?.detail || 'Registration failed.');
        return;
      }

      window.location.href = '/login';
    } catch {
      setError('Unable to reach auth service. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Register" subtitle="Create your FairGig profile.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-ink/50">Full Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-12 w-full rounded-lg border border-ink/15 bg-white px-4 outline-none transition focus:border-blueprint"
            placeholder="Your name"
          />
        </div>

        <div>
          <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-ink/50">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-12 w-full rounded-lg border border-ink/15 bg-white px-4 outline-none transition focus:border-blueprint"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-ink/50">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-12 w-full rounded-lg border border-ink/15 bg-white px-4 outline-none transition focus:border-blueprint"
            placeholder="Minimum 8 characters"
          />
        </div>

        <div>
          <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-ink/50">Confirm Password</label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-12 w-full rounded-lg border border-ink/15 bg-white px-4 outline-none transition focus:border-blueprint"
            placeholder="Re-enter password"
          />
        </div>

        <div>
          <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-ink/50">Role</label>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as AuthRole)}
            className="h-12 w-full rounded-lg border border-ink/15 bg-white px-4 outline-none transition focus:border-blueprint"
          >
            <option value="worker">Worker</option>
            <option value="verifier">Verifier</option>
            <option value="advocate">Advocate</option>
          </select>
        </div>

        {role === 'worker' ? (
          <>
            <div>
              <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-ink/50">City Zone</label>
              <select
                value={cityZone}
                onChange={(event) => setCityZone(event.target.value)}
                className="h-12 w-full rounded-lg border border-ink/15 bg-white px-4 outline-none transition focus:border-blueprint"
              >
                <option value="Gulberg">Gulberg</option>
                <option value="DHA">DHA</option>
                <option value="Saddar">Saddar</option>
                <option value="Johar Town">Johar Town</option>
                <option value="Cantt">Cantt</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-ink/50">Category</label>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-12 w-full rounded-lg border border-ink/15 bg-white px-4 outline-none transition focus:border-blueprint"
              >
                <option value="ride_hailing">Ride Hailing</option>
                <option value="food_delivery">Food Delivery</option>
                <option value="freelance">Freelance</option>
                <option value="domestic">Domestic</option>
              </select>
            </div>
          </>
        ) : null}

        <div>
          <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-ink/50">Phone (Optional)</label>
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="h-12 w-full rounded-lg border border-ink/15 bg-white px-4 outline-none transition focus:border-blueprint"
            placeholder="03xx-xxxxxxx"
          />
        </div>

        {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="h-12 w-full bg-ink text-[11px] font-black uppercase tracking-widest text-paper transition hover:bg-blueprint hover:text-ink disabled:opacity-60"
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>

        <p className="text-center text-sm text-ink/60">
          Already have an account?{' '}
          <a href="/login" className="font-bold text-blueprint hover:underline">
            Login
          </a>
        </p>
      </form>
    </AuthShell>
  );
}
