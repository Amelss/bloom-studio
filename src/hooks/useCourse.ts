import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../domain/auth'
import { classroomErrorMessage, getCourse } from '../lib/classroomApi'
import type { Course } from '../lib/types'

/** Load a course and tell whether the current user owns (teaches) it. */
export function useCourse(courseId: string | undefined) {
  const myId = useAuth((s) => s.user?.id)
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!courseId) return
    setLoading(true)
    try {
      setCourse(await getCourse(courseId))
    } catch (e) {
      setError(classroomErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { course, isOwner: !!course && course.educator_id === myId, loading, error, reload }
}
