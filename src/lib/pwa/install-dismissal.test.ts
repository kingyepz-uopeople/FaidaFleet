import assert from 'node:assert/strict'
import test from 'node:test'
import {
  INSTALL_DISMISS_STORAGE_KEY,
  isInstallDismissed,
  needsIosInstallHint,
  rememberInstallDismissal,
} from './install-dismissal'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  }
}

test('dismissal is remembered in storage and checked before showing the banner', () => {
  const storage = memoryStorage()
  assert.equal(isInstallDismissed(storage), false)
  rememberInstallDismissal(storage)
  assert.equal(storage.getItem(INSTALL_DISMISS_STORAGE_KEY), '1')
  assert.equal(isInstallDismissed(storage), true)
})

test('storage failures never break the install banner', () => {
  const broken = {
    getItem: () => { throw new Error('blocked') },
    setItem: () => { throw new Error('blocked') },
  }
  assert.equal(isInstallDismissed(broken), false)
  assert.doesNotThrow(() => rememberInstallDismissal(broken))
  assert.equal(isInstallDismissed(null), false)
  assert.doesNotThrow(() => rememberInstallDismissal(undefined))
})

test('only non-standalone iOS devices get the manual install hint', () => {
  assert.equal(needsIosInstallHint('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', false), true)
  assert.equal(needsIosInstallHint('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', true), false)
  assert.equal(needsIosInstallHint('Mozilla/5.0 (Linux; Android 14)', false), false)
  assert.equal(needsIosInstallHint('', false), false)
})
