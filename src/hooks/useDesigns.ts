import { useCallback, useEffect, useState } from 'react'
import { deleteDesign, listDesigns, renameDesign } from '../lib/designsApi'
import type { DesignListItem } from '../lib/types'

/**
 * Loads the signed-in user's designs (newest first) and exposes rename/delete.
 * Shared by the Recent home and the My designs page so both stay in sync with
 * the same list logic.
 */
export function useDesigns() {
  const [designs, setDesigns] = useState<DesignListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setDesigns(await listDesigns())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your designs.')
    }
  }, [])

  useEffect(() => {
    let active = true
    listDesigns()
      .then((d) => active && setDesigns(d))
      .catch((e) => active && setError(e instanceof Error ? e.message : 'Could not load your designs.'))
    return () => {
      active = false
    }
  }, [])

  const onRename = useCallback(
    async (d: DesignListItem) => {
      const name = window.prompt('Rename design', d.name)?.trim()
      if (!name || name === d.name) return
      await renameDesign(d.id, name)
      void refresh()
    },
    [refresh],
  )

  const onDelete = useCallback(async (d: DesignListItem) => {
    if (!window.confirm(`Delete “${d.name}”? This can’t be undone.`)) return
    await deleteDesign(d.id)
    setDesigns((cur) => cur?.filter((x) => x.id !== d.id) ?? null)
  }, [])

  return { designs, error, setDesigns, refresh, onRename, onDelete }
}
