import type { AssignmentStatus } from './types'

// Keep the names in sync with SUBJECTS in supabase/functions/ai-assistant/index.ts
export const SUBJECT_HUES: Record<string, number> = {
  Math: 255,
  Reading: 25,
  Writing: 330,
  Science: 155,
  History: 70,
  Geography: 200,
  Art: 5,
  Music: 300,
  Languages: 180,
  Coding: 280,
  PE: 130,
  Other: 90,
}
export const SUBJECTS = Object.keys(SUBJECT_HUES)

export const STUDENT_COLORS: Record<string, number> = {
  iris: 275,
  sky: 230,
  mint: 165,
  amber: 70,
  rose: 10,
  plum: 325,
}

export const GRADE_LEVELS = [
  'Pre-K', 'Kindergarten', '1st grade', '2nd grade', '3rd grade', '4th grade', '5th grade', '6th grade',
  '7th grade', '8th grade', '9th grade', '10th grade', '11th grade', '12th grade',
]

type Tone = 'neutral' | 'accent' | 'warn' | 'danger' | 'success'

export const STATUS_META: Record<AssignmentStatus, { label: string; tone: Tone }> = {
  todo: { label: 'To do', tone: 'neutral' },
  in_progress: { label: 'In progress', tone: 'accent' },
  submitted: { label: 'Waiting for review', tone: 'warn' },
  needs_changes: { label: 'Needs changes', tone: 'danger' },
  verified: { label: 'Verified', tone: 'success' },
}
