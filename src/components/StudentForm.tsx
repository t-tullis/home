import { useState, type CSSProperties, type FormEvent } from 'react'
import { cn } from '../lib/format'
import { GRADE_LEVELS, STUDENT_COLORS } from '../lib/subjects'
import type { NewStudent } from '../lib/types'
import { Button, Field, Input, Select } from './ui'

export function StudentForm({ onSubmit, onCancel }: { onSubmit(student: NewStudent): Promise<void>; onCancel(): void }) {
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('')
  const [color, setColor] = useState('iris')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      await onSubmit({ name: name.trim(), grade_level: grade || null, color })
    } catch (cause) {
      console.error(cause)
      setError("That didn't save. Please try again.")
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name">
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </Field>
        <Field label="Grade level" hint="Optional">
          <Select value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">Not set</option>
            {GRADE_LEVELS.map((level) => (
              <option key={level}>{level}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div>
        <p className="mb-2 text-[13px] font-medium">Color</p>
        <div className="flex gap-2">
          {Object.entries(STUDENT_COLORS).map(([key, h]) => (
            <button
              key={key}
              type="button"
              aria-label={key}
              aria-pressed={color === key}
              onClick={() => setColor(key)}
              style={{ '--h': h } as CSSProperties}
              className={cn('tint-solid size-8 rounded-full ring-offset-2 ring-offset-surface transition', color === key && 'ring-2 ring-ink')}
            />
          ))}
        </div>
      </div>
      {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add student'}</Button>
      </div>
    </form>
  )
}
