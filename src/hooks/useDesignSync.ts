import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStudio } from '../domain/store'
import { migrateDocument } from '../domain/migrate'
import type { DesignDocument } from '../domain/types'
import { loadDesign, saveDesign } from '../lib/designsApi'
import { canvasRegistry } from '../render/registry'

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
        thumbnail = await makeThumbnail()
      } catch {
        // thumbnail is best-effort
      }
      try {
        await saveDesign(id, { doc, name: doc.name, thumbnail })
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

/** Small JPEG thumbnail of the current canvas for the dashboard. */
async function makeThumbnail(): Promise<string | null> {
  const png = await canvasRegistry.api?.exportPng()
  return png ? await downscale(png, 400) : null
}

function downscale(dataUrl: string, maxWidth: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(dataUrl)
      ctx.fillStyle = '#ffffff' // JPEG has no alpha
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.72))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}
