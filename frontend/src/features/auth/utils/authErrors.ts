import { ApiError } from '../../../shared/utils/api.ts'

const AUTH_SECRET_CONFIGURATION_ERROR = 'AUTH_TOKEN_SECRET must be configured as a Worker secret.'

interface NormalizeAuthErrorMessageOptions {
  isLocalDevelopment?: boolean
}

export function normalizeAuthErrorMessage(
  error: unknown,
  options: NormalizeAuthErrorMessageOptions = {},
): string {
  const message = error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : 'Something went wrong.'

  if (options.isLocalDevelopment && message === AUTH_SECRET_CONFIGURATION_ERROR) {
    return `${message} Add AUTH_TOKEN_SECRET to backend/.dev.vars, restart \`npx wrangler dev\`, and try again.`
  }

  return message
}
