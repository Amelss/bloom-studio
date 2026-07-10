import { useStudio } from '../domain/store'
import { FLOWER_INDEX, getColorway } from '../data/catalog'

/** Right-click menu on a stem: select-same, cluster, duplicate, remove. */
export function ContextMenu() {
  const menu = useStudio((s) => s.contextMenu)
  const setContextMenu = useStudio((s) => s.setContextMenu)
  const stem = useStudio((s) => s.doc.stems.find((x) => x.id === s.contextMenu?.stemId))
  const selectedIds = useStudio((s) => s.selectedIds)
  const selectSame = useStudio((s) => s.selectSame)
  const groupSelected = useStudio((s) => s.groupSelected)
  const ungroupSelected = useStudio((s) => s.ungroupSelected)
  const duplicateSelected = useStudio((s) => s.duplicateSelected)
  const removeSelected = useStudio((s) => s.removeSelected)

  if (!menu || !stem) return null
  const variety = FLOWER_INDEX[stem.varietyId]
  const colorway = getColorway(stem.varietyId, stem.colorwayId)
  if (!variety) return null

  const sameVarietyCount = useStudio
    .getState()
    .doc.stems.filter((s) => s.varietyId === stem.varietyId).length
  const sameColorwayCount = useStudio
    .getState()
    .doc.stems.filter((s) => s.varietyId === stem.varietyId && s.colorwayId === stem.colorwayId).length

  const close = () => setContextMenu(null)
  const item = (label: string, action: () => void, danger = false) => (
    <button
      className={`block w-full rounded px-2.5 py-1.5 text-left text-xs hover:bg-bloom-100 ${
        danger ? 'text-red-800' : ''
      }`}
      onClick={() => {
        action()
        close()
      }}
    >
      {label}
    </button>
  )

  return (
    <>
      <div className="fixed inset-0 z-40" aria-hidden onPointerDown={close} onContextMenu={(e) => e.preventDefault()} />
      <div
        role="menu"
        aria-label={`${variety.commonName} actions`}
        className="fixed z-50 w-60 rounded-lg border border-bloom-200 bg-white p-1 shadow-lg"
        style={{
          left: Math.min(menu.x, window.innerWidth - 250),
          top: Math.min(menu.y, window.innerHeight - 220),
        }}
      >
        {item(`Select all ${variety.commonName} (${sameVarietyCount})`, () => selectSame(stem.varietyId))}
        {colorway &&
          item(`Select all ${variety.commonName} · ${colorway.name} (${sameColorwayCount})`, () =>
            selectSame(stem.varietyId, stem.colorwayId),
          )}
        <div className="my-1 border-t border-bloom-100" />
        {selectedIds.length >= 2 && !stem.clusterId && item('Cluster selection  ⌘G', groupSelected)}
        {stem.clusterId && item('Uncluster  ⇧⌘G', ungroupSelected)}
        {item('Duplicate  D', duplicateSelected)}
        {item('Remove  ⌫', removeSelected, true)}
      </div>
    </>
  )
}
