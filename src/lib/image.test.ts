import { describe, it, expect } from 'vitest'
import { extractImageUrlsFromHtml, isImageFile } from './image'

describe('isImageFile', () => {
  it('accepts image MIME types', () => {
    expect(isImageFile(new File(['x'], 'a', { type: 'image/png' }))).toBe(true)
  })

  it('accepts empty MIME when the filename is an image', () => {
    expect(isImageFile(new File(['x'], 'Screenshot.png', { type: '' }))).toBe(true)
  })

  it('rejects non-images', () => {
    expect(isImageFile(new File(['x'], 'notes.txt', { type: 'text/plain' }))).toBe(false)
    expect(isImageFile(null)).toBe(false)
  })
})

describe('extractImageUrlsFromHtml', () => {
  it('picks data and http image srcs', () => {
    const html =
      '<meta /><img src="data:image/png;base64,abc"><img src="https://ex.com/a.png"><img src="javascript:alert(1)">'
    expect(extractImageUrlsFromHtml(html)).toEqual([
      'data:image/png;base64,abc',
      'https://ex.com/a.png',
    ])
  })
})
