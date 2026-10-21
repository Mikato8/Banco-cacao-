type CacaoBalanceCardProps = {
  balance: number;
  cacaoPerMxn?: number;
  loading?: boolean;
};

export function CacaoBalanceCard({
  balance,
  cacaoPerMxn = 10,
  loading = false,
}: CacaoBalanceCardProps) {
  const mxnEquivalent = cacaoPerMxn > 0 ? balance / cacaoPerMxn : 0;

  return (
    <section
      aria-label="Saldo de cacao"
      className="relative overflow-hidden rounded-3xl border border-amber-800/50 bg-gradient-to-br from-amber-900/60 via-stone-900 to-stone-950 p-6 shadow-xl shadow-amber-950/30 md:col-span-2"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 text-[9rem] opacity-10 select-none"
      >
        🍫
      </div>

      <p className="text-sm font-medium uppercase tracking-[0.18em] text-amber-200/80">
        Saldo disponible
      </p>

      {loading ? (
        <div className="mt-4 space-y-3 animate-pulse">
          <div className="h-12 w-48 rounded-xl bg-amber-900/40" />
          <div className="h-4 w-36 rounded bg-stone-800" />
        </div>
      ) : (
        <>
          <p className="mt-3 flex items-baseline gap-3 text-5xl font-bold tabular-nums tracking-tight text-amber-50 sm:text-6xl">
            <span aria-hidden className="text-4xl sm:text-5xl">
              🍫
            </span>
            <span>{balance.toLocaleString('es-MX')}</span>
            <span className="text-lg font-semibold text-amber-200/70 sm:text-xl">cacao</span>
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-stone-300">
            <span className="rounded-full border border-amber-800/50 bg-stone-950/50 px-3 py-1">
              ≈ {mxnEquivalent.toLocaleString('es-MX', { maximumFractionDigits: 2 })} MXN
            </span>
            <span className="text-stone-500">Tasa: 1 MXN = {cacaoPerMxn} cacao</span>
          </div>
        </>
      )}
    </section>
  );
}
