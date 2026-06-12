// One title style for every page so headings sit at the same spot with the
// same (sans) font across Planner, Catalog, Overview, Transcript, and Account.
export function PageTitle({ children }: { children: string }) {
  return (
    <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-fg">{children}</h1>
  )
}
