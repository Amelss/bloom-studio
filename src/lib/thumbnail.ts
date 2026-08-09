import { canvasRegistry } from '../render/registry'

/**
 * A small JPEG thumbnail of the current canvas, for the dashboard gallery and
 * version snapshots. Best-effort: returns null when the canvas can't be
 * exported (e.g. it's mid-unmount), so callers must not overwrite a saved image
 * with a null result.
 */
export async function captureThumbnail(maxWidth = 400): Promise<string | null> {
  const png = await canvasRegistry.api?.exportPng()
  return png ? await downscale(png, maxWidth) : null
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
