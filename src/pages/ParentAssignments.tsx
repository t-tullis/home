import { ClipboardList, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { AssignmentForm } from '../components/AssignmentForm'
import { Avatar, Button, Card, EmptyState, LinkPill, Modal, Select, StatusBadge, SubjectChip } from '../components/ui'
import { cn, dueLabel } from '../lib/format'
import { STATUS_META } from '../lib/subjects'
import type { AssignmentStatus } from '../lib/types'
import { useData } from '../state/data'
import { PageHeader } from './ParentShell'

type StatusFilter = 'all' | AssignmentStatus

const FILTERS: StatusFilter[] = ['all', 'todo', 'in_progress', 'submitted', 'needs_changes', 'verified']

export default function ParentAssignments() {
  const { students, assignments, loading, createAssignments, deleteAssignment } = useData()
  const [studentFilter, setStudentFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [creating, setCreating] = useState(false)

  const studentById = new Map(students.map((s) => [s.id, s]))
  const forStudent = assignments.filter((a) => studentFilter === 'all' || a.student_id === studentFilter)
  const visible = forStudent.filter((a) => statusFilter === 'all' || a.status === statusFilter)

  return (
    <>
      <PageHeader
        title="Assignments"
        subtitle="Everything you've assigned, across every platform your family uses."
        action={
          <Button variant="primary" onClick={() => setCreating(true)} disabled={students.length === 0}>
            <Plus className="size-4" /> New assignment
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Select className="w-auto min-w-36" value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)} aria-label="Filter by student">
          <option value="all">All students</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-sunken p-1">
          {FILTERS.map((filter) => {
            const count = filter === 'all' ? forStudent.length : forStudent.filter((a) => a.status === filter).length
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                aria-pressed={statusFilter === filter}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors',
                  statusFilter === filter ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink',
                )}
              >
                {filter === 'all' ? 'All' : STATUS_META[filter].label} <span className="text-faint tabular-nums">{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {!loading && students.length === 0 ? (
        <EmptyState icon={<ClipboardList className="size-5" />} title="Add a student first">
          Head to Overview and add a student, then come back to give them work.
        </EmptyState>
      ) : !loading && visible.length === 0 ? (
        <EmptyState icon={<ClipboardList className="size-5" />} title="No assignments here">
          Create one, or ask the Assistant to draft a plan and turn it into assignments.
        </EmptyState>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {visible.map((assignment) => {
            const student = studentById.get(assignment.student_id)
            const due = dueLabel(assignment.due_date)
            const late = due?.overdue && assignment.status !== 'verified' && assignment.status !== 'submitted'
            return (
              <div key={assignment.id} className="group flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{assignment.title}</p>
                    <SubjectChip subject={assignment.subject} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    {student && (
                      <span className="inline-flex items-center gap-1.5">
                        <Avatar student={student} size="sm" /> {student.name}
                      </span>
                    )}
                    {due && <span className={cn(late && 'font-medium text-danger')}>{due.text}</span>}
                  </div>
                  {assignment.links.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {assignment.links.map((link) => (
                        <LinkPill key={link.id} url={link.url} label={link.label} />
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <StatusBadge status={assignment.status} />
                  <button
                    type="button"
                    aria-label={`Delete ${assignment.title}`}
                    onClick={() => {
                      if (window.confirm(`Delete "${assignment.title}"? This can't be undone.`)) void deleteAssignment(assignment.id)
                    }}
                    className="rounded-lg p-2 text-faint hover:bg-danger-soft hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </Card>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="New assignment" description="Add links to the sites, videos or documents where the work gets done.">
        <AssignmentForm
          students={students}
          defaultStudentId={studentFilter === 'all' ? undefined : studentFilter}
          onCancel={() => setCreating(false)}
          onSubmit={async (assignment) => {
            await createAssignments([assignment])
            setCreating(false)
          }}
        />
      </Modal>
    </>
  )
}
