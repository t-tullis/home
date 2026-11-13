import { ArrowUp, Globe, ListPlus, RotateCcw, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import Markdown from 'react-markdown'
import { useNavigate } from 'react-router-dom'
import remarkGfm from 'remark-gfm'
import { Button, LinkPill, Modal, Select, SubjectChip } from '../components/ui'
import { draftAssignments, streamChat, type PlanItem, type Source } from '../lib/ai'
import { addDays, cn, safeUrl, toISODate } from '../lib/format'
import { useData } from '../state/data'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources: Source[]
  searching: boolean
  error: string | null
}

const SUGGESTIONS = [
  "I'm new to homeschooling. Where do I start?",
  'Build a 6-week math plan for a 4th grader',
  'Free science resources for a 7-year-old',
  'How do I teach reading to a kindergartner?',
]

export default function Assistant() {
  const { students } = useData()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [studentId, setStudentId] = useState('')
  const [planning, setPlanning] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => () => abortRef.current?.abort(), [])
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  const student = students.find((s) => s.id === studentId)
  const last = messages.at(-1)
  const canPlan = !streaming && conversationId !== null && last?.role === 'assistant' && last.content.length > 0

  async function send(text: string) {
    const message = text.trim()
    if (!message || streaming) return
    setInput('')
    setStreaming(true)

    const replyId = crypto.randomUUID()
    const blank = { sources: [], searching: false, error: null }
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'user', content: message, ...blank },
      { id: replyId, role: 'assistant', content: '', ...blank },
    ])
    const patchReply = (patch: (reply: ChatMessage) => Partial<ChatMessage>) =>
      setMessages((current) => current.map((m) => (m.id === replyId ? { ...m, ...patch(m) } : m)))

    const controller = new AbortController()
    abortRef.current = controller
    try {
      await streamChat(
        { message, conversationId, gradeLevel: student?.grade_level ?? null },
        (event) => {
          if (event.type === 'start') setConversationId(event.conversationId)
          else if (event.type === 'status') patchReply(() => ({ searching: event.status === 'searching' }))
          else if (event.type === 'text') patchReply((reply) => ({ content: reply.content + event.text, searching: false }))
          else if (event.type === 'done') patchReply(() => ({ sources: event.sources, searching: false }))
          else if (event.type === 'error') patchReply(() => ({ error: event.message, searching: false }))
        },
        controller.signal,
      )
    } catch (cause) {
      if (!controller.signal.aborted) {
        console.error(cause)
        patchReply(() => ({ error: "Couldn't reach the assistant. Check your connection and try again.", searching: false }))
      }
    } finally {
      setStreaming(false)
    }
  }

  function reset() {
    abortRef.current?.abort()
    setMessages([])
    setConversationId(null)
    setStreaming(false)
  }

  const composer = (
    <Composer
      value={input}
      onChange={setInput}
      onSubmit={() => void send(input)}
      disabled={streaming}
      large={messages.length === 0}
      footer={
        students.length > 0 && (
          <label className="flex items-center gap-2 text-xs whitespace-nowrap text-muted">
            Planning for
            <Select className="h-7 w-auto rounded-lg px-2 text-xs" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">No one in particular</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.grade_level ? ` (${s.grade_level})` : ''}
                </option>
              ))}
            </Select>
          </label>
        )
      }
    />
  )

  if (messages.length === 0) {
    return (
      <div className="mx-auto flex min-h-[70dvh] max-w-2xl flex-col justify-center">
        <div className="rise text-center">
          <div className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-ink">
            <Sparkles className="size-6" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Where would you like to start?</h1>
          <p className="mx-auto mt-3 max-w-md text-muted">
            Ask for a learning plan, or for resources on any subject. Plans can be turned into assignments in one step.
          </p>
        </div>
        <div className="mt-8">{composer}</div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button key={suggestion} type="button" onClick={() => void send(suggestion)} className="rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] text-muted shadow-card transition-colors hover:border-accent hover:text-accent-ink">
              {suggestion}
            </button>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-faint">
          Only your question and the grade level you pick are sent to the AI. Student names are never included.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Assistant</h1>
        <Button variant="ghost" size="sm" onClick={reset}>
          <RotateCcw className="size-3.5" /> New chat
        </Button>
      </div>

      <div className="space-y-6 pb-44 lg:pb-36">
        {messages.map((message) =>
          message.role === 'user' ? (
            <div key={message.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-[15px] whitespace-pre-wrap text-white">{message.content}</p>
            </div>
          ) : (
            <AssistantMessage key={message.id} message={message} pending={streaming && message.id === last?.id} />
          ),
        )}
        {canPlan && (
          <div className="rise flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
            <div>
              <p className="text-sm font-medium">Happy with this plan?</p>
              <p className="text-[13px] text-muted">Turn it into assignments on a student's list.</p>
            </div>
            <Button variant="primary" onClick={() => setPlanning(true)}>
              <ListPlus className="size-4" /> Create assignments
            </Button>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-10 bg-gradient-to-t from-canvas from-70% to-transparent px-4 pt-8 pb-3 lg:bottom-0 lg:left-60 lg:pb-6">
        <div className="mx-auto max-w-3xl">{composer}</div>
      </div>

      {planning && conversationId && (
        <PlanModal conversationId={conversationId} defaultStudentId={studentId} onClose={() => setPlanning(false)} />
      )}
    </div>
  )
}

function AssistantMessage({ message, pending }: { message: ChatMessage; pending: boolean }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-ink">
        <Sparkles className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        {message.content && (
          <div className="prose prose-app">
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{ a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" /> }}
            >
              {message.content}
            </Markdown>
          </div>
        )}
        {pending && !message.error && (message.searching || !message.content) && (
          <p className="inline-flex items-center gap-2 text-sm text-muted">
            {message.searching ? <Globe className="size-4 animate-pulse" /> : <span className="size-2 animate-pulse rounded-full bg-accent" />}
            {message.searching ? 'Searching the web…' : 'Thinking…'}
          </p>
        )}
        {message.error && <p className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">{message.error}</p>}
        {message.sources.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-muted">Sources</p>
            <div className="flex flex-wrap gap-2">
              {message.sources.map((source) => (
                <LinkPill key={source.url} url={source.url} label={source.title} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface ComposerProps {
  value: string
  onChange(value: string): void
  onSubmit(): void
  disabled: boolean
  large: boolean
  footer?: ReactNode
}

function Composer({ value, onChange, onSubmit, disabled, large, footer }: ComposerProps) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit()
  }
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      onSubmit()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-line bg-surface p-2 shadow-pop transition-colors focus-within:border-accent">
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={4000}
          placeholder="Ask about a subject, a grade, or where to begin…"
          aria-label="Message the assistant"
          className={cn('field-sizing-content max-h-48 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 placeholder:text-faint focus:outline-none', large ? 'text-base' : 'text-[15px]')}
        />
        <button type="submit" disabled={disabled || !value.trim()} aria-label="Send" className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-white transition-colors hover:bg-accent-hover disabled:opacity-40">
          <ArrowUp className="size-5" />
        </button>
      </div>
      {footer && <div className="px-3 pt-1.5 pb-1">{footer}</div>}
    </form>
  )
}

function PlanModal({ conversationId, defaultStudentId, onClose }: { conversationId: string; defaultStudentId: string; onClose(): void }) {
  const { students, createAssignments } = useData()
  const navigate = useNavigate()
  const [items, setItems] = useState<PlanItem[] | null>(null)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [studentId, setStudentId] = useState(defaultStudentId || students[0]?.id || '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    draftAssignments(conversationId)
      .then((drafted) => {
        if (cancelled) return
        setItems(drafted)
        setPicked(new Set(drafted.map((_, index) => index)))
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Something went wrong.')
      })
    return () => {
      cancelled = true
    }
  }, [conversationId])

  function toggle(index: number) {
    setPicked((current) => {
      const next = new Set(current)
      if (!next.delete(index)) next.add(index)
      return next
    })
  }

  async function save() {
    if (!items) return
    setSaving(true)
    setError(null)
    try {
      const today = new Date()
      await createAssignments(
        items
          .filter((_, index) => picked.has(index))
          .map((item) => ({
            student_id: studentId,
            title: item.title.slice(0, 200),
            subject: item.subject,
            instructions: item.instructions || null,
            due_date: toISODate(addDays(today, Math.max(0, item.due_in_days))),
            // Links come from a model: keep only plain web URLs.
            links: item.links.flatMap((link) => {
              const url = safeUrl(link.url)
              return url ? [{ label: link.label, url }] : []
            }),
          })),
      )
      navigate('/parent/assignments')
    } catch (cause) {
      console.error(cause)
      setError("Those didn't save. Please try again.")
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Create assignments" description="Review what the assistant drafted. Untick anything you don't want.">
      {error && <p className="mb-4 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      {!items && !error && (
        <div className="space-y-2">
          <p className="mb-3 text-sm text-muted">Drafting assignments from your plan…</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-sunken" />
          ))}
        </div>
      )}

      {items?.length === 0 && <p className="text-sm text-muted">There's no plan in this conversation yet. Ask the assistant for one first.</p>}

      {items && items.length > 0 && (
        <>
          {students.length === 0 ? (
            <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">Add a student on the Overview page first.</p>
          ) : (
            <label className="mb-4 flex items-center gap-3 text-sm font-medium">
              Assign to
              <Select className="w-auto min-w-40" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </label>
          )}
          <ul className="space-y-2">
            {items.map((item, index) => (
              <li key={index}>
                <label className={cn('flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-colors', picked.has(index) ? 'border-accent bg-accent-soft/40' : 'border-line opacity-60')}>
                  <input type="checkbox" className="mt-1 size-4 shrink-0 accent-(--accent)" checked={picked.has(index)} onChange={() => toggle(index)} />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{item.title}</span>
                      <SubjectChip subject={item.subject} />
                    </span>
                    <span className="mt-0.5 block text-[13px] text-muted">{item.instructions}</span>
                    <span className="mt-1 block text-xs text-faint">
                      Due in {item.due_in_days} {item.due_in_days === 1 ? 'day' : 'days'}
                      {item.links.length > 0 && ` · ${item.links.length} ${item.links.length === 1 ? 'link' : 'links'}`}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" disabled={saving || picked.size === 0 || !studentId} onClick={() => void save()}>
              {saving ? 'Adding…' : `Add ${picked.size} ${picked.size === 1 ? 'assignment' : 'assignments'}`}
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}
