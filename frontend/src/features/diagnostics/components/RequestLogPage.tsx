import { useEffect, useState } from 'react'
import { fetchJson } from '../../../shared/utils/api.ts'
import {
  clearApiRequestLog,
  readApiRequestLog,
  type ApiRequestLogEntry,
} from '../../../shared/utils/apiRequestLog.ts'

interface ServerLogEntry {
  id: number
  method: string
  url: string
  status: number
  code?: string | null
  message: string
  detail?: string | null
  durationMs?: number | null
  pagePath?: string | null
  userId?: number | null
  createdAtUnix: number
}

interface ClientErrorLogResponse {
  entries: ServerLogEntry[]
}

function formatTimestamp(unixMs: number): string {
  return new Date(unixMs).toLocaleString()
}

function LogEntryCard({
  status,
  method,
  url,
  timestamp,
  message,
  code,
  detail,
  durationMs,
  meta,
}: {
  status: number
  method: string
  url: string
  timestamp: number
  message: string
  code?: string
  detail?: string
  durationMs?: number
  meta?: string
}) {
  return (
    <article className="rounded-[10px] border border-border bg-surface px-4 py-3 text-[12px] text-fg">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={`font-semibold ${status >= 400 || status === 0 ? 'text-primary' : 'text-fg'}`}
        >
          {status === 0 ? 'NETWORK' : status}
        </span>
        <span className="font-medium">{method}</span>
        <span className="min-w-0 break-all text-fg-muted">{url}</span>
      </div>
      <div className="mt-1 text-fg-muted">{formatTimestamp(timestamp)}</div>
      {meta ? <div className="mt-0.5 text-fg-muted">{meta}</div> : null}
      {durationMs != null ? <div className="mt-0.5 text-fg-muted">{durationMs} ms</div> : null}
      {code ? <div className="mt-1">Code: {code}</div> : null}
      <div className="mt-1 break-words">{message}</div>
      {detail ? (
        <pre className="mt-2 max-h-32 overflow-auto rounded-md bg-surface-hover p-2 text-[11px] text-fg-muted whitespace-pre-wrap break-all">
          {detail}
        </pre>
      ) : null}
    </article>
  )
}

export function RequestLogPage() {
  const [sessionEntries, setSessionEntries] = useState<ApiRequestLogEntry[]>(() => readApiRequestLog())
  const [serverEntries, setServerEntries] = useState<ServerLogEntry[]>([])
  const [serverLoadError, setServerLoadError] = useState<string | null>(null)
  const [isLoadingServer, setIsLoadingServer] = useState(true)

  const reloadSessionEntries = (): void => {
    setSessionEntries(readApiRequestLog())
  }

  const reloadServerEntries = async (): Promise<void> => {
    setIsLoadingServer(true)
    setServerLoadError(null)
    try {
      const response = await fetchJson<ClientErrorLogResponse>('/api/client-errors')
      setServerEntries(response.entries)
    } catch (error) {
      setServerLoadError(error instanceof Error ? error.message : 'Failed to load server log.')
      setServerEntries([])
    } finally {
      setIsLoadingServer(false)
    }
  }

  useEffect(() => {
    // ponytail: one-shot server fetch on mount for a hidden diagnostics page
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional initial fetch
    void reloadServerEntries()
  }, [])

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold text-fg">Request log</h1>
          <p className="mt-1 text-[13px] text-fg-muted">
            API failures from this browser session and aggregated server history.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reloadSessionEntries}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-fg hover:bg-surface-hover"
          >
            Refresh session
          </button>
          <button
            type="button"
            onClick={() => {
              void reloadServerEntries()
            }}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-fg hover:bg-surface-hover"
          >
            Refresh server
          </button>
        </div>
      </div>

      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[14px] font-semibold text-fg">This session</h2>
          {sessionEntries.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                clearApiRequestLog()
                reloadSessionEntries()
              }}
              className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-fg-mid hover:bg-surface-hover hover:text-fg"
            >
              Clear session log
            </button>
          ) : null}
        </div>
        {sessionEntries.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-border bg-surface px-6 py-8 text-center text-[13px] text-fg-muted">
            No failures in this browser session yet.
          </div>
        ) : (
          <div className="space-y-3">
            {sessionEntries.map((entry) => (
              <LogEntryCard
                key={entry.id}
                status={entry.status}
                method={entry.method}
                url={entry.url}
                timestamp={entry.timestamp}
                message={entry.message}
                code={entry.code}
                detail={entry.detail}
                durationMs={entry.durationMs}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-[14px] font-semibold text-fg">Server (all users)</h2>
        {isLoadingServer ? (
          <div className="rounded-[10px] border border-border bg-surface px-6 py-8 text-center text-[13px] text-fg-muted">
            Loading server log…
          </div>
        ) : serverLoadError ? (
          <div className="rounded-[10px] border border-danger/35 bg-surface px-4 py-3 text-[13px] text-fg">
            <p className="font-medium text-primary">Server log unavailable</p>
            <p className="mt-1 break-words text-fg-muted">{serverLoadError}</p>
            <p className="mt-2 text-fg-muted">
              The session log above still records failures from this browser — use it while signed out
              or when the API is down.
            </p>
          </div>
        ) : serverEntries.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-border bg-surface px-6 py-8 text-center text-[13px] text-fg-muted">
            No failures logged on the server yet.
          </div>
        ) : (
          <div className="space-y-3">
            {serverEntries.map((entry) => (
              <LogEntryCard
                key={entry.id}
                status={entry.status}
                method={entry.method}
                url={entry.url}
                timestamp={entry.createdAtUnix * 1000}
                message={entry.message}
                code={entry.code ?? undefined}
                detail={entry.detail ?? undefined}
                durationMs={entry.durationMs ?? undefined}
                meta={[
                  entry.userId ? `User #${entry.userId}` : null,
                  entry.pagePath ? `Page: ${entry.pagePath}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || undefined}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
