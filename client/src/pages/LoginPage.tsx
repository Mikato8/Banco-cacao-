import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function LoginPage() {
  const { user, login, register } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('cliente@bancocacao.local');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('cacao123');
  const [role, setRole] = useState<'CLIENT' | 'SELLER'>('CLIENT');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register({ email, name, password, role });
      nav('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="rounded-3xl border border-amber-900/40 bg-stone-900/80 p-8 shadow-2xl shadow-amber-950/40 backdrop-blur">
        <div className="mb-6 text-center">
          <div className="text-5xl">🍫</div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-amber-100">Banco Cacao</h1>
          <p className="mt-1 text-sm text-stone-400">
            Deposita MXN, recibe símbolos cacao y canjéalos por productos.
          </p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-stone-950 p-1">
          <button
            type="button"
            className={`rounded-lg py-2 text-sm font-medium ${mode === 'login' ? 'bg-amber-700 text-white' : 'text-stone-400'}`}
            onClick={() => setMode('login')}
          >
            Entrar
          </button>
          <button
            type="button"
            className={`rounded-lg py-2 text-sm font-medium ${mode === 'register' ? 'bg-amber-700 text-white' : 'text-stone-400'}`}
            onClick={() => setMode('register')}
          >
            Registrarse
          </button>
        </div>

        <form className="space-y-3" onSubmit={onSubmit}>
          {mode === 'register' && (
            <>
              <label className="block text-sm text-stone-300">
                Nombre
                <input
                  className="mt-1 w-full rounded-xl border border-stone-700 bg-stone-950 px-3 py-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <label className="block text-sm text-stone-300">
                Rol
                <select
                  className="mt-1 w-full rounded-xl border border-stone-700 bg-stone-950 px-3 py-2"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'CLIENT' | 'SELLER')}
                >
                  <option value="CLIENT">Cliente</option>
                  <option value="SELLER">Vendedor</option>
                </select>
              </label>
            </>
          )}
          <label className="block text-sm text-stone-300">
            Correo
            <input
              type="email"
              className="mt-1 w-full rounded-xl border border-stone-700 bg-stone-950 px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm text-stone-300">
            Contraseña
            <input
              type="password"
              className="mt-1 w-full rounded-xl border border-stone-700 bg-stone-950 px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-amber-600 py-2.5 font-semibold text-stone-950 hover:bg-amber-500 disabled:opacity-60"
          >
            {busy ? '…' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-stone-500">
          Demo: <code>cliente@bancocacao.local</code> / <code>cacao123</code>
          <br />
          <Link className="text-amber-500 hover:underline" to="/">
            Volver
          </Link>
        </p>
      </div>
    </div>
  );
}
