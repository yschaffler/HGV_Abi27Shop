export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="surface-card rounded-xl p-4">
      <p className="text-muted text-sm">{label}</p>
      <p className="text-strong mt-1 text-2xl font-semibold">{value}</p>
      {hint ? <p className="text-muted mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}
