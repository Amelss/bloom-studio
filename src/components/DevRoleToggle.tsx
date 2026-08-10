import { IS_DEV } from '../lib/dev'

/**
 * A dev-only bar that lets a course owner preview the student side of the
 * Classroom (and enrol themselves) so the whole loop is testable from one
 * account. Renders nothing in a production build.
 */
export function DevRoleToggle({
  asStudent,
  onChange,
  onEnrol,
}: {
  asStudent: boolean
  onChange: (asStudent: boolean) => void
  onEnrol?: () => void
}) {
  if (!IS_DEV) return null
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-amber-400/70 bg-amber-50 px-3 py-2 text-xs">
      <span className="rounded bg-amber-400/20 px-1.5 py-0.5 font-semibold text-amber-700">Dev</span>
      <span className="text-amber-700/80">Viewing as</span>
      <div className="flex overflow-hidden rounded-lg border border-amber-300">
        <button
          onClick={() => onChange(false)}
          className={`px-2.5 py-1 font-medium ${!asStudent ? 'bg-amber-500 text-white' : 'text-amber-700'}`}
        >
          Educator
        </button>
        <button
          onClick={() => onChange(true)}
          className={`px-2.5 py-1 font-medium ${asStudent ? 'bg-amber-500 text-white' : 'text-amber-700'}`}
        >
          Student
        </button>
      </div>
      {onEnrol && (
        <button
          onClick={onEnrol}
          className="ml-auto rounded-lg border border-amber-300 px-2.5 py-1 font-medium text-amber-700 hover:bg-amber-100"
        >
          Enrol me as a student
        </button>
      )}
    </div>
  )
}
