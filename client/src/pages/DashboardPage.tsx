import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { CacaoBalanceCard } from '../components/CacaoBalanceCard';
import { ProductCatalog } from '../components/ProductCatalog';
import { api, type LedgerEntry, type Product } from '../lib/api';
import { useAuth } from '../lib/auth';

export function DashboardPage() {
  const { user, loading, logout, setUser, refresh } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [cacaoPerMxn, setCacaoPerMxn] = useState(10);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [depositMxn, setDepositMxn] = useState('50');
  const [transferEmail, setTransferEmail] = useState('vendedor@bancocacao.local');
  const [transferAmount, setTransferAmount] = useState('10');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadDashboard = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const [balanceRes, productsRes, ledgerRes] = await Promise.all([
        api<{ cacaoBalance: number; cacaoPerMxn: number }>('/api/wallet/balance'),
        api<{ products: Product[] }>('/api/products'),
        api<{ entries: LedgerEntry[] }>('/api/wallet/ledger'),
      ]);
      setCacaoPerMxn(balanceRes.cacaoPerMxn);
      setProducts(productsRes.products);
      setLedger(ledgerRes.entries);
      setUser((prev) =>
        prev ? { ...prev, cacaoBalance: balanceRes.cacaoBalance } : prev,
      );
    } finally {
      setCatalogLoading(false);
    }
  }, [setUser]);

  useEffect(() => {
    if (!user) return;
    void loadDashboard().catch((e) =>
      setError(e instanceof Error ? e.message : 'Error al cargar el dashboard'),
    );
  }, [user?.id]);

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-stone-400">Cargando…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;

  async function afterMoney(nextBalance?: number) {
    if (typeof nextBalance === 'number') {
      setUser((prev) => (prev ? { ...prev, cacaoBalance: nextBalance } : prev));
    }
    await refresh();
    await loadDashboard();
  }

  async function onDeposit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await api<{ cacaoCredited: number; cacaoBalance: number }>('/api/wallet/deposit', {
        method: 'POST',
        body: JSON.stringify({ amountMxn: Number(depositMxn) }),
      });
      setMessage(`+${data.cacaoCredited} cacao acreditados`);
      await afterMoney(data.cacaoBalance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function onTransfer(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await api<{ cacaoBalance: number; sent: number }>('/api/wallet/transfer', {
        method: 'POST',
        body: JSON.stringify({
          toEmail: transferEmail,
          amountCacao: Number(transferAmount),
        }),
      });
      setMessage(`Transferiste ${data.sent} cacao`);
      await afterMoney(data.cacaoBalance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function onRedeem(productId: string, quantity: number) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await api<{ cacaoBalance: number; redemption: { cacaoPaid: number } }>(
        '/api/products/redeem',
        {
          method: 'POST',
          body: JSON.stringify({ productId, quantity }),
        },
      );
      setMessage(`Canje exitoso · −${data.redemption.cacaoPaid} cacao`);
      await afterMoney(data.cacaoBalance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      throw err;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-amber-600">Banco Cacao</p>
          <h1 className="text-3xl font-bold text-amber-50">Hola, {user.name}</h1>
          <p className="text-sm text-stone-400">
            {user.email} · rol {user.role}
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="rounded-xl border border-stone-700 px-4 py-2 text-sm text-stone-300 hover:bg-stone-900"
        >
          Cerrar sesión
        </button>
      </header>

      {(message || error) && (
        <div
          role="status"
          className={`mb-6 rounded-2xl px-4 py-3 text-sm ${error ? 'bg-red-950/60 text-red-200' : 'bg-emerald-950/50 text-emerald-200'}`}
        >
          {error || message}
        </div>
      )}

      <section className="mb-8 grid gap-4 md:grid-cols-3">
        <CacaoBalanceCard
          balance={user.cacaoBalance}
          cacaoPerMxn={cacaoPerMxn}
          loading={catalogLoading && user.cacaoBalance === 0}
        />
        <div className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6">
          <p className="text-sm text-stone-400">Acciones rápidas</p>
          <ul className="mt-3 space-y-2 text-sm text-amber-100/90">
            <li>1. Depositar MXN → cacao</li>
            <li>2. Transferir cacao a otro usuario</li>
            <li>3. Canjear por productos del catálogo</li>
          </ul>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={onDeposit} className="rounded-3xl border border-stone-800 bg-stone-900/60 p-6">
          <h2 className="text-lg font-semibold text-amber-100">Depositar (simulado)</h2>
          <p className="mt-1 text-sm text-stone-400">Convierte pesos en cacao sin pasarela real.</p>
          <label className="mt-4 block text-sm">
            Monto MXN
            <input
              type="number"
              min="1"
              step="1"
              className="mt-1 w-full rounded-xl border border-stone-700 bg-stone-950 px-3 py-2"
              value={depositMxn}
              onChange={(e) => setDepositMxn(e.target.value)}
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="mt-4 w-full rounded-xl bg-amber-600 py-2.5 font-semibold text-stone-950 hover:bg-amber-500 disabled:opacity-50"
          >
            Convertir a cacao
          </button>
        </form>

        <form onSubmit={onTransfer} className="rounded-3xl border border-stone-800 bg-stone-900/60 p-6">
          <h2 className="text-lg font-semibold text-amber-100">Transferir cacao</h2>
          <p className="mt-1 text-sm text-stone-400">Envía símbolos a otro correo registrado.</p>
          <label className="mt-4 block text-sm">
            Correo destino
            <input
              type="email"
              className="mt-1 w-full rounded-xl border border-stone-700 bg-stone-950 px-3 py-2"
              value={transferEmail}
              onChange={(e) => setTransferEmail(e.target.value)}
              required
            />
          </label>
          <label className="mt-3 block text-sm">
            Cantidad cacao
            <input
              type="number"
              min="1"
              className="mt-1 w-full rounded-xl border border-stone-700 bg-stone-950 px-3 py-2"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="mt-4 w-full rounded-xl border border-amber-700/60 py-2.5 font-semibold text-amber-100 hover:bg-amber-950/40 disabled:opacity-50"
          >
            Enviar
          </button>
        </form>
      </div>

      <ProductCatalog
        products={products}
        cacaoBalance={user.cacaoBalance}
        loading={catalogLoading}
        busy={busy}
        onRedeem={onRedeem}
      />

      <section className="mt-10" aria-label="Historial de movimientos">
        <h2 className="mb-4 text-xl font-semibold text-amber-50">Movimientos</h2>
        <div className="overflow-hidden rounded-3xl border border-stone-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-900 text-stone-400">
              <tr>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Cacao</th>
                <th className="px-4 py-3 font-medium">Detalle</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-stone-500">
                    Sin movimientos aún
                  </td>
                </tr>
              )}
              {ledger.map((e) => (
                <tr key={e.id} className="border-t border-stone-800/80">
                  <td className="px-4 py-3 font-mono text-xs text-amber-200">{e.type}</td>
                  <td className="px-4 py-3 tabular-nums">{e.amountCacao}</td>
                  <td className="px-4 py-3 text-stone-300">{e.note}</td>
                  <td className="px-4 py-3 text-stone-500">
                    {new Date(e.createdAt).toLocaleString('es-MX')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
