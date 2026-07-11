import { Application, Container, Graphics, RenderTexture, Sprite } from 'pixi.js'
import {
  DEPTH_BANDS,
  bandRank,
  type Artboard,
  type DepthBand,
  type DesignDocument,
  type PaperOption,
  type PlacedStem,
} from '../domain/types'
import {
  BINDING_ANCHOR,
  spriteSize,
  stemBounds,
  vesselRect,
} from '../domain/geometry'
import { FLOWER_INDEX, VESSEL_INDEX } from '../data/catalog'
import { computeBalancePoint } from '../education/insights'
import { Camera } from './camera'
import { gridSteps } from './grid'
import { FORM_FOCAL_ZONE, formSilhouette } from './formGuide'
import type { GuideLine } from './smartGuides'
import {
  getStemTexture,
  getVesselTexture,
  hitTestAlpha,
  setOnTextureReady,
  variantForStem,
  type AssetMode,
  type StemTextureEntry,
} from './textures'

const PAPER_COLORS: Record<PaperOption, number> = {
  white: 0xffffff,
  ivory: 0xf7f2e7,
  blush: 0xf6ebe9,
  charcoal: 0x34322f,
}

const SELECTION_COLOR = 0x586950
const GUIDE_COLOR = 0xb0715f
const HANDLE_HIT_PX = 10
/** Vertical fan distance per band during depth x-ray, mm. */
const XRAY_LIFT_MM = 36
/** Parallax tilt travel per band at full deflection, mm. */
const TILT_TRAVEL_MM = 7

export interface ScenePrefs {
  showFormGuide: boolean
  learningMode: boolean
  gridVisible: boolean
  gridStepMm: number
  hiddenBands: DepthBand[]
  lockedBands: DepthBand[]
  assetMode: AssetMode
  xrayActive: boolean
  balanceVisible: boolean
}

export type HandleKind = 'rotate' | 'scale-tl' | 'scale-tr' | 'scale-bl' | 'scale-br'

interface HandleLayout {
  rect: { x: number; y: number; width: number; height: number }
  rotate: { x: number; y: number }
  corners: Record<'scale-tl' | 'scale-tr' | 'scale-bl' | 'scale-br', { x: number; y: number }>
}

export interface WorldRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Owns the Pixi scene graph and renders on demand (no ticker): frames happen
 * only when the document, selection, camera, textures, or a band animation
 * makes them necessary. Stems live in four DEPTH-BAND containers — the unit
 * of the x-ray fan and the parallax tilt. The scene reads the design
 * document and never writes it.
 */
export class SceneManager {
  readonly camera = new Camera()

  private readonly app: Application
  private readonly world = new Container()
  private readonly artboardG = new Graphics()
  private readonly gridG = new Graphics()
  private readonly vesselBehind = new Container()
  private readonly bandContainers: Record<DepthBand, Container>
  private readonly vesselFront = new Container()
  private readonly overlayG = new Graphics()
  private readonly balanceG = new Graphics()
  private readonly guidesG = new Graphics()
  private readonly marqueeG = new Graphics()
  private readonly selectionG = new Graphics()

  private readonly sprites = new Map<string, Sprite>()
  private readonly hitEntries = new Map<string, StemTextureEntry>()

  private doc: DesignDocument | null = null
  private selectedIds: string[] = []
  private prefs: ScenePrefs = {
    showFormGuide: false,
    learningMode: true,
    gridVisible: false,
    gridStepMm: 10,
    hiddenBands: [],
    lockedBands: [],
    assetMode: 'sketch',
    xrayActive: false,
    balanceVisible: false,
  }

  private guides: GuideLine[] = []
  private marquee: WorldRect | null = null
  private handleLayout: HandleLayout | null = null

  /** Pointer-driven parallax deflection, each in [-1, 1]. */
  private tilt = { x: 0, y: 0 }
  private bandOffsets: Record<DepthBand, { x: number; y: number }>

  private renderQueued = false
  private destroyed = false

