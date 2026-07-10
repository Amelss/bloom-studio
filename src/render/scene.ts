import { Application, Container, Graphics, RenderTexture, Sprite } from 'pixi.js'
import {
  depthValue,
  type Artboard,
  type DesignDocument,
  type PaperOption,
} from '../domain/types'
import {
  BINDING_ANCHOR,
  spriteSize,
  stemBounds,
  vesselRect,
} from '../domain/geometry'
import { FLOWER_INDEX, VESSEL_INDEX } from '../data/catalog'
import { Camera } from './camera'
import { gridSteps } from './grid'
import {
  getStemTexture,
  getVesselTexture,
  hitTestAlpha,
  setOnTextureReady,
  type StemTextureEntry,
} from './textures'

const PAPER_COLORS: Record<PaperOption, number> = {
  white: 0xffffff,
  ivory: 0xf7f2e7,
  blush: 0xf6ebe9,
  charcoal: 0x34322f,
}

export interface ScenePrefs {
  showFormGuide: boolean
  learningMode: boolean
  gridVisible: boolean
  gridStepMm: number
}

/**
 * Owns the Pixi scene graph and renders on demand (no ticker): frames happen
 * only when the document, selection, camera, or a texture arrival makes them
 * necessary. The scene reads the design document and never writes it.
 */
export class SceneManager {
  readonly camera = new Camera()

  private readonly app: Application
  private readonly world = new Container()
  private readonly artboardG = new Graphics()
  private readonly gridG = new Graphics()
  private readonly vesselBehind = new Container()
  private readonly stems = new Container()
  private readonly vesselFront = new Container()
  private readonly overlayG = new Graphics()
  private readonly selectionG = new Graphics()

  private readonly sprites = new Map<string, Sprite>()
  private readonly hitEntries = new Map<string, StemTextureEntry>()

  private doc: DesignDocument | null = null
  private selectedId: string | null = null
  private prefs: ScenePrefs = {
    showFormGuide: false,
    learningMode: true,
    gridVisible: false,
    gridStepMm: 10,
  }

  private renderQueued = false
  private destroyed = false

  constructor(app: Application) {
    this.app = app
    this.stems.sortableChildren = true
    this.world.addChild(
      this.artboardG,
      this.gridG,
      this.vesselBehind,
      this.stems,
      this.vesselFront,
      this.overlayG,
      this.selectionG,
    )
    app.stage.addChild(this.world)
    app.stage.eventMode = 'none'

    this.camera.onChange = () => {
      this.drawZoomDependent()
      this.requestRender()
    }
    setOnTextureReady(() => {
      if (this.destroyed) return
      if (this.doc) this.sync(this.doc, this.selectedId, this.prefs)
    })
  }

  destroy() {
    this.destroyed = true
    setOnTextureReady(null)
  }

  get artboard(): Artboard | null {
    return this.doc?.artboards[0] ?? null
  }

  sync(doc: DesignDocument, selectedId: string | null, prefs: ScenePrefs) {
    this.doc = doc
    this.selectedId = selectedId
    this.prefs = prefs

    const artboard = doc.artboards[0]
    this.drawArtboard(artboard)
    this.syncStems(doc)
    this.syncVessel(doc, artboard)
    this.drawZoomDependent()
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
    if (!this.doc || !this.selectedId) return
    const stem = this.doc.stems.find((s) => s.id === this.selectedId)
    const variety = stem && FLOWER_INDEX[stem.varietyId]
    if (!stem || !variety) return
    this.camera.fitBounds(stemBounds(stem, variety), 160, animate)
  }

  /* ---------------------------- hit testing --------------------------- */

