import { Link2, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { safeUrl } from '../lib/format'
import { SUBJECTS } from '../lib/subjects'
import type { NewAssignment, NewLink, Student } from '../lib/types'
import { Button, Field, Input, Select, Textarea } from './ui'

interface Props {
  students: Student[]
  defaultStudentId?: string
  onSubmit(assignment: NewAssignment): Promise<void>
  onCancel(): void
}

export function AssignmentForm({ students, defaultStudentId, onSubmit, onCancel }: Props) {
  const [studentId, setStudentId] = useState(defaultStudentId ?? students[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState(SUBJECTS[0])
  const [dueDate, setDueDate] = useState('')
  const [instructions, setInstructions] = useState('')
  const [links, setLinks] = useState<NewLink[]>([{ label: '', url: '' }])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const setLink = (index: number, patch: Partial<NewLink>) =>
    setLinks((current) => current.map((link, i) => (i === index ? { ...link, ...patch } : link)))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const filled = links.filter((link) => link.url.trim())
    const cleaned: NewLink[] = []
    for (const link of filled) {
      // Be forgiving: "khanacademy.org/..." is fine, we add the https://.
      const url = safeUrl(/^https?:\/\//i.test(link.url.trim()) ? link.url : `https://${link.url.trim()}`)
      if (!url) {
        setError(`"${link.url}" doesn't look like a web link.`)
        return
      }
      cleaned.push({ label: link.label.trim(), url })
    }
    setError(null)
    setSaving(true)
    try {
      await onSubmit({
        student_id: studentId,
        title: title.trim(),
        subject,
        instructions: instructions.trim() || null,
        due_date: dueDate || null,
        links: cleaned,
      })
    } catch (cause) {
      console.error(cause)
      setError("That didn't save. Please try again.")
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fractions practice set 3" required autoFocus />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Student">
          <Select value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
            {students.map((student) => (
              <option key={student.id} value={student.id}>{student.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Subject">
          <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
            {SUBJECTS.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Due">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </div>

      <Field label="Instructions" hint="Optional">
        <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="What should your student do, and what does done look like?" />
      </Field>

      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium">
          <Link2 className="size-3.5 text-faint" /> Where the work happens
        </p>
        <div className="space-y-2">
          {links.map((link, index) => (
            <div key={index} className="flex gap-2">
              <Input className="w-2/5" value={link.label} onChange={(e) => setLink(index, { label: e.target.value })} placeholder="Name" aria-label="Link name" />
              <Input value={link.url} onChange={(e) => setLink(index, { url: e.target.value })} placeholder="https://..." inputMode="url" aria-label="Link address" />
              {links.length > 1 && (
                <button type="button" aria-label="Remove link" onClick={() => setLinks((current) => current.filter((_, i) => i !== index))} className="rounded-lg px-2 text-faint hover:bg-sunken hover:text-danger">
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="mt-2 -ml-2" onClick={() => setLinks((current) => [...current, { label: '', url: '' }])}>
          <Plus className="size-3.5" /> Add another link
        </Button>
      </div>

      {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={saving || !studentId}>
          {saving ? 'Saving…' : 'Add assignment'}
        </Button>
      </div>
    </form>
  )
}
