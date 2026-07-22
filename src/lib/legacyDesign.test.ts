import { afterEach, describe, expect, it } from 'vitest'
import { starterTemplate } from '../domain/templates'
import { clearLegacyDesign, readLegacyDesign } from './legacyDesign'

const KEY = 'bloom-studio-design-v1'

afterEach(() => localStorage.clear())

describe('legacy on-device design migration', () => {
  it('reads and migrates a saved on-device design', () => {
    const doc = starterTemplate()
    localStorage.setItem(KEY, JSON.stringify({ state: { doc }, version: 3 }))
    const result = readLegacyDesign()
    expect(result).not.toBeNull()
    expect(result!.stems.length).toBe(doc.stems.length)
  })

  it('returns null when there is no legacy entry', () => {
    expect(readLegacyDesign()).toBeNull()
  })

  it('returns null when the legacy design is empty (nothing to migrate)', () => {
    const doc = { ...starterTemplate(), stems: [] }
    localStorage.setItem(KEY, JSON.stringify({ state: { doc }, version: 3 }))
    expect(readLegacyDesign()).toBeNull()
  })

  it('clears the legacy key', () => {
    localStorage.setItem(KEY, 'anything')
    clearLegacyDesign()
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})
