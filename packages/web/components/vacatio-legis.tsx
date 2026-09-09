// S4-12: Vacatio legis indicator — shows days until entry into force

export function VacatioLegis({
  entryIntoForce,
}: {
  entryIntoForce: string | null;
}) {
  if (!entryIntoForce) return null;

  const eifDate = new Date(entryIntoForce);
  const now = new Date();
  const diffMs = eifDate.getTime() - now.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (days <= 0) return null; // already in force

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-700">
      <span>⏳</span>
      <span>
        Enters into force in {days} day{days === 1 ? "" : "s"}
      </span>
    </span>
  );
}
