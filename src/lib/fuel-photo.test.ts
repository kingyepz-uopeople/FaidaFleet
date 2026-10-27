import assert from 'node:assert/strict'
import test from 'node:test'
import { fitWithinLongEdge, fuelPumpPhotoPath } from './fuel-photo'

test('photo resizing preserves aspect ratio and caps the long edge at 1280', () => {
  assert.deepEqual(fitWithinLongEdge(4000, 2000), { width: 1280, height: 640 })
  assert.deepEqual(fitWithinLongEdge(2000, 4000), { width: 640, height: 1280 })
})

test('small photos are not enlarged', () => {
  assert.deepEqual(fitWithinLongEdge(800, 600), { width: 800, height: 600 })
})

test('photo paths are tenant and vehicle scoped JPEG object names', () => {
  assert.equal(
    fuelPumpPhotoPath('tenant-id', 'vehicle-id', 'photo-id'),
    'tenant-id/vehicle-id/photo-id.jpg',
  )
})
