interface CompletedBadgeProps {
  grade?: number | null
  semester?: string | null
  size?: 'sm' | 'md'
}

export function CompletedBadge({ grade, semester, size = 'sm' }: CompletedBadgeProps) {
  const hasMeta = grade !== undefined && grade !== null
  const padding = size === 'md' ? 'px-3 py-1.5' : 'px-2 py-0.5'
  const fontSize = size === 'md' ? 'text-[13px]' : 'text-[10.5px]'

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#86c99a] bg-[#e8f5ec] font-semibold leading-none text-[#1e7b3a] dark:border-[#2d6b3f] dark:bg-[#0f2e1a] dark:text-[#5dd880] ${padding} ${fontSize}`}
    >
      <svg
        width={size === 'md' ? 14 : 11}
        height={size === 'md' ? 14 : 11}
        viewBox="0 0 24 24"
        fill="none"
        className="shrink-0"
        aria-hidden="true"
      >
        <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>Completed</span>
      {hasMeta ? (
        <span className="font-normal text-[#356c45] dark:text-[#a3d6b3]">
          Grade {grade}
          {semester ? ` · ${semester}` : ''}
        </span>
      ) : null}
    </span>
  )
}