  constructor(app: Application) {
    this.app = app
    this.bandContainers = Object.fromEntries(
      DEPTH_BANDS.map((band) => {
        const container = new Container()
        container.sortableChildren = true
        return [band, container]
      }),
    ) as Record<DepthBand, Container>
    this.bandOffsets = Object.fromEntries(
      DEPTH_BANDS.map((band) => [band, { x: 0, y: 0 }]),
    ) as Record<DepthBand, { x: number; y: number }>

    this.world.addChild(
      this.artboardG,
      this.gridG,
      this.vesselBehind,
      ...DEPTH_BANDS.map((band) => this.bandContainers[band]),
      this.vesselFront,
      this.overlayG,
      this.balanceG,
      this.guidesG,
      this.selectionG,
      this.marqueeG,
    )
    app.stage.addChild(this.world)
    app.stage.eventMode = 'none'

    this.camera.onChange = () => {
      this.drawZoomDependent()
      this.requestRender()
    }
    setOnTextureReady(() => {
      if (this.destroyed) return
      if (this.doc) this.sync(this.doc, this.selectedIds, this.prefs)
    })
  }

  destroy() {
    this.destroyed = true
    setOnTextureReady(null)
  }

  get artboard(): Artboard | null {
    return this.doc?.artboards[0] ?? null
  }

  sync(doc: DesignDocument, selectedIds: string[], prefs: ScenePrefs) {
    this.doc = doc
    this.selectedIds = selectedIds
    this.prefs = prefs

    const artboard = doc.artboards[0]
    this.drawArtboard(artboard)
    this.syncStems(doc)
    this.syncVessel(doc, artboard)
    this.drawZoomDependent()
    this.requestRender()
  }

  /* ------------------------- transient overlays ------------------------ */

  setGuides(guides: GuideLine[]) {
    this.guides = guides
    this.drawGuides()
    this.requestRender()
  }

  setMarquee(rect: WorldRect | null) {
    this.marquee = rect
    this.drawMarquee()
    this.requestRender()
  }

  /** Parallax deflection from the pointer, each axis in [-1, 1]. */
  setTilt(x: number, y: number) {
    this.tilt = { x, y }
    this.requestRender()
  }

  /* ------------------------------ camera ------------------------------ */

  setViewport(width: number, height: number) {
    this.camera.setViewport(width, height)
  }

  fitArtboard(animate = true) {
    const artboard = this.artboard
    if (!artboard) return
    this.camera.fitBounds(artboard, 48, animate)
  }

  fitSelection(animate = true) {
    if (!this.doc || !this.selectedIds.length) return
    const bounds = this.selectionBounds()
    if (bounds) this.camera.fitBounds(bounds, 120, animate)
  }

  /* ---------------------------- hit testing --------------------------- */

  private stemInteractive(stem: PlacedStem): boolean {
    return !this.prefs.hiddenBands.includes(stem.band) && !this.prefs.lockedBands.includes(stem.band)
  }

  /** All stems with visible paint at the point, front-most first. */
  hitTestAll(worldX: number, worldY: number): string[] {
    if (!this.doc) return []
    const hits: Array<{ id: string; depth: number }> = []
    for (const stem of this.doc.stems) {
      if (!this.stemInteractive(stem)) continue
      const variety = FLOWER_INDEX[stem.varietyId]
      const entry = this.hitEntries.get(stem.id)
      if (!variety || !entry) continue
      const { width, height } = spriteSize(variety, stem.scale)
      const rad = (stem.rotation * Math.PI) / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      const dx = worldX - stem.x
      const dy = worldY - stem.y
      let lx = dx * cos + dy * sin
      const ly = -dx * sin + dy * cos
      if (stem.flipX) lx = -lx
      const u = lx / width + BINDING_ANCHOR.x
      const v = ly / height + BINDING_ANCHOR.y
      if (hitTestAlpha(entry, u, v)) {
        hits.push({ id: stem.id, depth: bandRank(stem.band) * 1_000_000 + stem.order })
      }
    }
    return hits.sort((a, b) => b.depth - a.depth).map((h) => h.id)
  }

  hitTest(worldX: number, worldY: number): string | null {
    return this.hitTestAll(worldX, worldY)[0] ?? null
  }

  /** Which transform handle (if any) sits at this world point. */
  getHandleAt(worldX: number, worldY: number): HandleKind | null {
    const layout = this.handleLayout
    if (!layout) return null
    const threshold = HANDLE_HIT_PX / this.camera.scale
    if (Math.hypot(worldX - layout.rotate.x, worldY - layout.rotate.y) <= threshold) return 'rotate'
    for (const kind of ['scale-tl', 'scale-tr', 'scale-bl', 'scale-br'] as const) {
      const p = layout.corners[kind]
      if (Math.hypot(worldX - p.x, worldY - p.y) <= threshold) return kind
    }
    return null
  }

