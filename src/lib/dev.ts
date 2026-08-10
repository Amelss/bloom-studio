/**
 * Dev-only helpers for testing the Classroom loop solo. NONE of this affects a
 * production build: `IS_DEV` is false there, so the toggles no-op and the extra
 * RPC flag is never sent.
 */
export const IS_DEV = import.meta.env.DEV

/** True when the no-auth bypass is active (fake `dev-user`, no real session). */
export const IS_DEV_NO_AUTH = IS_DEV && import.meta.env.VITE_DEV_NO_AUTH === 'true'

const VIEW_KEY = 'bloom-dev-view-as-student'

/** Whether the dev "view as student" override is on (owners see the student UI). */
export function readDevStudentView(): boolean {
  if (!IS_DEV) return false
  try {
    return localStorage.getItem(VIEW_KEY) === '1'
  } catch {
    return false
  }
}

export function writeDevStudentView(on: boolean): void {
  try {
    localStorage.setItem(VIEW_KEY, on ? '1' : '0')
  } catch {
    // storage disabled — the toggle just won't persist across navigation
  }
}
