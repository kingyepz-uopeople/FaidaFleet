const MAX_LONG_EDGE = 1280
const TARGET_BYTES = 200 * 1024

export function fitWithinLongEdge(
  width: number,
  height: number,
  maxLongEdge = MAX_LONG_EDGE,
): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('The photo has invalid dimensions')
  }
  const scale = Math.min(1, maxLongEdge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export function fuelPumpPhotoPath(
  tenantId: string,
  vehicleId: string,
  photoId = crypto.randomUUID(),
): string {
  return `${tenantId}/${vehicleId}/${photoId}.jpg`
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Could not compress the photo')),
      'image/jpeg',
      quality,
    )
  })
}

async function decodeImage(file: Blob): Promise<{
  source: CanvasImageSource
  width: number
  height: number
  close: () => void
}> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    }
  }

  // Safari versions without createImageBitmap still support canvas compression.
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => undefined,
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Convert a camera image to a private-storage-friendly JPEG. Compression starts
 * at 1280px / quality 0.7 and only reduces quality or dimensions further when
 * needed to approach the 200KB mobile-upload target.
 */
export async function compressPumpPhoto(file: File): Promise<Blob> {
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('Choose an image of the pump')
  }

  const image = await decodeImage(file)
  try {
    let { width, height } = fitWithinLongEdge(image.width, image.height)
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Photo compression is not supported by this browser')

    let smallest: Blob | null = null
    for (let attempt = 0; attempt < 6; attempt += 1) {
      canvas.width = width
      canvas.height = height
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, width, height)
      context.drawImage(image.source, 0, 0, width, height)

      const quality = attempt === 0 ? 0.7 : Math.max(0.4, 0.7 - attempt * 0.075)
      const jpeg = await canvasToJpeg(canvas, quality)
      if (!smallest || jpeg.size < smallest.size) smallest = jpeg
      if (jpeg.size <= TARGET_BYTES) return jpeg

      if (attempt >= 2) {
        const reduced = fitWithinLongEdge(width * 0.85, height * 0.85)
        width = reduced.width
        height = reduced.height
      }
    }

    if (!smallest) throw new Error('Could not compress the photo')
    return smallest
  } catch {
    throw new Error('Could not prepare the photo. Try taking it again.')
  } finally {
    image.close()
  }
}
