import { supabase } from './supabase'
import { migrateDocument } from '../domain/migrate'
import type { SampleInput } from './progressApi'
import type { DesignDocument } from '../domain/types'
import type { Assignment, Course, RosterMember, SubmissionMeta } from './types'

/**
 * The Classroom (M5): courses, rosters, assignments and submissions. Reads go
 * through RLS (educators see their courses + everything under them; students
 * see courses they've joined and their own submissions). Cross-user writes —
 * joining, submitting, grading — go through SECURITY DEFINER RPCs, which also
 * lets PATCH-shaped updates run as POSTs. See supabase/migrations/0009_classroom.sql.
 */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1
const SUBMISSION_COLS =
  'id, assignment_id, student_id, student_name, design_id, thumbnail_url, auto_score, status, grade, feedback, submitted_at, graded_at'

/**
 * Turn a raw error into something the UI can show. Only a genuinely missing
 * table/function (the migration not having been run) gets the setup notice —
 * keyed on Postgres/PostgREST codes, not on a table name appearing in the text,
 * so real errors (e.g. an RLS misconfiguration) surface as themselves.
 */
export function classroomErrorMessage(e: unknown): string {
  const err = (e ?? {}) as { code?: string; message?: string }
  const code = err.code
  const msg = e instanceof Error ? e.message : String(err.message ?? e)
  const missing =
    code === '42P01' || // undefined_table
    code === '42883' || // undefined_function
    code === 'PGRST205' || // table not in schema cache
    code === 'PGRST202' || // function not in schema cache
    /schema cache|could not find the (table|function)|relation ".*" does not exist/i.test(msg)
  if (missing) {
    return 'The classroom isn’t set up on the database yet. Run migration 0009_classroom.sql in Supabase, then reload.'
  }
  return msg || 'Something went wrong.'
}

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  const id = data.user?.id
  if (!id) throw new Error('You are not signed in.')
  return id
}

function generateJoinCode(len = 6): string {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length]
  return out
}

/* ─────────────────────────────── courses ───────────────────────────────── */

/** Create a course (the caller becomes its educator). Retries on a code clash. */
export async function createCourse(name: string): Promise<Course> {
  const educator_id = await requireUserId()
  for (let attempt = 0; attempt < 5; attempt++) {
    const join_code = generateJoinCode()
    const { data, error } = await supabase
      .from('courses')
      .insert({ educator_id, name: name.trim(), join_code })
      .select('*')
      .single()
    if (!error) return data as Course
    // 23505 = unique_violation: the code collided, try another.
    if ((error as { code?: string }).code !== '23505') throw error
  }
  throw new Error('Could not generate a unique join code — please try again.')
}

/** Every course the caller can see (owned as educator or joined as student). */
export async function listCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Course[]
}

export async function getCourse(id: string): Promise<Course | null> {
  const { data, error } = await supabase.from('courses').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as Course) ?? null
}

/**
 * Join a course by code; returns the course id + name. In dev we pass
 * `p_allow_self` so one account can enrol in its own course for solo testing;
 * production builds never send it (import.meta.env.DEV is false).
 */
export async function joinCourse(code: string): Promise<{ courseId: string; courseName: string }> {
  const { data, error } = await supabase.rpc('join_course', {
    p_code: code,
    p_allow_self: import.meta.env.DEV,
  })
  if (error) throw error
  const row = (data as Array<{ out_course_id: string; out_course_name: string }> | null)?.[0]
  if (!row) throw new Error('Could not join that course.')
  return { courseId: row.out_course_id, courseName: row.out_course_name }
}

