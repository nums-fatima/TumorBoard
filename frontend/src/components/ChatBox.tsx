import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../types'
import Markdown from './Markdown'
import ReportView from './ReportView'

/* ── Cycling thinking phases ──────────────────────────────────── */
const PHASES = [
  'Searching PubMed literature...',
  'Querying ClinicalTrials.gov...',
  'Analyzing CIViC biomarkers...',
  'Reviewing NCI guidelines...',
  'Cross-referencing evidence...',
  'Grading evidence levels...',
  'Checking for contradictions...',
  'Building research report...',
]

function ThinkingPhases() {
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<'in' | 'out'>('in')
  useEffect(() => {
    const tick = setInterval(() => {
      setPhase('out')
      setTimeout(() => { setIdx((i) => (i + 1) % PHASES.length); setPhase('in') }, 260)
    }, 2000)
    return () => clearInterval(tick)
  }, [])
  return (
    <div className="flex items-center gap-2.5 py-1">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
      <span key={idx} className={`text-sm font-medium text-slate-700 ${phase === 'in' ? 'word-in' : 'word-out'}`}>
        {PHASES[idx]}
      </span>
    </div>
  )
}

/* ── Quick-access questions — horizontal scrollable cards ─────── */
const QUICK_QUESTIONS = [
  'What is the role of osimertinib in EGFR exon 19 deletion NSCLC?',
  'Sotorasib and adagrasib for KRAS G12C in colorectal cancer?',
  'PD-L1 expression and pembrolizumab efficacy in NSCLC?',
  'BRCA1/2 mutations and PARP inhibitors in ovarian cancer?',
  'HER2-positive breast cancer treatment landscape?',
  'Mechanisms of acquired resistance to osimertinib in NSCLC?',
  'Durvalumab maintenance after chemoradiation in stage III NSCLC?',
  'BCR-ABL T315I gatekeeper mutation and ponatinib in CML?',
]

/* ── Text-selection → Ask TumorBoard ─────────────────────────── */
interface SelState { text: string; x: number; y: number }
function useTextSelection(onAsk: (t: string) => void) {
  const [sel, setSel] = useState<SelState | null>(null)
  useEffect(() => {
    const up = () => {
      const s = window.getSelection(); const text = s?.toString().trim() ?? ''
      if (text.length < 8) { setSel(null); return }
      const rect = s?.getRangeAt(0).getBoundingClientRect()
      if (rect) setSel({ text, x: rect.left + rect.width / 2, y: rect.top })
    }
    const down = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest('[data-ask-btn]')) return
      setSel(null)
    }
    document.addEventListener('mouseup', up)
    document.addEventListener('mousedown', down)
    return () => { document.removeEventListener('mouseup', up); document.removeEventListener('mousedown', down) }
  }, [])
  const ask = () => { if (!sel) return; onAsk(sel.text); setSel(null); window.getSelection()?.removeAllRanges() }
  return { sel, ask }
}

/* ── Main component ───────────────────────────────────────────── */
interface Props {
  messages: ChatMessage[]
  thinking: boolean
  connected: boolean
  onSend: (text: string, uploadId?: string) => void
}

interface AttachedFile {
  name: string
  uploadId: string | null  // null while uploading
  uploading: boolean
  error?: string
}

