import { generateId } from './geometry'
import { seedImage } from './renderer'
import type { Element } from '../types'

export interface ImagePlacement {
  offsetX: number
  offsetY: number
  zoom: number
  viewW: number
  viewH: number
  anchorX?: number
  anchorY?: number
}

const IMAGE_NAME = /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif|heic|heif)$/i

export function isImageFile(file: File | null | undefined): file is File {
  if (!file) return false
  if (file.type.startsWith('image/')) return true
  return IMAGE_NAME.test(file.name)
}

export function extractImageUrlsFromHtml(html: string): string[] {
  const urls: string[] = []
  const re = /<img\b[^>]*\bsrc=["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const src = m[1]
    if (src.startsWith('data:image/') || src.startsWith('blob:') || /^https?:/i.test(src)) {
      urls.push(src)
    }
  }
  return urls
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image decode failed'))
    img.src = src
  })
}

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string' && result) resolve(result)
      else reject(new Error('empty data url'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

function placeImage(
  dataUrl: string,
  img: HTMLImageElement,
  placement: ImagePlacement,
): Element {
  try {
    seedImage(dataUrl, img)
  } catch {

  }
  const w0 = Math.max(1, img.naturalWidth || img.width)
  const h0 = Math.max(1, img.naturalHeight || img.height)
  const scale = Math.min(400 / w0, 400 / h0, 1)
  const w = Math.max(1, w0 * scale)
  const h = Math.max(1, h0 * scale)
  const zoom = placement.zoom || 1
  const cx =
    placement.anchorX ??
    (placement.viewW / 2 - placement.offsetX) / zoom
  const cy =
    placement.anchorY ??
    (placement.viewH / 2 - placement.offsetY) / zoom
  return {
    id: generateId(),
    type: 'image',
    x: cx - w / 2,
    y: cy - h / 2,
    width: w,
    height: h,
    angle: 0,
    strokeColor: 'transparent',
    backgroundColor: 'transparent',
    strokeWidth: 0,
    strokeStyle: 'solid',
    roughness: 0,
    bowing: 0,
    opacity: 100,
    imageData: dataUrl,
  }
}

export async function fileToImageElement(
  file: File,
  placement: ImagePlacement,
): Promise<Element | null> {
  try {
    const dataUrl = await fileToDataUrl(file)
    const img = await loadHtmlImage(dataUrl)
    if ((img.naturalWidth || img.width) < 1) return null
    return placeImage(dataUrl, img, placement)
  } catch {
    return null
  }
}

export async function srcToImageElement(
  src: string,
  placement: ImagePlacement,
): Promise<Element | null> {
  try {
    if (src.startsWith('data:image/')) {
      const img = await loadHtmlImage(src)
      if ((img.naturalWidth || img.width) < 1) return null
      return placeImage(src, img, placement)
    }
    const res = await fetch(src)
    const blob = await res.blob()
    if (!blob.type.startsWith('image/') && !src.match(IMAGE_NAME)) return null
    const file = new File([blob], 'pasted-image', { type: blob.type || 'image/png' })
    return fileToImageElement(file, placement)
  } catch {
    return null
  }
}