  /** Pixel-accurate pick: front-most stem with visible paint at the point. */
  hitTest(worldX: number, worldY: number): string | null {
    if (!this.doc) return null
    const sorted = [...this.doc.stems].sort((a, b) => depthValue(b) - depthValue(a))
    for (const stem of sorted) {
      const variety = FLOWER_INDEX[stem.varietyId]
      const entry = this.hitEntries.get(stem.id)
      if (!variety || !entry) continue
      const { width, height } = spriteSize(variety, stem.scale)
      const rad = (stem.rotation * Math.PI) / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      const dx = worldX - stem.x
      const dy = worldY - stem.y
      // Inverse-rotate into sprite-local space (origin at the binding anchor).
      let lx = dx * cos + dy * sin
      const ly = -dx * sin + dy * cos
      if (stem.flipX) lx = -lx
      const u = lx / width + BINDING_ANCHOR.x
      const v = ly / height + BINDING_ANCHOR.y
      if (hitTestAlpha(entry, u, v)) return stem.id
    }
    return null
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
      selection: this.selectionG.visible,
    }
    this.gridG.visible = false
    this.overlayG.visible = false
    this.selectionG.visible = false
    this.world.scale.set(resolution)
    this.world.position.set(-artboard.x * resolution, -artboard.y * resolution)
    this.app.renderer.render({ container: this.world, target: renderTexture })
    const canvas = this.app.renderer.extract.canvas(renderTexture)
    this.world.scale.set(prev.scale)
    this.world.position.set(prev.x, prev.y)
    this.gridG.visible = prev.grid
    this.overlayG.visible = prev.overlay
    this.selectionG.visible = prev.selection
    renderTexture.destroy(true)
    this.requestRender()
    return canvas.toDataURL?.('image/png') ?? null
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
      this.app.render()
    })
  }

  private drawArtboard(artboard: Artboard) {
    const g = this.artboardG
    g.clear()
    // Soft drop shadow, then the paper.
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
        this.stems.addChild(sprite)
      }
      const entry = getStemTexture(stem.varietyId, stem.colorwayId)
      if (entry) {
        this.hitEntries.set(stem.id, entry)
        if (sprite.texture !== entry.texture) sprite.texture = entry.texture
        sprite.visible = true
        const { width, height } = spriteSize(variety, stem.scale)
        sprite.scale.set(
          ((stem.flipX ? -1 : 1) * width) / entry.texture.width,
          height / entry.texture.height,
        )
      } else {
        sprite.visible = false
      }
      sprite.position.set(stem.x, stem.y)
      sprite.rotation = (stem.rotation * Math.PI) / 180
      sprite.zIndex = depthValue(stem)
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

  /** Grid, form guide, and selection ring depend on zoom for line weight. */
  private drawZoomDependent() {
    this.drawGrid()
    this.drawFormGuide()
    this.drawSelection()
  }

  private drawGrid() {
    const g = this.gridG
    g.clear()
    const artboard = this.artboard
    if (!artboard || !this.prefs.gridVisible) return
    const { minor, major } = gridSteps(this.camera.scale)
    const px = 1 / this.camera.scale

    for (let x = artboard.x; x <= artboard.x + artboard.width + 0.01; x += minor) {
      const isMajor = Math.round(x - artboard.x) % major === 0
      g.moveTo(x, artboard.y)
      g.lineTo(x, artboard.y + artboard.height)
      g.stroke({ color: 0x8a9a7b, alpha: isMajor ? 0.28 : 0.13, width: px })
    }
    for (let y = artboard.y; y <= artboard.y + artboard.height + 0.01; y += minor) {
      const isMajor = Math.round(y - artboard.y) % major === 0
      g.moveTo(artboard.x, y)
      g.lineTo(artboard.x + artboard.width, y)
      g.stroke({ color: 0x8a9a7b, alpha: isMajor ? 0.28 : 0.13, width: px })
    }
  }

  private drawFormGuide() {
    const g = this.overlayG
    g.clear()
    if (!this.prefs.showFormGuide || !this.prefs.learningMode) return
    const artboard = this.artboard
    if (!artboard) return
    const px = 1 / this.camera.scale
    const cx = artboard.x + artboard.width / 2
    // Round-bouquet silhouette + focal zone, dashed by hand (Pixi has no dash).
    dashedEllipse(g, cx, artboard.y + 210, 135, 85, 8, { color: 0x6f8161, alpha: 0.55, width: 1.5 * px })
    dashedEllipse(g, cx, artboard.y + 222, 48, 48, 6, { color: 0xb0715f, alpha: 0.6, width: 1.5 * px })
  }

  private drawSelection() {
    const g = this.selectionG
    g.clear()
    if (!this.doc || !this.selectedId) return
    const stem = this.doc.stems.find((s) => s.id === this.selectedId)
    const variety = stem && FLOWER_INDEX[stem.varietyId]
    if (!stem || !variety) return

    const { width, height } = spriteSize(variety, stem.scale)
    const rad = (stem.rotation * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const px = 1 / this.camera.scale

    // Rotated sprite corners around the binding anchor.
    const local = [
      { x: -width / 2, y: -BINDING_ANCHOR.y * height },
      { x: width / 2, y: -BINDING_ANCHOR.y * height },
      { x: width / 2, y: (1 - BINDING_ANCHOR.y) * height },
      { x: -width / 2, y: (1 - BINDING_ANCHOR.y) * height },
    ].map((p) => ({
      x: stem.x + p.x * cos - p.y * sin,
      y: stem.y + p.x * sin + p.y * cos,
    }))

    g.moveTo(local[0].x, local[0].y)
    for (const p of [...local.slice(1), local[0]]) g.lineTo(p.x, p.y)
    g.stroke({ color: 0x586950, alpha: 0.85, width: 1.5 * px })
    // The binding point — the rotation pivot — made visible.
    g.circle(stem.x, stem.y, 3 * px).fill({ color: 0x586950, alpha: 0.9 })
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
