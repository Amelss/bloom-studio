import type { DesignDocument } from '../domain/types'

/** Account roles — mirrors the `profiles.role` check in the SQL schema. */
export type UserRole = 'student' | 'educator' | 'professional' | 'admin' | 'beginner'

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'professional'

export interface Profile {
  id: string
  display_name: string
  role: UserRole
  onboarded: boolean
  organisation: string | null
  experience_level: ExperienceLevel | null
  avatar_url: string | null
  created_at: string
}

/** A full `designs` row (the design document lives in `doc`). */
export interface DesignRow {
  id: string
  owner_id: string
  name: string
  doc: DesignDocument
  doc_version: number
  thumbnail_url: string | null
  /** Unguessable public share token, or null when the design isn't shared. */
  share_id: string | null
  shared_at: string | null
  created_at: string
  updated_at: string
}

/** The read-only projection an anonymous viewer receives for a shared design. */
export interface SharedDesign {
  id: string
  name: string
  doc: DesignDocument
  updated_at: string
}

export type FeedbackVerdict = 'approved' | 'changes_requested'

/** A single client response left against a shared design. */
export interface DesignFeedback {
  id: string
  design_id: string
  verdict: FeedbackVerdict
  note: string | null
  reviewer_name: string | null
  created_at: string
  /** Set once the florist has actioned this response; null while outstanding. */
  resolved_at: string | null
}

/** Where a design sits in the review board. null = not on the board. */
export type ReviewStatus = 'new' | 'in_review' | 'read' | 'completed'

/** A design on the review board, with its most recent client reply (if any). */
export interface ReviewBoardItem {
  id: string
  name: string
  thumbnail_url: string | null
  review_status: ReviewStatus
  latest: {
    verdict: FeedbackVerdict
    note: string | null
    reviewer_name: string | null
    created_at: string
  } | null
}

/** What caused a snapshot to be taken. */
export type SnapshotKind = 'manual' | 'shared' | 'approved' | 'auto'

/** A frozen version of a design in its history — everything but the heavy `doc`. */
export interface SnapshotMeta {
  id: string
  design_id: string
  doc_version: number
  thumbnail_url: string | null
  label: string | null
  kind: SnapshotKind
  created_at: string
}

/** A logged completion of an exercise brief. */
export interface ExerciseCompletion {
  id: string
  brief_id: string
  design_id: string | null
  overall_score: number | null
  completed_at: string
}

/** One timestamped per-principle score, sampled at a deliberate moment. */
export interface SkillSample {
  id: string
  design_id: string | null
  principle_id: string
  score: number
  tone: 'positive' | 'tip' | 'watch'
  created_at: string
}

/** Derived (never stored): a principle's current mastery + recent trend. */
export interface PrincipleMastery {
  principleId: string
  name: string
  /** 0–100, the average of the most recent samples. */
  mastery: number
  samples: number
  trend: 'up' | 'down' | 'steady'
}

/* ───────────────────────────── classroom (M5) ──────────────────────────── */

/** A course an educator runs; students join with its `join_code`. */
export interface Course {
  id: string
  educator_id: string
  name: string
  join_code: string
  created_at: string
}

/** A student's place on a course roster (name denormalised at join time). */
export interface RosterMember {
  id: string
  course_id: string
  student_id: string
  student_name: string
  joined_at: string
}

/** One weighted scoring criterion in an assignment's rubric. */
export interface RubricCriterion {
  id: string
  label: string
  description: string
  /** Points this criterion is worth (1–100). */
  max: number
}

/** A rubric = an ordered list of criteria. `null`/`[]` ⇒ legacy free 0–100 grade. */
export type Rubric = RubricCriterion[]

/** An educator's score for one criterion (points earned, 0..max). */
export interface RubricScore {
  criterionId: string
  points: number
}

/** Coursework: a built-in exercise brief (brief_id set) or a custom one (null). */
export interface Assignment {
  id: string
  course_id: string
  brief_id: string | null
  title: string
  notes: string | null
  due_at: string | null
  /** Weighted scoring criteria, or null for the free 0–100 grade. */
  rubric: Rubric | null
  created_at: string
}

/** A submission list row — everything but the frozen `doc`. */
export interface SubmissionMeta {
  id: string
  assignment_id: string
  student_id: string
  student_name: string
  design_id: string | null
  thumbnail_url: string | null
  auto_score: number | null
  status: 'submitted' | 'graded'
  grade: number | null
  feedback: string | null
  /** Per-criterion breakdown when the assignment was graded on a rubric. */
  rubric_scores: RubricScore[] | null
  submitted_at: string
  graded_at: string | null
}

/** Trimmed row for the dashboard list — no heavy `doc`. */
export interface DesignListItem {
  id: string
  name: string
  thumbnail_url: string | null
  updated_at: string
}