  /** Stems whose bounds intersect the rect (marquee), cluster-unaware. */
  stemsInRect(rect: WorldRect): string[] {
    if (!this.doc) return []
    const ids: string[] = []
    for (const stem of this.doc.stems) {
      if (!this.stemInteractive(stem)) continue
      const variety = FLOWER_INDEX[stem.varietyId]
      if (!variety) continue
      const b = stemBounds(stem, variety)
      if (
        b.x < rect.x + rect.width &&
        b.x + b.width > rect.x &&
        b.y < rect.y + rect.height &&
        b.y + b.height > rect.y
      ) {
        ids.push(stem.id)
      }
    }
    return ids
  }

  selectionBounds(): WorldRect | null {
    if (!this.doc || !this.selectedIds.length) return null
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const id of this.selectedIds) {
      const stem = this.doc.stems.find((s) => s.id === id)
      const variety = stem && FLOWER_INDEX[stem.varietyId]
      if (!stem || !variety) continue
      const b = stemBounds(stem, variety)
      minX = Math.min(minX, b.x)
      minY = Math.min(minY, b.y)
      maxX = Math.max(maxX, b.x + b.width)
      maxY = Math.max(maxY, b.y + b.height)
    }
    if (!Number.isFinite(minX)) return null
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }

  /* ------------------------------ export ------------------------------ */

  /** Renders the artboard (only) to a PNG data URL at 2 px/mm. */
  async exportPng(): Promise<string | null> {
    const artboard = this.artboard
    if (!artboard) return null
    const resolution = 2
    const renderTexture = RenderTexture.create({
      width: artboard.width * resolution,
      height: artboard.height * resolution,
    })
    const prev = {
      x: this.world.position.x,
      y: this.world.position.y,
      scale: this.world.scale.x,
      grid: this.gridG.visible,
      overlay: this.overlayG.visible,
      balance: this.balanceG.visible,
      selection: this.selectionG.visible,
      guides: this.guidesG.visible,
    }
    this.gridG.visible = false
    this.overlayG.visible = false
    this.balanceG.visible = false
    this.selectionG.visible = false
    this.guidesG.visible = false
    this.world.scale.set(resolution)
    this.world.position.set(-artboard.x * resolution, -artboard.y * resolution)
    this.app.renderer.render({ container: this.world, target: renderTexture })
    const canvas = this.app.renderer.extract.canvas(renderTexture)
    this.world.scale.set(prev.scale)
    this.world.position.set(prev.x, prev.y)
    this.gridG.visible = prev.grid
    this.overlayG.visible = prev.overlay
    this.balanceG.visible = prev.balance
    this.selectionG.visible = prev.selection
    this.guidesG.visible = prev.guides
    renderTexture.destroy(true)
    this.requestRender()
    return canvas.toDataURL?.('image/png') ?? null
  }

  /* --------------------------- benchmarking --------------------------- */

  /**
   * Renders `frames` frames synchronously while orbiting the camera over the
   * artboard — the pan/zoom worst case. Returns frame-time stats (ms).
   */
  runBenchmark(frames = 240): { avgMs: number; maxMs: number; stems: number } {
    const artboard = this.artboard
    const start = { x: this.camera.x, y: this.camera.y, scale: this.camera.scale }
    let total = 0
    let max = 0
    for (let i = 0; i < frames; i++) {
      const t = i / frames
      const angle = t * Math.PI * 4
      if (artboard) {
        this.camera.set(
          artboard.x + artboard.width / 2 + Math.cos(angle) * 120,
          artboard.y + artboard.height / 2 + Math.sin(angle) * 80,
          1 + Math.sin(t * Math.PI * 2) * 0.8,
        )
      }
      const transform = this.camera.transform()
      this.world.scale.set(transform.scale)
      this.world.position.set(transform.tx, transform.ty)
      const t0 = performance.now()
      this.app.render()
      const dt = performance.now() - t0
      total += dt
      max = Math.max(max, dt)
    }
    this.camera.set(start.x, start.y, start.scale)
    return {
      avgMs: Math.round((total / frames) * 100) / 100,
      maxMs: Math.round(max * 100) / 100,
      stems: this.doc?.stems.length ?? 0,
    }
  }

  /* ---------------------------- rendering ----------------------------- */

  requestRender() {
    if (this.renderQueued || this.destroyed) return
    this.renderQueued = true
    requestAnimationFrame(() => {
      this.renderQueued = false
      if (this.destroyed) return
      const t = this.camera.transform()
      this.world.scale.set(t.scale)
      this.world.position.set(t.tx, t.ty)
      const settling = this.updateBandOffsets()
      this.app.render()
      if (settling) this.requestRender()
    })
  }

  /** Eases band containers toward their x-ray/tilt targets. Returns true while moving. */
  private updateBandOffsets(): boolean {
    let moving = false
    for (const band of DEPTH_BANDS) {
      const rank = bandRank(band)
      const targetY =
        (this.prefs.xrayActive ? -rank * XRAY_LIFT_MM : 0) +
        this.tilt.y * (rank - 1.5) * TILT_TRAVEL_MM
      const targetX = this.tilt.x * (rank - 1.5) * TILT_TRAVEL_MM
      const offset = this.bandOffsets[band]
      offset.x += (targetX - offset.x) * 0.25
      offset.y += (targetY - offset.y) * 0.25
      if (Math.abs(targetX - offset.x) > 0.05 || Math.abs(targetY - offset.y) > 0.05) {
        moving = true
      } else {
        offset.x = targetX
        offset.y = targetY
      }
      this.bandContainers[band].position.set(offset.x, offset.y)
      this.bandContainers[band].alpha = this.prefs.xrayActive && rank === 0 ? 0.9 : 1
    }
    return moving
  }

  private drawArtboard(artboard: Artboard) {
    const g = this.artboardG
    g.clear()
    g.rect(artboard.x + 3, artboard.y + 5, artboard.width, artboard.height).fill({
      color: 0x000000,
      alpha: 0.08,
    })
    g.rect(artboard.x, artboard.y, artboard.width, artboard.height).fill(
      PAPER_COLORS[artboard.paper] ?? PAPER_COLORS.white,
    )
    g.rect(artboard.x, artboard.y, artboard.width, artboard.height).stroke({
      color: 0xd8d4cb,
      width: 1,
      pixelLine: true,
    })
  }

  private syncStems(doc: DesignDocument) {
    const seen = new Set<string>()
    for (const stem of doc.stems) {
      const variety = FLOWER_INDEX[stem.varietyId]
      if (!variety) continue
      seen.add(stem.id)
      let sprite = this.sprites.get(stem.id)
      if (!sprite) {
        sprite = new Sprite()
        sprite.anchor.set(BINDING_ANCHOR.x, BINDING_ANCHOR.y)
        this.sprites.set(stem.id, sprite)
        this.bandContainers[stem.band].addChild(sprite)
      } else if (sprite.parent !== this.bandContainers[stem.band]) {
        this.bandContainers[stem.band].addChild(sprite)
      }
      const entry = getStemTexture(
        stem.varietyId,
        stem.colorwayId,
        variantForStem(stem.id),
        this.prefs.assetMode,
      )
      const hidden = this.prefs.hiddenBands.includes(stem.band)
      if (entry) {
        this.hitEntries.set(stem.id, entry)
        if (sprite.texture !== entry.texture) sprite.texture = entry.texture
        sprite.visible = !hidden
        const { width, height } = spriteSize(variety, stem.scale)
        sprite.scale.set(
          ((stem.flipX ? -1 : 1) * width) / entry.texture.width,
          height / entry.texture.height,
        )
      } else {
        sprite.visible = false
      }
      sprite.alpha = this.prefs.lockedBands.includes(stem.band) ? 0.55 : 1
      sprite.position.set(stem.x, stem.y)
      sprite.rotation = (stem.rotation * Math.PI) / 180
      sprite.zIndex = stem.order
    }
    for (const [id, sprite] of this.sprites) {
      if (!seen.has(id)) {
        sprite.destroy()
        this.sprites.delete(id)
        this.hitEntries.delete(id)
      }
    }
  }

  private syncVessel(doc: DesignDocument, artboard: Artboard) {
    this.vesselBehind.removeChildren()
    this.vesselFront.removeChildren()
    const vessel = doc.vesselId ? VESSEL_INDEX[doc.vesselId] : null
    if (!vessel) return
    const texture = getVesselTexture(vessel.sketch)
    if (!texture) return
    const rect = vesselRect(vessel, artboard)
    const sprite = new Sprite(texture)
    sprite.position.set(rect.x, rect.y)
    sprite.width = rect.width
    sprite.height = rect.height
    ;(vessel.renderMode === 'front' ? this.vesselFront : this.vesselBehind).addChild(sprite)
  }

  /** Grid, guides, balance, and selection depend on zoom for line weight. */
  private drawZoomDependent() {
    this.drawGrid()
    this.drawFormGuide()
    this.drawBalance()
    this.drawGuides()
    this.drawMarquee()
    this.drawSelection()
  }

  private drawGrid() {
    const g = this.gridG
    g.clear()
    const artboard = this.artboard
    if (!artboard || !this.prefs.gridVisible) return
    const { minor, major } = gridSteps(this.camera.scale)
    const px = 1 / this.camera.scale
    const onDark = artboard.paper === 'charcoal'
    const color = onDark ? 0xd8d4cb : 0x8a9a7b

    for (let x = artboard.x; x <= artboard.x + artboard.width + 0.01; x += minor) {
      const isMajor = Math.round(x - artboard.x) % major === 0
      g.moveTo(x, artboard.y)
      g.lineTo(x, artboard.y + artboard.height)
      g.stroke({ color, alpha: isMajor ? 0.28 : 0.13, width: px })
    }
    for (let y = artboard.y; y <= artboard.y + artboard.height + 0.01; y += minor) {
      const isMajor = Math.round(y - artboard.y) % major === 0
      g.moveTo(artboard.x, y)
      g.lineTo(artboard.x + artboard.width, y)
      g.stroke({ color, alpha: isMajor ? 0.28 : 0.13, width: px })
    }
  }

  private drawFormGuide() {
    const g = this.overlayG
    g.clear()
    if (!this.prefs.showFormGuide || !this.prefs.learningMode) return
    const artboard = this.artboard
    if (!artboard) return
    const px = 1 / this.camera.scale
    const ellipse = formSilhouette(artboard)
    dashedEllipse(g, ellipse.cx, ellipse.cy, ellipse.rx, ellipse.ry, 8, {
      color: 0x6f8161,
      alpha: 0.55,
      width: 1.5 * px,
    })
    dashedEllipse(g, ellipse.cx, artboard.y + FORM_FOCAL_ZONE.cy, FORM_FOCAL_ZONE.r, FORM_FOCAL_ZONE.r, 6, {
      color: GUIDE_COLOR,
      alpha: 0.6,
      width: 1.5 * px,
    })
  }

  /**
   * The balance overlay: the design's centre of visual weight, drawn ON the
   * design — watch it move as you drag a rose. Colour reads the verdict:
   * sage = resolved, amber = asymmetric, clay = leaning.
   */
  private drawBalance() {
    const g = this.balanceG
    g.clear()
    if (!this.prefs.balanceVisible || !this.prefs.learningMode || !this.doc) return
    const artboard = this.artboard
    if (!artboard) return
    const balance = computeBalancePoint(this.doc)
    if (!balance) return

    const px = 1 / this.camera.scale
    const cx = artboard.x + artboard.width / 2
    const abs = Math.abs(balance.lean)
    const color = abs <= 0.12 ? 0x6f8161 : abs <= 0.3 ? 0xc19a3f : 0xb0715f

    // Central axis (dashed), plumb line to the balance point, the marker.
    for (let y = artboard.y + 8; y < artboard.y + artboard.height - 8; y += 14) {
      g.moveTo(cx, y)
      g.lineTo(cx, y + 7)
      g.stroke({ color: 0x8a8378, alpha: 0.5, width: px })
    }
    g.moveTo(cx, balance.y)
    g.lineTo(balance.x, balance.y)
    g.stroke({ color, alpha: 0.9, width: 1.5 * px })

    const r = 7 * px
    g.circle(balance.x, balance.y, r).fill({ color: 0xffffff, alpha: 0.85 }).stroke({ color, width: 2 * px })
    g.moveTo(balance.x - r * 0.55, balance.y)
    g.lineTo(balance.x + r * 0.55, balance.y)
    g.moveTo(balance.x, balance.y - r * 0.55)
    g.lineTo(balance.x, balance.y + r * 0.55)
    g.stroke({ color, width: px })
  }

  private drawGuides() {
    const g = this.guidesG
    g.clear()
    const artboard = this.artboard
    if (!artboard || !this.guides.length) return
    const px = 1 / this.camera.scale
    for (const guide of this.guides) {
      if (guide.axis === 'v') {
        g.moveTo(guide.position, artboard.y - 20)
        g.lineTo(guide.position, artboard.y + artboard.height + 20)
      } else {
        g.moveTo(artboard.x - 20, guide.position)
        g.lineTo(artboard.x + artboard.width + 20, guide.position)
      }
      g.stroke({ color: GUIDE_COLOR, alpha: 0.9, width: px })
    }
  }

  private drawMarquee() {
    const g = this.marqueeG
    g.clear()
    if (!this.marquee) return
    const px = 1 / this.camera.scale
    g.rect(this.marquee.x, this.marquee.y, this.marquee.width, this.marquee.height)
      .fill({ color: SELECTION_COLOR, alpha: 0.07 })
      .stroke({ color: SELECTION_COLOR, alpha: 0.7, width: px })
  }

  private drawSelection() {
    const g = this.selectionG
    g.clear()
    this.handleLayout = null
    if (!this.doc || !this.selectedIds.length) return
    const px = 1 / this.camera.scale

    for (const id of this.selectedIds) {
      const stem = this.doc.stems.find((s) => s.id === id)
      const variety = stem && FLOWER_INDEX[stem.varietyId]
      if (!stem || !variety) continue
      const { width, height } = spriteSize(variety, stem.scale)
      const rad = (stem.rotation * Math.PI) / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      const corners = [
        { x: -width / 2, y: -BINDING_ANCHOR.y * height },
        { x: width / 2, y: -BINDING_ANCHOR.y * height },
        { x: width / 2, y: (1 - BINDING_ANCHOR.y) * height },
        { x: -width / 2, y: (1 - BINDING_ANCHOR.y) * height },
      ].map((p) => ({
        x: stem.x + p.x * cos - p.y * sin,
        y: stem.y + p.x * sin + p.y * cos,
      }))
      g.moveTo(corners[0].x, corners[0].y)
      for (const p of [...corners.slice(1), corners[0]]) g.lineTo(p.x, p.y)
      g.stroke({ color: SELECTION_COLOR, alpha: this.selectedIds.length > 1 ? 0.4 : 0.85, width: 1.5 * px })
      g.circle(stem.x, stem.y, 3 * px).fill({ color: SELECTION_COLOR, alpha: 0.9 })
    }

    const bounds = this.selectionBounds()
    if (!bounds) return
    g.rect(bounds.x, bounds.y, bounds.width, bounds.height).stroke({
      color: SELECTION_COLOR,
      alpha: 0.55,
      width: px,
    })

    const rotate = { x: bounds.x + bounds.width / 2, y: bounds.y - 26 * px }
    const corners = {
      'scale-tl': { x: bounds.x, y: bounds.y },
      'scale-tr': { x: bounds.x + bounds.width, y: bounds.y },
      'scale-bl': { x: bounds.x, y: bounds.y + bounds.height },
      'scale-br': { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    }
    this.handleLayout = { rect: bounds, rotate, corners }

    g.moveTo(bounds.x + bounds.width / 2, bounds.y)
    g.lineTo(rotate.x, rotate.y)
    g.stroke({ color: SELECTION_COLOR, alpha: 0.55, width: px })
    g.circle(rotate.x, rotate.y, 5 * px).fill(0xffffff).stroke({ color: SELECTION_COLOR, width: 1.5 * px })
    for (const p of Object.values(corners)) {
      const r = 4.5 * px
      g.rect(p.x - r, p.y - r, r * 2, r * 2).fill(0xffffff).stroke({ color: SELECTION_COLOR, width: 1.5 * px })
    }
  }
}

function dashedEllipse(
  g: Graphics,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  dashDeg: number,
  stroke: { color: number; alpha: number; width: number },
) {
  for (let a = 0; a < 360; a += dashDeg * 2) {
    const from = (a * Math.PI) / 180
    const to = ((a + dashDeg) * Math.PI) / 180
    g.moveTo(cx + rx * Math.cos(from), cy + ry * Math.sin(from))
    for (let t = from; t <= to; t += 0.05) {
      g.lineTo(cx + rx * Math.cos(t), cy + ry * Math.sin(t))
    }
    g.stroke(stroke)
  }
}
