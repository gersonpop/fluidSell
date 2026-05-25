type ScrumOverviewCardsProps = {
  selectedLabel: string;
  totalPoints: number;
  pendingCount: number;
  activeCount: number;
  reviewCount: number;
  doneCount: number;
};

export function ScrumOverviewCards({
  selectedLabel,
  totalPoints,
  pendingCount,
  activeCount,
  reviewCount,
  doneCount
}: ScrumOverviewCardsProps) {
  return (
    <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">Filtro</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">{selectedLabel}</p>
      </article>
      <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">Story Points</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">{totalPoints}</p>
      </article>
      <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">Pendientes</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">{pendingCount}</p>
      </article>
      <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">En proceso</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">{activeCount}</p>
      </article>
      <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">En revision</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">{reviewCount}</p>
      </article>
      <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">Done</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">{doneCount}</p>
      </article>
    </section>
  );
}
