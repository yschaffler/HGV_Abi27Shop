export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="surface-card rounded-xl p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="text-foreground mt-1 text-2xl font-semibold">{value}</p>
      {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}