export default function ChatBox({ messages, thinking, connected, onSend }: Props) {
  const [input, setInput] = useState('')
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [attached, setAttached] = useState<AttachedFile | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { sel, ask } = useTextSelection(onSend)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAttached({ name: file.name, uploadId: null, uploading: true })
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const json = await res.json()
      if (json.error) {
        setAttached((prev) => prev ? { ...prev, uploading: false, error: json.error } : null)
      } else {
        setAttached({ name: file.name, uploadId: json.upload_id, uploading: false })
      }
    } catch {
      setAttached((prev) => prev ? { ...prev, uploading: false, error: 'Upload failed — try again' } : null)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  useEffect(() => {
    const el = scrollRef.current; if (!el) return
    const fn = () => setShowScrollBtn(el.scrollTop < el.scrollHeight - el.clientHeight - 80)
    el.addEventListener('scroll', fn); return () => el.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    if (messages.length === 0) return
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

  const submit = (text?: string) => {
    const msg = text ?? input
    if (!msg.trim() || thinking) return
    onSend(msg, attached?.uploadId ?? undefined)
    if (!text) { setInput(''); setAttached(null) }
  }
  const copyMsg = async (content: string, idx: number) => {
    await navigator.clipboard.writeText(content); setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 1500)
  }

  const showThinking = thinking && messages[messages.length - 1]?.role === 'user'
  const lastMsg = messages[messages.length - 1]
  const followups = !thinking && lastMsg?.role === 'assistant' && !lastMsg.streaming
    ? (lastMsg.report?.suggested_followups ?? []) : []
  const isEmpty = messages.length === 0

  return (
    <div className="flex h-full flex-col bg-[#f0f4f8]">

      {/* Floating "Ask TumorBoard" on text selection */}
      {sel && (
        <button
          data-ask-btn="true" onClick={ask}
          style={{ position: 'fixed', left: sel.x, top: sel.y - 44, transform: 'translateX(-50%)' }}
          className="z-50 flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xl transition hover:bg-blue-700"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
          Ask TumorBoard
        </button>
      )}

      {/* ── EMPTY STATE — everything on one screen, no scroll needed ── */}
      {isEmpty && (
        <div className="flex h-full flex-col">
          {/* Greeting — centered in upper portion */}
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <h1 className="font-serif-display mb-2 text-[2.6rem] font-semibold leading-tight text-blue-950">
              Hey, Numa.
            </h1>
            <p className="text-[1.1rem] text-slate-500">What would you like to research today?</p>
          </div>

          {/* Bottom: compact questions + input */}
          <div className="shrink-0 px-6 pb-6">
            {/* Horizontal scrollable question strip — snap + pop on hover */}
            <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-widest text-blue-900/50">
              Common Clinical Research Questions
            </p>
            <div className="mx-auto mb-5 max-w-2xl overflow-x-auto blue-scrollbar pb-1"
                 style={{ scrollSnapType: 'x mandatory' }}>
              <div className="flex w-max gap-3 py-2 px-1">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => submit(q)}
                    disabled={!connected}
                    style={{ scrollSnapAlign: 'center' }}
                    className="snap-card w-52 shrink-0 rounded-xl border border-blue-500/50 bg-white px-4 py-3.5 text-left font-serif-display text-[14px] leading-snug text-blue-950 shadow-sm disabled:opacity-40"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Attached file chip */}
            {attached && (
              <div className="mx-auto mb-2 flex w-full max-w-2xl items-center gap-2">
                <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                  attached.error ? 'border-rose-300 bg-rose-50 text-rose-700' :
                  attached.uploading ? 'border-blue-200 bg-blue-50 text-blue-700' :
                  'border-emerald-300 bg-emerald-50 text-emerald-800'
                }`}>
                  {attached.uploading ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
                  ) : attached.error ? (
                    <span className="text-rose-500">✗</span>
                  ) : (
                    <span className="text-emerald-600">✓</span>
                  )}
                  <span className="font-medium">
                    {attached.uploading ? `Uploading ${attached.name}…` :
                     attached.error ? attached.error :
                     `${attached.name} — ready`}
                  </span>
                  <button
                    onClick={() => setAttached(null)}
                    className="ml-1 rounded-full p-0.5 hover:bg-black/10"
                    title="Remove"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Input bar — unified pill with buttons inside */}
            <div className="mx-auto flex w-full max-w-2xl items-center rounded-2xl border border-blue-500/40 bg-white shadow-sm focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!connected || thinking}
                title="Attach genomic report (PDF)"
                className="shrink-0 px-4 py-4 text-blue-500 transition hover:text-blue-700 disabled:opacity-40"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
                placeholder={attached?.uploadId ? 'Ask a question about the report…' : 'Ask a question...'}
                disabled={!connected}
                className="flex-1 bg-transparent py-4 font-serif-display text-base text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={() => submit()} disabled={!connected || thinking || !input.trim() || !!attached?.uploading}
                className="m-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white transition hover:bg-blue-800 disabled:opacity-40"
              >
                {thinking ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : (
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONVERSATION STATE ── */}
      {!isEmpty && (
        <>
          {/* Scrollable messages */}
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10">
              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[72%] rounded-2xl rounded-br-sm bg-blue-600 px-5 py-3.5 text-[15px] font-medium text-white shadow-sm">
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    </div>
                  </div>
                ) : (
                  <div key={i} className="group flex justify-start">
                    <div className="w-full rounded-2xl border border-blue-900/10 bg-white p-5 text-[15px] text-slate-900 shadow-sm">
                      <div className="mb-2 flex items-center gap-2">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-blue-900">TumorBoard</p>
                        <button
                          onClick={() => copyMsg(m.content, i)}
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100"
                        >
                          {copiedIdx === i ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                      <div className={m.streaming ? 'stream-caret' : ''}><Markdown>{m.content}</Markdown></div>
                      {m.report && (
                        <div className="fade-in">
                          <ReportView report={m.report} question={messages[i - 1]?.role === 'user' ? messages[i - 1].content : undefined} fullContent={m.content} />
                        </div>
                      )}
                    </div>
                  </div>
                ),
              )}

              {showThinking && (
                <div className="flex justify-start">
                  <div className="w-full rounded-2xl border border-blue-900/10 bg-white p-5 shadow-sm">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-blue-900">TumorBoard</p>
                    <ThinkingPhases />
                  </div>
                </div>
              )}

              {followups.length > 0 && (
                <div>
                  <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-widest text-blue-900/50">
                    Suggested Follow-Up Questions
                  </p>
                  <div className="mx-auto max-w-2xl overflow-x-auto blue-scrollbar pb-1"
                       style={{ scrollSnapType: 'x mandatory' }}>
                    <div className="flex w-max gap-3 px-1 py-2">
                      {followups.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => submit(q)}
                          style={{ scrollSnapAlign: 'center' }}
                          className="snap-card w-52 shrink-0 rounded-xl border border-blue-500/50 bg-white px-4 py-3.5 text-left font-serif-display text-[14px] leading-snug text-blue-950 shadow-sm"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Scroll to bottom */}
          {showScrollBtn && (
            <button onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })}
              className="absolute bottom-28 right-6 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white shadow-md transition hover:shadow-lg"
            >
              <svg className="h-4 w-4 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 14.293l-4.646-4.647a.5.5 0 01.707-.707L10 12.878l3.939-3.939a.5.5 0 01.707.707L10 14.293z" clipRule="evenodd" />
              </svg>
            </button>
          )}

          {/* Input bar */}
          <div className="shrink-0 bg-[#f0f4f8] px-6 py-4">
            {attached && (
              <div className="mx-auto mb-2 flex w-full max-w-3xl">
                <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                  attached.error ? 'border-rose-300 bg-rose-50 text-rose-700' :
                  attached.uploading ? 'border-blue-200 bg-blue-50 text-blue-700' :
                  'border-emerald-300 bg-emerald-50 text-emerald-800'
                }`}>
                  {attached.uploading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" /> :
                   attached.error ? <span>✗</span> : <span>✓</span>}
                  <span className="font-medium">
                    {attached.uploading ? `Uploading ${attached.name}…` : attached.error ?? `${attached.name} — ready`}
                  </span>
                  <button onClick={() => setAttached(null)} className="ml-1 rounded-full p-0.5 hover:bg-black/10">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
            {/* Unified pill — paperclip + textarea + send all in one bar */}
            <div className="mx-auto flex w-full max-w-3xl items-end rounded-2xl border border-blue-900/20 bg-white shadow-sm focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!connected || thinking}
                title="Attach genomic report (PDF)"
                className="mb-1.5 shrink-0 self-end px-4 py-3 text-blue-500 transition hover:text-blue-700 disabled:opacity-40"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
                placeholder={attached?.uploadId ? 'Ask about the uploaded report…' : connected ? 'Ask a follow-up or new clinical question...' : 'Reconnecting...'}
                disabled={!connected}
                rows={2}
                className="flex-1 resize-none bg-transparent py-4 pr-2 text-base font-medium text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={() => submit()} disabled={!connected || thinking || !input.trim() || !!attached?.uploading}
                className="m-2 flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-40"
              >
                {thinking ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : (
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