/** The course roster (educator-only in practice, via RLS). */
export async function listRoster(courseId: string): Promise<RosterMember[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('id, course_id, student_id, student_name, joined_at')
    .eq('course_id', courseId)
    .order('joined_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as RosterMember[]
}

/* ───────────────────────────── assignments ─────────────────────────────── */

export async function createAssignment(input: {
  courseId: string
  briefId: string | null
  title: string
  notes: string | null
  dueAt: string | null
}): Promise<Assignment> {
  const { data, error } = await supabase
    .from('assignments')
    .insert({
      course_id: input.courseId,
      brief_id: input.briefId,
      title: input.title.trim(),
      notes: input.notes?.trim() || null,
      due_at: input.dueAt,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Assignment
}

/** Edit an existing assignment (RPC — a direct UPDATE would be a blocked PATCH). */
export async function updateAssignment(
  id: string,
  patch: { title: string; notes: string | null; dueAt: string | null },
): Promise<void> {
  const { error } = await supabase.rpc('update_assignment', {
    p_id: id,
    p_title: patch.title.trim(),
    p_notes: patch.notes ?? '',
    p_due_at: patch.dueAt,
  })
  if (error) throw error
}

export async function listAssignments(courseId: string): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Assignment[]
}

export async function getAssignment(id: string): Promise<Assignment | null> {
  const { data, error } = await supabase.from('assignments').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as Assignment) ?? null
}

/** Every assignment the caller can see, across all their courses (RLS-scoped).
 *  For a student that's every enrolled course's assignments. */
export async function listMyAssignments(): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Assignment[]
}

/** Every submission the caller can see (RLS scopes a student to their own). */
export async function listMySubmissions(): Promise<SubmissionMeta[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select(SUBMISSION_COLS)
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as SubmissionMeta[]
}

/* ───────────────────────────── submissions ─────────────────────────────── */

/** Submit (or resubmit) a design, with its overall score + per-principle report. */
export async function submitAssignment(input: {
  assignmentId: string
  designId: string
  autoScore: number | null
  report: SampleInput[]
}): Promise<void> {
  const { error } = await supabase.rpc('submit_assignment', {
    p_assignment_id: input.assignmentId,
    p_design_id: input.designId,
    p_auto_score: input.autoScore,
    p_report: input.report,
  })
  if (error) throw error
}

/** Per-principle reports for every submission in a course — cohort analytics. */
export async function listCourseReports(
  assignmentIds: string[],
): Promise<Array<SampleInput[] | null>> {
  if (assignmentIds.length === 0) return []
  const { data, error } = await supabase
    .from('submissions')
    .select('report')
    .in('assignment_id', assignmentIds)
  if (error) throw error
  return ((data ?? []) as Array<{ report: SampleInput[] | null }>).map((r) => r.report)
}

/**
 * How many ungraded submissions the caller can see. For an educator that's the
 * review queue across all their courses (RLS scopes it); used for the sidebar
 * badge. A head+count query, so no rows are transferred.
 */
export async function countNewSubmissions(): Promise<number> {
  const { count, error } = await supabase
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'submitted')
  if (error) throw error
  return count ?? 0
}

/** Every submission across a course's assignments (educator course overview). */
export async function listSubmissionsForCourse(assignmentIds: string[]): Promise<SubmissionMeta[]> {
  if (assignmentIds.length === 0) return []
  const { data, error } = await supabase
    .from('submissions')
    .select(SUBMISSION_COLS)
    .in('assignment_id', assignmentIds)
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as SubmissionMeta[]
}

/** Every submission for an assignment (educator view). */
export async function listSubmissions(assignmentId: string): Promise<SubmissionMeta[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select(SUBMISSION_COLS)
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as SubmissionMeta[]
}

/** The caller's own submission for an assignment, if any (student view). */
export async function getMySubmission(assignmentId: string): Promise<SubmissionMeta | null> {
  const student_id = await requireUserId()
  const { data, error } = await supabase
    .from('submissions')
    .select(SUBMISSION_COLS)
    .eq('assignment_id', assignmentId)
    .eq('student_id', student_id)
    .maybeSingle()
  if (error) throw error
  return (data as SubmissionMeta) ?? null
}

/** The frozen document of one submission (for the educator's preview). */
export async function getSubmissionDoc(submissionId: string): Promise<DesignDocument> {
  const { data, error } = await supabase
    .from('submissions')
    .select('doc')
    .eq('id', submissionId)
    .single()
  if (error) throw error
  return migrateDocument((data as { doc: DesignDocument }).doc)
}

/** Grade a submission (educator only). */
export async function gradeSubmission(
  submissionId: string,
  grade: number,
  feedback: string,
): Promise<void> {
  const { error } = await supabase.rpc('grade_submission', {
    p_submission_id: submissionId,
    p_grade: grade,
    p_feedback: feedback,
  })
  if (error) throw error
}
