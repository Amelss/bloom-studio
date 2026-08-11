import { useHasCanvasLearning } from './auth'
import { useStudio } from './store'

/**
 * Whether the pedagogical learning UI (the Learn tab + educational notes in the
 * library/depth/recipe panels) is currently active. Two conditions:
 *
 * 1. the account supports canvas learning (everyone but professional florists), and
 * 2. the user's Learning-mode toggle is on.
 *
 * This does NOT gate the design overlays (form guide / balance / tilt) — those
 * are a plain design tool, always available from the toolbar for every account.
 */
export function useLearningMode(): boolean {
  const capable = useHasCanvasLearning()
  const on = useStudio((s) => s.learningMode)
  return capable && on
}
