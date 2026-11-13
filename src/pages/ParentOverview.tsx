import { AlarmClock, CalendarDays, Check, CircleCheckBig, Inbox, Plus, Undo2, UserPlus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { StudentForm } from '../components/StudentForm'
import { Avatar, Button, Card, EmptyState, LinkPill, Modal, ProgressBar, SubjectChip, Textarea } from '../components/ui'
import { cn, daysUntil, dueLabel, greeting } from '../lib/format'
import type { Assignment, Student } from '../lib/types'
import { useData } from '../state/data'
import { PageHeader } from './ParentShell'

export default function ParentOverview() {
  const { students, assignments, loading, error, createStudent } = useData()
  const [addingStudent, setAddingStudent] = useState(false)
  const [sendingBack, setSendingBack] = useState<Assignment | null>(null)

  const queue = assignments.filter((a) => a.status === 'submitted')
  const open = assignments.filter((a) => a.status !== 'verified' && a.status !== 'submitted')
  const overdue = open.filter((a) => a.due_date && daysUntil(a.due_date) < 0)
  const dueSoon = open.filter((a) => a.due_date && daysUntil(a.due_date) >= 0 && daysUntil(a.due_date) <= 7)
  const verified = assignments.filter((a) => a.status === 'verified')
  const studentById = new Map(students.map((s) => [s.id, s]))

  return (
    <>
      <PageHeader
        title={`${greeting()}`}
        subtitle={queue.length > 0 ? `${queue.length} ${queue.length === 1 ? 'assignment is' : 'assignments are'} waiting for you to check.` : 'Nothing is waiting on you right now.'}
        action={
          <Button onClick={() => setAddingStudent(true)}>
            <UserPlus className="size-4" /> Add student
          </Button>
        }
      />

      {error && <p className="mb-6 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}

      <div className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Inbox className="size-4" />} label="To review" value={queue.length} tone="accent" loading={loading} />
        <Stat icon={<CalendarDays className="size-4" />} label="Due in 7 days" value={dueSoon.length} loading={loading} />
        <Stat icon={<AlarmClock className="size-4" />} label="Overdue" value={overdue.length} tone={overdue.length > 0 ? 'danger' : undefined} loading={loading} />
        <Stat icon={<CircleCheckBig className="size-4" />} label="Verified" value={verified.length} tone="success" loading={loading} />
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
        <section>
          <h2 className="mb-3 text-[13px] font-semibold tracking-wide text-muted uppercase">Review queue</h2>
          {!loading && queue.length === 0 ? (
            <EmptyState icon={<Check className="size-5" />} title="You're all caught up">
              When a student marks work as finished, it lands here for you to check.
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {queue.map((assignment) => (
                <ReviewCard key={assignment.id} assignment={assignment} student={studentById.get(assignment.student_id)} onSendBack={() => setSendingBack(assignment)} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-[13px] font-semibold tracking-wide text-muted uppercase">Students</h2>
          <div className="space-y-3">
            {students.map((student) => {
              const theirs = assignments.filter((a) => a.student_id === student.id)
              const done = theirs.filter((a) => a.status === 'verified').length
              return (
                <Card key={student.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar student={student} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{student.name}</p>
                      <p className="text-xs text-muted">{student.grade_level ?? 'Grade not set'}</p>
                    </div>
                  </div>
                  <div className="mt-3.5 mb-1.5 flex justify-between text-xs text-muted">
                    <span>Verified</span>
                    <span>{done} of {theirs.length}</span>
                  </div>
                  <ProgressBar value={done} max={theirs.length} />
                </Card>
              )
            })}
            <button type="button" onClick={() => setAddingStudent(true)} className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line py-3.5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent-ink">
              <Plus className="size-4" /> Add student
            </button>
          </div>
        </section>
      </div>

      <Modal open={addingStudent} onClose={() => setAddingStudent(false)} title="Add a student" description="Students don't need their own login. They use the student view on your account.">
        <StudentForm
          onCancel={() => setAddingStudent(false)}
          onSubmit={async (student) => {
            await createStudent(student)
            setAddingStudent(false)
          }}
        />
      </Modal>

      <SendBackModal assignment={sendingBack} onClose={() => setSendingBack(null)} />
    </>
  )
}

function Stat({ icon, label, value, tone, loading }: { icon: ReactNode; label: string; value: number; tone?: 'accent' | 'danger' | 'success'; loading: boolean }) {
  const tones = { accent: 'bg-accent-soft text-accent-ink', danger: 'bg-danger-soft text-danger', success: 'bg-success-soft text-success' }
  return (
    <Card className="p-4">
      <div className={cn('mb-3 grid size-8 place-items-center rounded-lg', tone ? tones[tone] : 'bg-sunken text-muted')}>{icon}</div>
      <p className="text-[28px] leading-none font-semibold tracking-tight tabular-nums">{loading ? '–' : value}</p>
      <p className="mt-1.5 text-[13px] text-muted">{label}</p>
    </Card>
  )
}

function ReviewCard({ assignment, student, onSendBack }: { assignment: Assignment; student?: Student; onSendBack(): void }) {
  const { updateAssignment } = useData()
  const [busy, setBusy] = useState(false)
  const due = dueLabel(assignment.due_date)

  async function verify() {
    setBusy(true)
    try {
      await updateAssignment(assignment.id, { status: 'verified' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="rise p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        {student && (
          <span className="inline-flex items-center gap-1.5 font-medium text-ink">
            <Avatar student={student} size="sm" /> {student.name}
          </span>
        )}
        <SubjectChip subject={assignment.subject} />
        {due && <span>{due.text}</span>}
      </div>
      <h3 className="mt-2.5 text-[17px] leading-snug font-semibold tracking-tight">{assignment.title}</h3>
      {assignment.instructions && <p className="mt-1 text-sm text-muted">{assignment.instructions}</p>}

      {assignment.student_note && (
        <blockquote className="mt-3 rounded-xl bg-sunken px-3.5 py-3 text-sm">
          <span className="font-medium">{student?.name ?? 'Student'}:</span> {assignment.student_note}
        </blockquote>
      )}

      {assignment.links.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-muted">Open the work to check it</p>
          <div className="flex flex-wrap gap-2">
            {assignment.links.map((link) => (
              <LinkPill key={link.id} url={link.url} label={link.label} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onSendBack} disabled={busy}>
          <Undo2 className="size-4" /> Send back
        </Button>
        <Button variant="primary" onClick={() => void verify()} disabled={busy}>
          <Check className="size-4" /> Verify
        </Button>
      </div>
    </Card>
  )
}

function SendBackModal({ assignment, onClose }: { assignment: Assignment | null; onClose(): void }) {
  const { updateAssignment } = useData()
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!assignment) return
    setBusy(true)
    try {
      await updateAssignment(assignment.id, { status: 'needs_changes', parent_feedback: feedback.trim() || null })
      setFeedback('')
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={assignment !== null} onClose={onClose} title="Send back for changes" description={assignment?.title}>
      <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What should they fix or try again?" autoFocus />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={busy} onClick={() => void submit()}>Send back</Button>
      </div>
    </Modal>
  )
}
