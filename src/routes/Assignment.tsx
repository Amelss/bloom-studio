import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ClassroomShell } from '../components/ClassroomShell'
import { SharePreview } from '../components/canvas/SharePreview'
import { useAuth } from '../domain/auth'
import { readDevStudentView, writeDevStudentView } from '../lib/dev'
import { DevRoleToggle } from '../components/DevRoleToggle'
import { BRIEF_INDEX } from '../education/briefs'
import { scoreDesign } from '../education/report'
import { useDesigns } from '../hooks/useDesigns'
import { loadDesign } from '../lib/designsApi'
import {
  classroomErrorMessage as errMsg,
  getAssignment,
  getCourse,
  getMySubmission,
  getSubmissionDoc,
  gradeSubmission,
  listRoster,
  listSubmissions,
  submitAssignment,
  updateAssignment,
} from '../lib/classroomApi'
import type { Assignment as AssignmentT, RosterMember, SubmissionMeta } from '../lib/types'
import type { DesignDocument } from '../domain/types'

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null
  const cls = score >= 85 ? 'bg-bloom-100 text-bloom-700' : score >= 55 ? 'bg-amber-50 text-amber-700' : 'bg-orange-50 text-bloom-clay'
  return <span className={`chip ${cls}`}>{score}</span>
}

