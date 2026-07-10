import { useStudio } from '../domain/store'
import { FLOWER_INDEX } from '../data/catalog'
import { BAND_LABELS } from '../domain/types'

/** Screen-reader announcements for canvas state the eyes get for free. */
export function Announcer() {
  const message = useStudio((s) => {
    if (s.selectedIds.length === 0) return ''
    if (s.selectedIds.length === 1) {
      const stem = s.doc.stems.find((x) => x.id === s.selectedIds[0])
      const variety = stem && FLOWER_INDEX[stem.varietyId]
      if (!stem || !variety) return ''
      return `${variety.commonName} selected, ${BAND_LABELS[stem.band]} band, ${(stem.x / 10).toFixed(1)} by ${(stem.y / 10).toFixed(1)} centimetres`
    }
    return `${s.selectedIds.length} stems selected`
  })

  return (
    <div aria-live="polite" className="sr-only">
      {message}
    </div>
  )
}
