export type AssignmentStatus = 'todo' | 'in_progress' | 'submitted' | 'needs_changes' | 'verified'

export interface Student {
  id: string
  name: string
  grade_level: string | null
  color: string
  created_at: string
}

export interface AssignmentLink {
  id: string
  label: string | null
  url: string
  position: number
}

export interface Assignment {
  id: string
  student_id: string
  title: string
  subject: string
  instructions: string | null
  /** Calendar date, YYYY-MM-DD */
  due_date: string | null
  status: AssignmentStatus
  student_note: string | null
  submitted_at: string | null
  parent_feedback: string | null
  reviewed_at: string | null
  created_at: string
  links: AssignmentLink[]
}

export interface NewLink {
  label: string
  url: string
}

export interface NewAssignment {
  student_id: string
  title: string
  subject: string
  instructions?: string | null
  due_date?: string | null
  links: NewLink[]
}

export interface NewStudent {
  name: string
  grade_level: string | null
  color: string
}

export type AssignmentPatch = Partial<Pick<Assignment, 'status' | 'student_note' | 'parent_feedback'>>

/** Everything the UI needs from a backend. Implemented by Supabase and by the in-browser demo store. */
export interface Api {
  listStudents(): Promise<Student[]>
  createStudent(input: NewStudent): Promise<void>
  listAssignments(): Promise<Assignment[]>
  createAssignments(inputs: NewAssignment[]): Promise<void>
  updateAssignment(id: string, patch: AssignmentPatch): Promise<void>
  deleteAssignment(id: string): Promise<void>
}
