import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStudio } from '../domain/store'
import { migrateDocument } from '../domain/migrate'
import type { DesignDocument } from '../domain/types'
import { loadDesign, saveDesign } from '../lib/designsApi'
import { captureThumbnail } from '../lib/thumbnail'

const SAVE_DEBOUNCE_MS = 1500

/**
 * Binds the editor to a cloud design: loads it into the studio store on mount,
 * then debounced-saves document changes back to Supabase (with a thumbnail),
 * mirroring to a per-design localStorage cache for offline resilience.
 */
export function useDesignSync(id: string | undefined) {
  const navigate = useNavigate()
  const loadedId = useRef<string | null>(null)

  // Load (cloud first, cache fallback) on mount / id change.
  useEffect(() => {
    if (!id) return
    let cancelled = false
    loadedId.current = null
    void (async () => {
      try {
        const row = await loadDesign(id)
        if (cancelled) return
        useStudio.getState().importDesign(row.doc) // runs migrateDocument
        loadedId.current = id
      } catch {
        const cached = readCache(id)
        if (cancelled) return
        if (cached) {
          useStudio.getState().importDesign(cached)
          loadedId.current = id
        } else {
          navigate('/', { replace: true }) // not found / not ours / offline w/o cache
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, navigate])

  // Debounced save on document change.
  useEffect(() => {
    if (!id) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let pending = false

    const flush = async () => {
      pending = false
      const doc = useStudio.getState().doc
      writeCache(id, doc)
      let thumbnail: string | null = null
      try {
        thumbnail = await captureThumbnail()
      } catch {
        // thumbnail is best-effort
      }
      try {
        // Only send the thumbnail when we actually captured one. A flush that
        // runs while the canvas is unmounting (navigating back to the dashboard)
        // gets none — we must NOT overwrite the saved image with null.
        await saveDesign(id, thumbnail ? { doc, name: doc.name, thumbnail } : { doc, name: doc.name })
      } catch {
        // keep the local cache; a later change retries
      }
    }

    const unsub = useStudio.subscribe((state, prev) => {
      if (loadedId.current !== id) return // ignore the hydrate + unrelated updates
      if (state.doc === prev.doc) return
      pending = true
      clearTimeout(timer)
      timer = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS)
    })

    return () => {
      unsub()
      clearTimeout(timer)
      if (pending) void flush() // don't drop an in-flight edit on unmount
    }
  }, [id])
}

/* ------------------------------ helpers ------------------------------ */

const cacheKey = (id: string) => `bloom-studio-cache-${id}`

function writeCache(id: string, doc: DesignDocument) {
  try {
    localStorage.setItem(cacheKey(id), JSON.stringify(doc))
  } catch {
    // storage full / disabled — cloud save still runs
  }
}

function readCache(id: string): DesignDocument | null {
  try {
    const raw = localStorage.getItem(cacheKey(id))
    return raw ? migrateDocument(JSON.parse(raw)) : null
  } catch {
    return null
  }
}