/** One assignment (route `/classroom/:courseId/a/:assignmentId`). Role-aware. */
export default function Assignment() {
  const { courseId, assignmentId } = useParams<{ courseId: string; assignmentId: string }>()
  const myId = useAuth((s) => s.user?.id)
  const [assignment, setAssignment] = useState<AssignmentT | null>(null)
  const [isEducator, setIsEducator] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [asStudent, setAsStudent] = useState(readDevStudentView())
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<DesignDocument | null>(null)
  const [editing, setEditing] = useState(false)

  const [submissions, setSubmissions] = useState<SubmissionMeta[]>([])
  const [roster, setRoster] = useState<RosterMember[]>([])
  const [mine, setMine] = useState<SubmissionMeta | null>(null)

  const brief = assignment?.brief_id ? BRIEF_INDEX[assignment.brief_id] : null

  const load = async () => {
    if (!assignmentId || !courseId) return
    setLoading(true)
    try {
      const [a, c] = await Promise.all([getAssignment(assignmentId), getCourse(courseId)])
      setAssignment(a)
      const owner = !!c && c.educator_id === myId
      setIsOwner(owner)
      const educator = owner && !asStudent // dev "view as student" flips this
      setIsEducator(educator)
      if (educator) {
        const [subs, r] = await Promise.all([listSubmissions(assignmentId), listRoster(courseId)])
        setSubmissions(subs)
        setRoster(r)
      } else {
        setMine(await getMySubmission(assignmentId))
      }
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, courseId, myId, asStudent])

  const toggleAsStudent = (v: boolean) => {
    writeDevStudentView(v)
    setAsStudent(v)
  }

  const openPreview = async (submissionId: string) => {
    try {
      setPreview(await getSubmissionDoc(submissionId))
    } catch (e) {
      setError(errMsg(e))
    }
  }

  const back = { to: `/classroom/${courseId}`, label: 'Course' }

  return (
    <ClassroomShell back={back}>
      {error && (
        <p className="mt-4 rounded-xl bg-bloom-600/[0.06] px-4 py-3 text-sm text-bloom-700 ring-1 ring-bloom-600/15">
          {error}
        </p>
      )}
      {loading && !assignment && <p className="mt-6 text-sm text-bloom-ink/45">Loading…</p>}

      {isOwner && (
        <div className="mt-4">
          <DevRoleToggle asStudent={asStudent} onChange={toggleAsStudent} />
        </div>
      )}

      {assignment && (
        <>
          {editing && isEducator ? (
            <EditAssignment
              assignment={assignment}
              onCancel={() => setEditing(false)}
              onSaved={() => {
                setEditing(false)
                void load()
              }}
            />
          ) : (
            <div className="mb-6 mt-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-bloom-ink/40">Assignment</p>
                  <h1 className="font-display text-3xl font-semibold tracking-tight text-bloom-ink">{assignment.title}</h1>
                  <p className="mt-1 text-sm text-bloom-ink/60">
                    {brief ? brief.title : 'Custom brief'}
                    {assignment.due_at ? ` · due ${new Date(assignment.due_at).toLocaleDateString()}` : ''}
                  </p>
                </div>
                {isEducator && (
                  <button
                    onClick={() => setEditing(true)}
                    className="shrink-0 rounded-lg border border-bloom-200 bg-white px-3 py-1.5 text-sm font-medium text-bloom-ink/70 hover:bg-bloom-100"
                  >
                    Edit
                  </button>
                )}
              </div>

              {brief?.scenario && <p className="mt-3 text-sm text-bloom-ink/70">{brief.scenario}</p>}

              {assignment.notes && (
                <div className="mt-3 rounded-xl border border-bloom-200 bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-bloom-ink/45">Instructions</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-bloom-ink/80">{assignment.notes}</p>
                </div>
              )}

              {brief && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {brief.constraints.map((c) => (
                    <li key={c.id} className="chip bg-bloom-100 text-bloom-700">
                      {c.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {isEducator ? (
            <EducatorView submissions={submissions} roster={roster} onPreview={openPreview} onGraded={() => void load()} />
          ) : (
            <StudentView
              assignmentId={assignment.id}
              mine={mine}
              onPreview={openPreview}
              onSubmitted={() => void load()}
              setError={setError}
            />
          )}
        </>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bloom-ink/40 p-4"
          onPointerDown={(e) => e.target === e.currentTarget && setPreview(null)}
        >
          <div className="flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-bloom-200 px-4 py-2.5">
              <h4 className="font-display text-sm font-semibold text-bloom-ink">Submission preview</h4>
              <button onClick={() => setPreview(null)} className="rounded-lg px-2 py-1 text-sm text-bloom-ink/60 hover:bg-bloom-100" aria-label="Close">
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 bg-bloom-50">
              <SharePreview doc={preview} />
            </div>
          </div>
        </div>
      )}
    </ClassroomShell>
  )
}

/* ─────────────────────────── edit (educator) ──────────────────────────── */

function EditAssignment({
  assignment,
  onCancel,
  onSaved,
}: {
  assignment: AssignmentT
  onCancel: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(assignment.title)
  const [notes, setNotes] = useState(assignment.notes ?? '')
  const [dueAt, setDueAt] = useState(assignment.due_at ? assignment.due_at.slice(0, 10) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fieldCls = 'w-full rounded-lg border border-bloom-200 bg-white px-3 py-2 text-sm focus:border-bloom-500 focus:outline-none focus:ring-2 focus:ring-bloom-500/20'

  const save = async () => {
    if (!title.trim()) {
      setError('Title cannot be empty.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await updateAssignment(assignment.id, {
        title,
        notes: notes || null,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      })
      onSaved()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-6 mt-3 space-y-3 rounded-2xl border border-bloom-200 bg-white p-5">
      <h2 className="font-display text-lg font-semibold text-bloom-ink">Edit assignment</h2>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-bloom-ink/60">Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldCls} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-bloom-ink/60">Instructions / notes</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className={fieldCls} />
      </label>
      <label className="block sm:max-w-xs">
        <span className="mb-1 block text-xs font-semibold text-bloom-ink/60">Due date</span>
        <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={fieldCls} />
      </label>
      {error && <p className="text-sm text-bloom-clay">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={() => void save()}
          disabled={busy}
          className="rounded-lg bg-bloom-600 px-4 py-2 text-sm font-semibold text-white hover:bg-bloom-700 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        <button onClick={onCancel} className="rounded-lg px-3 py-2 text-sm font-medium text-bloom-ink/60 hover:bg-bloom-100">
          Cancel
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────────────── educator ──────────────────────────────── */

function EducatorView({
  submissions,
  roster,
  onPreview,
  onGraded,
}: {
  submissions: SubmissionMeta[]
  roster: RosterMember[]
  onPreview: (id: string) => void
  onGraded: () => void
}) {
  const submittedIds = new Set(submissions.map((s) => s.student_id))
  const notSubmitted = roster.filter((m) => !submittedIds.has(m.student_id))

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-display text-xl font-semibold text-bloom-ink">Submissions</h2>
        <span className="text-sm text-bloom-ink/50">
          {submissions.length} of {roster.length} student{roster.length === 1 ? '' : 's'} submitted
        </span>
      </div>

      {submissions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-bloom-300 bg-white px-4 py-6 text-sm text-bloom-ink/50">
          No submissions yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {submissions.map((s) => (
            <SubmissionRow key={s.id} submission={s} onPreview={onPreview} onGraded={onGraded} />
          ))}
        </ul>
      )}

      {notSubmitted.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-bloom-ink/45">
            Not yet submitted ({notSubmitted.length})
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {notSubmitted.map((m) => (
              <li key={m.id} className="chip bg-bloom-ink/[0.05] text-bloom-ink/60">
                {m.student_name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function SubmissionRow({
  submission: s,
  onPreview,
  onGraded,
}: {
  submission: SubmissionMeta
  onPreview: (id: string) => void
  onGraded: () => void
}) {
  const [grading, setGrading] = useState(false)
  const [grade, setGrade] = useState(s.grade != null ? String(s.grade) : '')
  const [feedback, setFeedback] = useState(s.feedback ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await gradeSubmission(s.id, grade ? Number(grade) : 0, feedback)
      setGrading(false)
      onGraded()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the grade.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="rounded-xl border border-bloom-200 bg-white p-3">
      <div className="flex items-center gap-3">
        <button
          onClick={() => onPreview(s.id)}
          title="Preview submission"
          className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-bloom-50 ring-1 ring-bloom-200"
        >
          {s.thumbnail_url ? <img src={s.thumbnail_url} alt="" className="h-full w-full object-cover" /> : null}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-bloom-ink">{s.student_name}</p>
          <p className="text-[11px] text-bloom-ink/50">
            Submitted {new Date(s.submitted_at).toLocaleDateString()}
            {s.status === 'graded' && s.grade != null ? ` · graded ${s.grade}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-bloom-ink/45">auto</span>
          <ScoreBadge score={s.auto_score} />
          <button
            onClick={() => setGrading((v) => !v)}
            className="rounded-lg border border-bloom-200 px-2.5 py-1.5 text-xs font-semibold text-bloom-700 hover:bg-bloom-100"
          >
            {s.status === 'graded' ? 'Edit grade' : 'Grade'}
          </button>
        </div>
      </div>

      {grading && (
        <div className="mt-3 border-t border-bloom-100 pt-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-bloom-ink/60">Grade</label>
            <input
              type="number"
              min={0}
              max={100}
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-20 rounded-lg border border-bloom-200 px-2 py-1.5 text-sm"
            />
            <span className="text-xs text-bloom-ink/40">/ 100</span>
          </div>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Feedback for the student…"
            rows={3}
            className="mt-2 w-full rounded-lg border border-bloom-200 px-2.5 py-2 text-sm"
          />
          {error && <p className="mt-1 text-xs text-bloom-clay">{error}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => setGrading(false)} className="rounded-lg px-3 py-1.5 text-xs text-bloom-ink/60 hover:bg-bloom-100">
              Cancel
            </button>
            <button
              onClick={() => void save()}
              disabled={busy}
              className="rounded-lg bg-bloom-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-bloom-700 disabled:opacity-50"
            >
              Save grade
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

/* ──────────────────────────────── student ──────────────────────────────── */

function StudentView({
  assignmentId,
  mine,
  onPreview,
  onSubmitted,
  setError,
}: {
  assignmentId: string
  mine: SubmissionMeta | null
  onPreview: (id: string) => void
  onSubmitted: () => void
  setError: (m: string) => void
}) {
  const { designs } = useDesigns()
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const submit = async (designId: string) => {
    setBusy(designId)
    try {
      const row = await loadDesign(designId) // owner-only; gets the doc to score
      const score = scoreDesign(row.doc).overall
      await submitAssignment({ assignmentId, designId, autoScore: score })
      setPicking(false)
      onSubmitted()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-semibold text-bloom-ink">Your submission</h2>

      {mine ? (
        <div className="rounded-xl border border-bloom-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onPreview(mine.id)}
              className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-bloom-50 ring-1 ring-bloom-200"
              title="Preview your submission"
            >
              {mine.thumbnail_url ? <img src={mine.thumbnail_url} alt="" className="h-full w-full object-cover" /> : null}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-bloom-ink">{mine.status === 'graded' ? 'Graded' : 'Submitted'}</p>
              <p className="text-[11px] text-bloom-ink/50">{new Date(mine.submitted_at).toLocaleString()}</p>
            </div>
            {mine.status === 'graded' && mine.grade != null && (
              <span className="rounded-lg bg-bloom-100 px-3 py-1.5 text-sm font-bold text-bloom-700">{mine.grade}/100</span>
            )}
          </div>
          {mine.feedback && (
            <p className="mt-3 rounded-lg bg-bloom-50 px-3 py-2 text-sm text-bloom-ink/80">
              <span className="font-semibold">Feedback: </span>
              {mine.feedback}
            </p>
          )}
          <button onClick={() => setPicking((v) => !v)} className="mt-3 text-xs font-medium text-bloom-700 hover:underline">
            {picking ? 'Cancel' : 'Resubmit a different design'}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setPicking(true)}
          className="rounded-lg bg-bloom-600 px-4 py-2 text-sm font-semibold text-white hover:bg-bloom-700"
        >
          Submit a design
        </button>
      )}

      {picking && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-bloom-ink/70">Choose a design to submit</p>
          {!designs ? (
            <p className="text-sm text-bloom-ink/45">Loading your designs…</p>
          ) : designs.length === 0 ? (
            <p className="text-sm text-bloom-ink/50">You have no designs yet.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {designs.map((d) => (
                <li key={d.id}>
                  <button
                    onClick={() => void submit(d.id)}
                    disabled={busy !== null}
                    className="block w-full overflow-hidden rounded-xl border border-bloom-200 bg-white text-left transition hover:border-bloom-500/50 disabled:opacity-50"
                  >
                    <div className="aspect-[4/3] bg-bloom-50">
                      {d.thumbnail_url ? <img src={d.thumbnail_url} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <p className="truncate px-2 py-1.5 text-xs font-medium text-bloom-ink">
                      {busy === d.id ? 'Submitting…' : d.name}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
