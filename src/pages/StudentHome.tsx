import { ArrowRight, CheckCircle2, Clock, MessageSquareText, PartyPopper, ShieldCheck, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { Avatar, Button, Card, EmptyState, LinkPill, ProgressBar, SubjectChip, Textarea } from '../components/ui'
import { cn, dueLabel, greeting } from '../lib/format'
import type { Assignment } from '../lib/types'
import { useData } from '../state/data'

const STORAGE_KEY = 'homeroom-student'

export default function StudentHome() {
  const { students, assignments, loading, error } = useData()
  const [selectedId, setSelectedId] = useState(() => localStorage.getItem(STORAGE_KEY))
  const student = students.find((s) => s.id === selectedId) ?? students[0]

  const mine = assignments.filter((a) => a.student_id === student?.id)
  const redo = mine.filter((a) => a.status === 'needs_changes')
  const todo = mine.filter((a) => a.status === 'todo' || a.status === 'in_progress')
  const waiting = mine.filter((a) => a.status === 'submitted')
  const done = mine.filter((a) => a.status === 'verified')
  const open = redo.length + todo.length

  function select(id: string) {
    setSelectedId(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Brand />
          <Link to="/parent" className="inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium text-muted hover:bg-sunken hover:text-ink">
            <ShieldCheck className="size-4" /> Parent portal
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-8 pb-20">
        {error && <p className="mb-6 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}

        {loading ? (
          <div className="space-y-3">
            <div className="h-10 w-64 animate-pulse rounded-xl bg-sunken" />
            <div className="h-32 animate-pulse rounded-2xl bg-sunken" />
            <div className="h-32 animate-pulse rounded-2xl bg-sunken" />
          </div>
        ) : !student ? (
          <EmptyState icon={<ShieldCheck className="size-5" />} title="No students yet">
            Ask a parent to add you in the <Link to="/parent" className="font-medium text-accent-ink underline">parent portal</Link>.
          </EmptyState>
        ) : (
          <>
            {students.length > 1 && (
              <div className="mb-8 flex flex-wrap gap-2">
                {students.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => select(s.id)}
                    aria-pressed={s.id === student.id}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border py-1 pr-3.5 pl-1 text-sm font-medium transition-colors',
                      s.id === student.id ? 'border-line bg-surface shadow-card' : 'border-transparent text-muted hover:bg-sunken',
                    )}
                  >
                    <Avatar student={s} size="sm" /> {s.name}
                  </button>
                ))}
              </div>
            )}

            <section className="rise mb-8">
              <p className="text-sm text-muted">
                {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
                {greeting()}, {student.name}
              </h1>
              <Card className="mt-5 p-4">
                <div className="mb-2.5 flex items-baseline justify-between text-sm">
                  <span className="font-medium">
                    {open === 0 ? "You're all caught up" : `${open} ${open === 1 ? 'thing' : 'things'} to do`}
                  </span>
                  <span className="text-muted">{done.length} of {mine.length} checked off</span>
                </div>
                <ProgressBar value={done.length} max={mine.length} />
              </Card>
            </section>

            {mine.length === 0 && (
              <EmptyState icon={<PartyPopper className="size-5" />} title="Nothing assigned yet">
                When a parent adds work for you, it shows up here.
              </EmptyState>
            )}

            <Section title="Needs another look" items={redo} />
            <Section title="To do" items={todo} />
            <Section title="Waiting for a parent" items={waiting} />
            <Section title="Checked off" items={done} />
          </>
        )}
      </main>
    </div>
  )
}

function Section({ title, items }: { title: string; items: Assignment[] }) {
  if (items.length === 0) return null
  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold tracking-wide text-muted uppercase">
        {title} <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] text-faint">{items.length}</span>
      </h2>
      <div className="space-y-3">
        {items.map((assignment) => (
          <StudentAssignmentCard key={assignment.id} assignment={assignment} />
        ))}
      </div>
    </section>
  )
}

function StudentAssignmentCard({ assignment }: { assignment: Assignment }) {
  const { updateAssignment } = useData()
  const [finishing, setFinishing] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const due = dueLabel(assignment.due_date)
  const actionable = assignment.status === 'todo' || assignment.status === 'in_progress' || assignment.status === 'needs_changes'

  async function run(work: Promise<void>) {
    setBusy(true)
    try {
      await work
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className={cn('rise p-5', assignment.status === 'verified' && 'opacity-70')}>
      <div className="flex flex-wrap items-center gap-2">
        <SubjectChip subject={assignment.subject} />
        {due && assignment.status !== 'verified' && (
          <span className={cn('inline-flex items-center gap-1 text-xs', due.overdue && actionable ? 'font-medium text-danger' : 'text-muted')}>
            <Clock className="size-3" /> {due.text}
          </span>
        )}
        {assignment.status === 'in_progress' && <span className="text-xs font-medium text-accent-ink">Started</span>}
      </div>

      <h3 className="mt-2.5 text-[17px] leading-snug font-semibold tracking-tight">{assignment.title}</h3>
      {assignment.instructions && <p className="mt-1 text-sm leading-relaxed text-muted">{assignment.instructions}</p>}

      {assignment.status === 'needs_changes' && assignment.parent_feedback && (
        <div className="mt-3 flex gap-2.5 rounded-xl bg-danger-soft px-3.5 py-3 text-sm">
          <MessageSquareText className="mt-0.5 size-4 shrink-0 text-danger" />
          <p><span className="font-medium">From your parent:</span> {assignment.parent_feedback}</p>
        </div>
      )}

      {assignment.links.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {assignment.links.map((link) => (
            <LinkPill
              key={link.id}
              url={link.url}
              label={link.label}
              onOpen={() => {
                // Opening the work counts as starting it.
                if (assignment.status === 'todo') void updateAssignment(assignment.id, { status: 'in_progress' })
              }}
            />
          ))}
        </div>
      )}

      {actionable && !finishing && (
        <div className="mt-4 flex justify-end border-t border-line pt-4">
          <Button variant="primary" onClick={() => setFinishing(true)}>
            <CheckCircle2 className="size-4" /> I finished this
          </Button>
        </div>
      )}

      {actionable && finishing && (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything to tell your parent? (optional)" autoFocus />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setFinishing(false)}>Not yet</Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => run(updateAssignment(assignment.id, { status: 'submitted', student_note: note.trim() || null }))}
            >
              Send to parent <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {assignment.status === 'submitted' && (
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm text-muted">
          <span>Sent. A parent will check it soon.</span>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(updateAssignment(assignment.id, { status: 'in_progress' }))}>
            <Undo2 className="size-3.5" /> Undo
          </Button>
        </div>
      )}

      {assignment.status === 'verified' && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-success">
          <CheckCircle2 className="size-4" /> Checked by a parent
        </p>
      )}
    </Card>
  )
}
