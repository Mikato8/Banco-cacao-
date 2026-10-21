import { useMemo, useState } from 'react';
import type { Product } from '../lib/api';

type ProductCatalogProps = {
  products: Product[];
  cacaoBalance: number;
  loading?: boolean;
  busy?: boolean;
  onRedeem: (productId: string, quantity: number) => Promise<void>;
};

export function ProductCatalog({
  products,
  cacaoBalance,
  loading = false,
  busy = false,
  onRedeem,
}: ProductCatalogProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...products].sort((a, b) => a.cacaoPrice - b.cacaoPrice),
    [products],
  );

  function qty(productId: string) {
    return quantities[productId] ?? 1;
  }

  function setQty(productId: string, value: number) {
    const next = Math.max(1, Math.min(50, Number.isFinite(value) ? value : 1));
    setQuantities((prev) => ({ ...prev, [productId]: next }));
  }

  async function handleRedeem(product: Product) {
    const quantity = qty(product.id);
    setRedeemingId(product.id);
    try {
      await onRedeem(product.id, quantity);
    } finally {
      setRedeemingId(null);
    }
  }

  return (
    <section aria-label="Catálogo de canje" className="mt-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold text-amber-50">Catálogo canjeable</h2>
          <p className="mt-1 text-sm text-stone-400">
            Canjea tus símbolos cacao por productos. Tu saldo: 🍫{' '}
            {cacaoBalance.toLocaleString('es-MX')}
          </p>
        </div>
        <p className="text-xs text-stone-500">{sorted.length} productos activos</p>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-3xl border border-stone-800 bg-stone-900/50"
            />
          ))}
        </div>
      )}

      {!loading && sorted.length === 0 && (
        <div className="rounded-3xl border border-dashed border-stone-700 bg-stone-900/40 px-6 py-12 text-center text-stone-400">
          No hay productos disponibles para canjear todavía.
        </div>
      )}

      {!loading && sorted.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((product) => {
            const quantity = qty(product.id);
            const total = product.cacaoPrice * quantity;
            const canAfford = cacaoBalance >= total;
            const inStock = product.stock >= quantity;
            const isRedeeming = redeemingId === product.id;
            const disabled = busy || isRedeeming || !inStock || !canAfford || product.stock < 1;

            return (
              <article
                key={product.id}
                className="flex flex-col rounded-3xl border border-stone-800 bg-stone-900/70 p-5 transition hover:border-amber-900/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-amber-100">{product.name}</h3>
                  <span className="shrink-0 rounded-full bg-amber-950/80 px-2.5 py-0.5 text-xs font-medium text-amber-200">
                    🍫 {product.cacaoPrice}
                  </span>
                </div>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-stone-400">
                  {product.description}
                </p>

                <div className="mt-4 flex items-center justify-between text-xs text-stone-500">
                  <span>Stock: {product.stock}</span>
                  {product.seller && <span>Vendedor: {product.seller.name}</span>}
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <label className="sr-only" htmlFor={`qty-${product.id}`}>
                    Cantidad
                  </label>
                  <input
                    id={`qty-${product.id}`}
                    type="number"
                    min={1}
                    max={Math.max(1, product.stock)}
                    value={quantity}
                    disabled={busy || product.stock < 1}
                    onChange={(e) => setQty(product.id, Number(e.target.value))}
                    className="w-16 rounded-lg border border-stone-700 bg-stone-950 px-2 py-1.5 text-sm tabular-nums"
                  />
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void handleRedeem(product)}
                    className="flex-1 rounded-xl bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isRedeeming
                      ? 'Canjeando…'
                      : !inStock
                        ? 'Sin stock'
                        : !canAfford
                          ? `Faltan ${total - cacaoBalance} cacao`
                          : `Canjear · ${total} cacao`}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
