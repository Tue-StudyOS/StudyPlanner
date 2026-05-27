import type { DragEvent } from 'react'
import type { TranscriptImportPhase } from '../types'
import { UploadIcon } from './icons'

interface TranscriptUploadCardProps {
  isDragActive: boolean
  disabled: boolean
  phase: TranscriptImportPhase
  error: string | null
  maxFileSizeLabel: string
  onBrowse: () => void
  onDragOver: (event: DragEvent<HTMLButtonElement>) => void
  onDragLeave: (event: DragEvent<HTMLButtonElement>) => void
  onDrop: (event: DragEvent<HTMLButtonElement>) => void
}

export function TranscriptUploadCard({
  isDragActive,
  disabled,
  phase,
  error,
  maxFileSizeLabel,
  onBrowse,
  onDragOver,
  onDragLeave,
  onDrop,
}: TranscriptUploadCardProps) {
  const isBusy = phase === 'validating' || phase === 'parsing' || phase === 'saving'

  return (
    <section className="rounded-[10px] border border-border bg-surface px-6 py-5.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[14px] font-semibold text-fg">Import Transcript PDF</div>
          <p className="mt-1 text-[12.5px] text-fg-muted">
            Drop a PDF here or choose one manually. The file is parsed in your browser, and each extracted row stays in review until you import, discard, or reset it.
          </p>
        </div>
        <span className="rounded-full border border-border-light px-2.5 py-1 text-[11px] font-medium text-fg-muted">
          PDF only
        </span>
      </div>

      <button
        type="button"
        onClick={onBrowse}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        disabled={disabled || isBusy}
        className={`flex w-full flex-col items-center justify-center gap-3 rounded-[10px] border-2 border-dashed px-8 py-14 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-border bg-surface hover:border-primary/40 hover:bg-surface-hover'
        }`}
      >
        <div className="flex items-center justify-center rounded-md bg-pill-bg p-3 text-fg-mid">
          <UploadIcon />
        </div>
        <div className="text-[15px] font-semibold text-fg">
          {isBusy ? 'Preparing transcript review…' : 'Drag and drop your transcript PDF'}
        </div>
        <div className="text-[12px] text-fg-muted">
          {disabled ? 'The catalog is still loading. Please wait a moment.' : 'or click to choose a file'}
        </div>
      </button>

      <div className="mt-3 text-[12px] text-fg-muted">Max file size: {maxFileSizeLabel}.</div>

      {error ? (
        <div className="mt-3 rounded-[10px] border border-primary/30 bg-primary/5 px-4 py-3 text-[13px] text-primary">
          {error}
        </div>
      ) : null}
    </section>
  )
}
