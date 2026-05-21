interface StatItemProps {
  label: string
  value: string
  sub?: string
}

export function StatItem({ label, value, sub }: StatItemProps) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-fg-muted">
        {label}
      </div>
      <div className="flex items-baseline gap-1.25">
        <span className="text-2xl font-bold leading-none text-accent">{value}</span>
        {sub && <span className="text-[12px] text-fg-muted">{sub}</span>}
      </div>
    </div>
  )
}
