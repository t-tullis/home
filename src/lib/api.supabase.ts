import type { SupabaseClient } from '@supabase/supabase-js'
import type { Api, Assignment } from './types'

/** Row-level security scopes every query to the signed-in family, so no parent_id filters here. */
export function createSupabaseApi(db: SupabaseClient): Api {
  return {
    async listStudents() {
      const { data, error } = await db.from('students').select('*').order('created_at')
      if (error) throw error
      return data
    },

    async createStudent(input) {
      const { error } = await db.from('students').insert(input)
      if (error) throw error
    },

    async listAssignments() {
      const { data, error } = await db
        .from('assignments')
        .select('*, links:assignment_links(id, label, url, position)')
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('position', { referencedTable: 'assignment_links' })
      if (error) throw error
      return data as Assignment[]
    },

    async createAssignments(inputs) {
      for (const { links, ...assignment } of inputs) {
        const { data, error } = await db.from('assignments').insert(assignment).select('id').single()
        if (error) throw error
        if (links.length === 0) continue
        const { error: linkError } = await db.from('assignment_links').insert(
          links.map((link, position) => ({
            assignment_id: data.id,
            label: link.label || null,
            url: link.url,
            position,
          })),
        )
        if (linkError) throw linkError
      }
    },

    async updateAssignment(id, patch) {
      const { error } = await db.from('assignments').update(patch).eq('id', id)
      if (error) throw error
    },

    async deleteAssignment(id) {
      const { error } = await db.from('assignments').delete().eq('id', id)
      if (error) throw error
    },
  }
}
