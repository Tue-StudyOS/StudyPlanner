import { TEST_ROUTES } from '../../routes'

// Parent path for the back button: strip the last URL segment but never escape
// the "/test" surface. Encoded semester labels stay a single segment.
export function getTestParentPath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '')
  if (trimmed === TEST_ROUTES.root || !trimmed.startsWith(TEST_ROUTES.root)) {
    return TEST_ROUTES.root
  }
  const parent = trimmed.slice(0, trimmed.lastIndexOf('/'))
  return parent.startsWith(TEST_ROUTES.root) ? parent : TEST_ROUTES.root
}

export function isTestRoot(pathname: string): boolean {
  return pathname.replace(/\/+$/, '') === TEST_ROUTES.root
}
