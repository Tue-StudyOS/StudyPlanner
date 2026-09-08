export const ACCOUNT_DELETION_CONFIRMATION = 'DELETE'

export function canSubmitAccountDeletion(
  currentPassword: string,
  confirmation: string,
): boolean {
  return currentPassword.length > 0 && confirmation === ACCOUNT_DELETION_CONFIRMATION
}
