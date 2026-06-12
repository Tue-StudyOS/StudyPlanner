export type PageShellWidth = 'default' | 'narrow' | 'planner'

export const PAGE_SHELL_WIDTH_CLASSES: Record<PageShellWidth, string> = {
  default: 'max-w-[64rem]',
  narrow: 'max-w-[44rem]',
  planner: 'max-w-[88rem]',
}
