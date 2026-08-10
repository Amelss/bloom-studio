import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ClassroomShell } from '../components/ClassroomShell'
import { useCourse } from '../hooks/useCourse'
import { BRIEFS, BRIEF_INDEX } from '../education/briefs'
import { classroomErrorMessage as errMsg, createAssignment } from '../lib/classroomApi'

type Mode = 'brief' | 'custom'

const fieldCls =
  'w-full rounded-lg border border-bloom-200 bg-white px-3 py-2 text-sm focus:border-bloom-500 focus:outline-none focus:ring-2 focus:ring-bloom-500/20'

/** Create an assignment (route `/classroom/:courseId/new`). Educator only. */
export default function CreateAssignment() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const { course, isOwner, loading } = useCourse(courseId)

  const [mode, setMode] = useState<Mode>('brief')
  const [briefId, setBriefId] = useState(BRIEFS[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const brief = useMemo(() => (mode === 'brief' ? BRIEF_INDEX[briefId] : null), [mode, briefId])
  const effectiveTitle = title.trim() || (brief?.title ?? '')

  const submit = async () => {
    if (!courseId) return
    if (!effectiveTitle) {
      setError('Please give the assignment a title.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const a = await createAssignment({
        courseId,
        briefId: mode === 'brief' ? briefId : null,
        title: effectiveTitle,
        notes: notes || null,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      })
      navigate(`/classroom/${courseId}/a/${a.id}`)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const back = { to: `/classroom/${courseId}`, label: course?.name ?? 'Course' }

  if (!loading && course && !isOwner) {
    return (
      <ClassroomShell back={back}>
        <p className="mt-6 text-sm text-bloom-ink/55">Only the course educator can create assignments.</p>
      </ClassroomShell>
    )
  }

  return (
    <ClassroomShell back={back}>
      <h1 className="mb-1 mt-3 font-display text-3xl font-semibold tracking-tight text-bloom-ink">Create an assignment</h1>
      <p className="mb-6 text-sm text-bloom-ink/55">Set a brief for your students and add any instructions.</p>

      {/* Mode picker */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <ModeCard
          active={mode === 'brief'}
          onClick={() => setMode('brief')}
          title="Use a brief"
          hint="Pick a built-in brief — submissions are auto-checked against its goals."
        />
        <ModeCard
          active={mode === 'custom'}
          onClick={() => setMode('custom')}
          title="Create your own"
          hint="Write a custom assignment. Submissions still get an overall design score."
        />
      </div>

      <div className="space-y-4 rounded-2xl border border-bloom-200 bg-white p-5">
        {mode === 'brief' && (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-bloom-ink/60">Brief</span>
            <select value={briefId} onChange={(e) => setBriefId(e.target.value)} className={fieldCls}>
              {BRIEFS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
            {brief && (
              <div className="mt-2 rounded-lg bg-bloom-50 p-3">
                <p className="text-xs text-bloom-ink/70">{brief.scenario}</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {brief.constraints.map((c) => (
                    <li key={c.id} className="chip bg-bloom-100 text-bloom-700">
                      {c.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </label>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-bloom-ink/60">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={brief ? `Defaults to “${brief.title}”` : 'e.g. Autumn compote study'}
            className={fieldCls}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-bloom-ink/60">
            Instructions / notes <span className="font-normal text-bloom-ink/40">(optional)</span>
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Add any guidance, constraints or context for your students…"
            className={fieldCls}
          />
        </label>

        <label className="block sm:max-w-xs">
          <span className="mb-1 block text-xs font-semibold text-bloom-ink/60">
            Due date <span className="font-normal text-bloom-ink/40">(optional)</span>
          </span>
          <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={fieldCls} />
        </label>

        {error && <p className="text-sm text-bloom-clay">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={() => void submit()}
            disabled={busy}
            className="rounded-lg bg-bloom-600 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-bloom-700 disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create assignment'}
          </button>
          <button
            onClick={() => navigate(back.to)}
            className="rounded-lg px-3 py-2 text-sm font-medium text-bloom-ink/60 hover:bg-bloom-100 hover:text-bloom-ink"
          >
            Cancel
          </button>
        </div>
      </div>
    </ClassroomShell>
  )
}

function ModeCard({
  active,
  onClick,
  title,
  hint,
}: {
  active: boolean
  onClick: () => void
  title: string
  hint: string
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active ? 'border-bloom-500 bg-bloom-600/[0.06] ring-1 ring-bloom-500/30' : 'border-bloom-200 bg-white hover:border-bloom-500/50'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex h-4 w-4 items-center justify-center rounded-full border ${
            active ? 'border-bloom-600 bg-bloom-600' : 'border-bloom-ink/25'
          }`}
        >
          {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
        </span>
        <span className="text-sm font-semibold text-bloom-ink">{title}</span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-bloom-ink/55">{hint}</p>
    </button>
  )
}
