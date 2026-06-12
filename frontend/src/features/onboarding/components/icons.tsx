// Icons specific to the onboarding feature. Cross-cutting action icons
// (close, trash, ...) live in shared/components/icons.tsx instead.

export function HelpIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" className="shrink-0">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M9.4 9.2a2.6 2.6 0 015.1.7c0 1.7-2.5 2.1-2.5 3.9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" />
    </svg>
  )
}
