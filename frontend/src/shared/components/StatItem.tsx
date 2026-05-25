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
      <div className="flex flex-wrap items-baseline gap-x-1.25 gap-y-0.5">
        <span className="text-xl font-bold leading-none text-accent sm:text-2xl">{value}</span>
        {sub && <span className="text-[12px] text-fg-muted">{sub}</span>}
      </div>
    </div>
  )
}
