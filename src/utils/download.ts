export function downloadFile(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  downloadUrl(filename, url)
  URL.revokeObjectURL(url)
}

export function downloadUrl(filename: string, url: string) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = sanitizeFilename(filename)
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '-')
}
