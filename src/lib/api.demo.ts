import { addDays, toISODate } from './format'
import type { Api, Assignment, Student } from './types'

// Demo backend: same interface as Supabase, stored in localStorage so the app
// can be explored before a database exists.

const KEY = 'homeroom-demo-v1'

interface Store {
  students: Student[]
  assignments: Assignment[]
}

function seed(): Store {
  const now = new Date()
  const day = (offset: number) => toISODate(addDays(now, offset))
  const stamp = now.toISOString()
  const maya = crypto.randomUUID()
  const theo = crypto.randomUUID()

  const make = (
    student_id: string,
    title: string,
    subject: string,
    due: number,
    links: Array<[string, string]>,
    rest: Partial<Assignment> = {},
  ): Assignment => ({
    id: crypto.randomUUID(),
    student_id,
    title,
    subject,
    instructions: null,
    due_date: day(due),
    status: 'todo',
    student_note: null,
    submitted_at: null,
    parent_feedback: null,
    reviewed_at: null,
    created_at: stamp,
    links: links.map(([label, url], position) => ({ id: crypto.randomUUID(), label, url, position })),
    ...rest,
  })

  return {
    students: [
      { id: maya, name: 'Maya', grade_level: '4th grade', color: 'iris', created_at: stamp },
      { id: theo, name: 'Theo', grade_level: '1st grade', color: 'amber', created_at: stamp },
    ],
    assignments: [
      make(maya, 'Multiplying by 2-digit numbers', 'Math', 0, [['Khan Academy', 'https://www.khanacademy.org']], {
        instructions: 'Watch the two intro videos, then finish the practice set. Aim for 80% or better.',
      }),
      make(maya, 'Read chapters 4-6 and write a summary', 'Reading', 1, [], {
        instructions: 'Write five sentences about what changed for the main character.',
        status: 'in_progress',
      }),
      make(maya, 'Build a maze game', 'Coding', 3, [['Scratch', 'https://scratch.mit.edu']], {
        instructions: 'Your sprite should move with the arrow keys and stop at walls.',
      }),
      make(maya, 'States of matter lab notes', 'Science', -1, [['Crash Course Kids', 'https://www.youtube.com/@crashcoursekids']], {
        status: 'submitted',
        student_note: 'I did the ice experiment twice because the first one melted too fast!',
        submitted_at: stamp,
      }),
      make(maya, 'Paragraph: my favorite place', 'Writing', -2, [], {
        status: 'needs_changes',
        parent_feedback: 'Great details! Add a closing sentence and check your capital letters.',
        reviewed_at: stamp,
      }),
      make(maya, 'Spanish: food words, unit 3', 'Languages', -3, [['Duolingo', 'https://www.duolingo.com']], {
        status: 'verified',
        reviewed_at: stamp,
      }),
      make(theo, 'Letter sounds: short vowels', 'Reading', 0, [['Starfall', 'https://www.starfall.com']], {
        instructions: 'Play the short "a" and short "e" games.',
      }),
      make(theo, 'Count to 100 by tens', 'Math', 2, [['Khan Academy', 'https://www.khanacademy.org']]),
      make(theo, 'Draw the life cycle of a butterfly', 'Science', -1, [], {
        status: 'submitted',
        student_note: 'I drew four pictures.',
        submitted_at: stamp,
      }),
    ],
  }
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Store
  } catch {
    // unreadable storage: fall through to a fresh seed
  }
  const store = seed()
  save(store)
  return store
}

function save(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // storage unavailable (private mode): the demo still works for this page load
  }
}

export function createDemoApi(): Api {
  let store = load()
  const commit = (next: Store) => {
    store = next
    save(store)
  }

  return {
    async listStudents() {
      return store.students
    },

    async createStudent(input) {
      const student: Student = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input }
      commit({ ...store, students: [...store.students, student] })
    },

    async listAssignments() {
      return [...store.assignments].sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
    },

    async createAssignments(inputs) {
      const created = inputs.map(
        (input): Assignment => ({
          id: crypto.randomUUID(),
          student_id: input.student_id,
          title: input.title,
          subject: input.subject,
          instructions: input.instructions ?? null,
          due_date: input.due_date ?? null,
          status: 'todo',
          student_note: null,
          submitted_at: null,
          parent_feedback: null,
          reviewed_at: null,
          created_at: new Date().toISOString(),
          links: input.links.map((link, position) => ({
            id: crypto.randomUUID(),
            label: link.label || null,
            url: link.url,
            position,
          })),
        }),
      )
      commit({ ...store, assignments: [...store.assignments, ...created] })
    },

    async updateAssignment(id, patch) {
      const now = new Date().toISOString()
      commit({
        ...store,
        assignments: store.assignments.map((a) => {
          if (a.id !== id) return a
          const next = { ...a, ...patch }
          if (patch.status === 'submitted') next.submitted_at = now
          if (patch.status === 'verified' || patch.status === 'needs_changes') next.reviewed_at = now
          return next
        }),
      })
    },

    async deleteAssignment(id) {
      commit({ ...store, assignments: store.assignments.filter((a) => a.id !== id) })
    },
  }
}
