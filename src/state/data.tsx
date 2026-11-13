import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createDemoApi } from '../lib/api.demo'
import { createSupabaseApi } from '../lib/api.supabase'
import { supabase } from '../lib/supabase'
import type { Api, Assignment, AssignmentPatch, NewAssignment, NewStudent, Student } from '../lib/types'

interface DataState {
  students: Student[]
  assignments: Assignment[]
  loading: boolean
  error: string | null
  createStudent(input: NewStudent): Promise<void>
  createAssignments(inputs: NewAssignment[]): Promise<void>
  updateAssignment(id: string, patch: AssignmentPatch): Promise<void>
  deleteAssignment(id: string): Promise<void>
}

const DataContext = createContext<DataState | null>(null)

/** Loads the family's students and assignments once and reloads after every change. */
export function DataProvider({ children }: { children: ReactNode }) {
  const api: Api = useMemo(() => (supabase ? createSupabaseApi(supabase) : createDemoApi()), [])
  const [students, setStudents] = useState<Student[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [nextStudents, nextAssignments] = await Promise.all([api.listStudents(), api.listAssignments()])
      setStudents(nextStudents)
      setAssignments(nextAssignments)
      setError(null)
    } catch (cause) {
      console.error(cause)
      setError("We couldn't load your data. Check your connection and refresh.")
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo<DataState>(() => {
    const change = async (work: Promise<void>) => {
      await work
      await refresh()
    }
    return {
      students,
      assignments,
      loading,
      error,
      createStudent: (input) => change(api.createStudent(input)),
      createAssignments: (inputs) => change(api.createAssignments(inputs)),
      updateAssignment: (id, patch) => change(api.updateAssignment(id, patch)),
      deleteAssignment: (id) => change(api.deleteAssignment(id)),
    }
  }, [api, students, assignments, loading, error, refresh])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataState {
  const value = useContext(DataContext)
  if (!value) throw new Error('useData must be used inside DataProvider')
  return value
}
