import { supabase } from './supabase'
import type { ExerciseCompletion, SkillSample } from './types'

/**
 * Learning progress: append-only logs of exercise completions and per-principle
 * score samples. Written only at deliberate moments (finishing an exercise,
 * saving a version), read back on the Progress page. Owner-scoped by RLS.
 * See supabase/migrations/0008_progress.sql.
 */

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  const id = data.user?.id
  if (!id) throw new Error('You are not signed in.')
  return id
}

/** A per-principle score to log — the shape the report card yields. */
export interface SampleInput {
  principleId: string
  score: number
  tone: 'positive' | 'tip' | 'watch'
}

/** Log that a brief was completed, with the design's score at that moment. */
export async function recordExerciseCompletion(input: {
  briefId: string
  designId: string | null
  overallScore: number | null
}): Promise<void> {
  const owner_id = await requireUserId()
  const { error } = await supabase.from('exercise_completions').insert({
    owner_id,
    brief_id: input.briefId,
    design_id: input.designId,
    overall_score: input.overallScore,
  })
  if (error) throw error
}

/** Log a batch of per-principle scores for one design. No-op on an empty set. */
export async function recordSkillSamples(
  designId: string | null,
  samples: SampleInput[],
): Promise<void> {
  if (samples.length === 0) return
  const owner_id = await requireUserId()
  const rows = samples.map((s) => ({
    owner_id,
    design_id: designId,
    principle_id: s.principleId,
    score: s.score,
    tone: s.tone,
  }))
  const { error } = await supabase.from('skill_samples').insert(rows)
  if (error) throw error
}

/** Every exercise completion, newest first. */
export async function listExerciseCompletions(): Promise<ExerciseCompletion[]> {
  const { data, error } = await supabase
    .from('exercise_completions')
    .select('id, brief_id, design_id, overall_score, completed_at')
    .order('completed_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ExerciseCompletion[]
}

/** Every skill sample, newest first (mastery is derived from these). */
export async function listSkillSamples(): Promise<SkillSample[]> {
  const { data, error } = await supabase
    .from('skill_samples')
    .select('id, design_id, principle_id, score, tone, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as SkillSample[]
}
