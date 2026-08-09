import { useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { CloseIcon } from '../../../shared/components/icons'
import { useTranslation } from '../../i18n'
import { ROUTES } from '../../routes'
import { useAuth } from '../hooks/useAuth'
import {
  ACCOUNT_DELETION_CONFIRMATION,
  canSubmitAccountDeletion,
} from '../utils/accountPrivacy.ts'

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function AccountDataSection() {
  const { t } = useTranslation()
  const { deleteAccount } = useAuth()
  const navigate = useNavigate()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false)
  const [isDeleting, setIsDeleting] = useState<boolean>(false)
  const [currentPassword, setCurrentPassword] = useState<string>('')
  const [confirmation, setConfirmation] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  function closeDeleteDialog(): void {
    if (isDeleting) {
      return
    }
    setIsDeleteDialogOpen(false)
    setCurrentPassword('')
    setConfirmation('')
    setError(null)
  }

  async function handleDelete(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!canSubmitAccountDeletion(currentPassword, confirmation)) {
      return
    }
    setIsDeleting(true)
    setError(null)
    try {
      await deleteAccount({
        currentPassword,
        confirmation: ACCOUNT_DELETION_CONFIRMATION,
      })
      navigate(ROUTES.catalog, { replace: true })
    } catch (deleteError) {
      setError(errorMessage(deleteError, t('account.deleteFailed')))
      setIsDeleting(false)
    }
  }

  return (
    <section className="min-w-0 rounded-[10px] border border-border bg-surface px-5 py-4">
      <h2 className="text-[13.5px] font-semibold text-fg">{t('account.myData')}</h2>
      <p className="mt-1 max-w-[48rem] text-[12.5px] leading-relaxed text-fg-muted">
        {t('account.myDataDescription')}
      </p>
      <div className="mt-4 flex min-w-0 flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setError(null)
            setIsDeleteDialogOpen(true)
          }}
          className="rounded-md border border-danger/50 px-4 py-2 text-[13px] font-medium text-danger transition-colors hover:bg-danger-soft"
        >
          {t('account.deleteAccount')}
        </button>
      </div>

      {isDeleteDialogOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] overflow-y-auto bg-black/50 px-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))] sm:px-6 sm:py-10"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-account-title"
              aria-describedby="delete-account-description"
              onClick={closeDeleteDialog}
            >
              <div className="mx-auto flex min-h-full w-full max-w-[32rem] items-center">
                <form
                  onSubmit={(event) => void handleDelete(event)}
                  className="w-full min-w-0 rounded-[14px] border border-danger/40 bg-surface p-5 shadow-2xl sm:p-6"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 id="delete-account-title" className="break-words text-[18px] font-semibold text-fg">
                        {t('account.deleteTitle')}
                      </h2>
                      <p id="delete-account-description" className="mt-2 text-[13px] leading-relaxed text-fg-muted">
                        {t('account.deleteDescription')}
                      </p>
                      <p className="mt-2 text-[12.5px] leading-relaxed text-fg-muted">
                        {t('account.deleteRecoveryNotice')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeDeleteDialog}
                      disabled={isDeleting}
                      aria-label={t('common.close')}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg disabled:opacity-50"
                    >
                      <CloseIcon />
                    </button>
                  </div>

                  <div className="mt-5 grid min-w-0 gap-3">
                    <label className="grid min-w-0 gap-1.5">
                      <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                        {t('account.currentPassword')}
                      </span>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        required
                        autoComplete="current-password"
                        className="w-full min-w-0 rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-fg outline-none focus:border-danger"
                      />
                    </label>
                    <label className="grid min-w-0 gap-1.5">
                      <span className="break-words text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                        {t('account.typeDelete')}
                      </span>
                      <input
                        type="text"
                        value={confirmation}
                        onChange={(event) => setConfirmation(event.target.value)}
                        required
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        placeholder={ACCOUNT_DELETION_CONFIRMATION}
                        className="w-full min-w-0 rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-fg outline-none focus:border-danger"
                      />
                    </label>
                  </div>

                  {error ? (
                    <p role="alert" className="mt-3 break-words text-[12.5px] text-danger">{error}</p>
                  ) : null}

                  <div className="mt-5 flex min-w-0 flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeDeleteDialog}
                      disabled={isDeleting}
                      className="rounded-md border border-border px-4 py-2 text-[13px] font-medium text-fg disabled:opacity-50"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={
                        isDeleting
                        || !canSubmitAccountDeletion(currentPassword, confirmation)
                      }
                      className="rounded-md bg-danger px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isDeleting ? t('account.deletingAccount') : t('account.deletePermanently')}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  )
}
