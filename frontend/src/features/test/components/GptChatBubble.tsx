import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from '../../i18n'

interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// In-page chat with the StudyOS assistant. The panel and message flow are real;
// the model/backend is intentionally not wired yet (placeholder reply). The send
// handler is the single integration point for a future server-side LLM proxy
// that calls the catalog MCP tools — and, once authenticated, user actions.
export function GptChatBubble() {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 0, role: 'assistant', text: t('test.gpt.intro') },
  ])
  const nextIdRef = useRef(1)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [isOpen, messages])

  function handleSend(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    const userMessage: ChatMessage = { id: nextIdRef.current++, role: 'user', text }
    // TODO: replace this placeholder with a call to the assistant backend.
    const assistantMessage: ChatMessage = {
      id: nextIdRef.current++,
      role: 'assistant',
      text: t('test.gpt.comingSoon'),
    }
    setMessages((current) => [...current, userMessage, assistantMessage])
    setDraft('')
  }

  return (
    <>
      {isOpen ? (
        <div
          className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-[85] flex max-h-[70vh] flex-col overflow-hidden rounded-[14px] border border-border bg-surface shadow-2xl sm:inset-x-auto sm:right-4 sm:w-[22rem]"
          role="dialog"
          aria-label={t('test.gpt.title')}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-[14px] font-semibold text-fg">{t('test.gpt.title')}</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label={t('test.gpt.close')}
              className="rounded-md px-2 py-1 text-[13px] text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
            >
              ✕
            </button>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[85%] break-words rounded-[12px] px-3 py-2 text-[13px] ${
                  message.role === 'user'
                    ? 'ml-auto bg-primary text-white'
                    : 'mr-auto bg-surface-hover text-fg'
                }`}
              >
                {message.text}
              </div>
            ))}
          </div>

          <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-border px-3 py-2.5">
            <input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t('test.gpt.placeholder')}
              className="min-w-0 flex-1 rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px] text-fg outline-none transition-colors placeholder:text-fg-muted focus:border-primary"
            />
            <button
              type="submit"
              className="shrink-0 rounded-[10px] bg-primary px-3.5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
            >
              {t('test.gpt.send')}
            </button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-label={t('test.gpt.open')}
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] right-3 z-[85] flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-[13px] font-semibold text-white shadow-lg transition-opacity hover:opacity-90"
      >
        <ChatIcon />
        <span>GPT</span>
      </button>
    </>
  )
}
