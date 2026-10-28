import assert from 'node:assert/strict'
import test from 'node:test'
import { describeTonConnectError } from './errors.ts'
import { checkTonManifest, resolveTonManifestUrl } from './manifest.ts'
import { pickTonWalletName } from './wallet-info.ts'

const ORIGIN = 'https://app.example.org'
const good = { url: ORIGIN, name: 'NEXORA', iconUrl: `${ORIGIN}/icon-180.png` }

test('checkTonManifest accepts a complete manifest and flags an origin mismatch', () => {
  assert.deepEqual(checkTonManifest(good, ORIGIN), { status: 'ok', originMismatch: false })
  assert.deepEqual(checkTonManifest({ ...good, url: 'https://other.example.org' }, ORIGIN), { status: 'ok', originMismatch: true })
})

test('checkTonManifest detects the shipped .invalid placeholder', () => {
  const placeholder = { url: 'https://replace-with-public-https-origin.invalid', name: 'NEXORA', iconUrl: 'https://replace-with-public-https-origin.invalid/nexora-icon-180.png' }
  assert.deepEqual(checkTonManifest(placeholder, ORIGIN), { status: 'placeholder' })
  assert.deepEqual(checkTonManifest({ ...good, iconUrl: 'https://x.invalid/i.png' }, ORIGIN), { status: 'placeholder' })
})

test('checkTonManifest reports invalid content', () => {
  for (const value of [null, [], 'x', 5]) assert.equal(checkTonManifest(value, ORIGIN).status, 'invalid')
  const missing = checkTonManifest({}, ORIGIN)
  assert.equal(missing.status, 'invalid')
  if (missing.status === 'invalid') assert.equal(missing.problems.length, 3)
  const svg = checkTonManifest({ ...good, iconUrl: `${ORIGIN}/icon.svg` }, ORIGIN)
  assert.equal(svg.status, 'invalid')
  assert.equal(checkTonManifest({ ...good, url: 'javascript:alert(1)' }, ORIGIN).status, 'invalid')
})

test('resolveTonManifestUrl defaults to the origin and validates overrides', () => {
  assert.deepEqual(resolveTonManifestUrl(undefined, ORIGIN), { ok: true, url: `${ORIGIN}/tonconnect-manifest.json` })
  assert.deepEqual(resolveTonManifestUrl('https://tunnel.example.org/tonconnect-manifest.json', ORIGIN), { ok: true, url: 'https://tunnel.example.org/tonconnect-manifest.json' })
  assert.equal(resolveTonManifestUrl('http://localhost:5173/tonconnect-manifest.json', ORIGIN).ok, true)
  for (const value of ['nope', 'http://example.org/m.json', 'https://u:p@example.org/m.json', 'ftp://example.org/m.json']) assert.equal(resolveTonManifestUrl(value, ORIGIN).ok, false, value)
})

test('pickTonWalletName prefers the catalogue name, then device.appName, and bounds the length', () => {
  assert.equal(pickTonWalletName({ name: ' Tonkeeper ', device: { appName: 'tonkeeper' } }), 'Tonkeeper')
  assert.equal(pickTonWalletName({ device: { appName: 'tonkeeper' } }), 'tonkeeper')
  assert.equal(pickTonWalletName({ name: 'x'.repeat(100) })?.length, 40)
  for (const value of [null, undefined, 'x', {}, { name: '', device: {} }, { name: 5, device: { appName: 7 } }]) assert.equal(pickTonWalletName(value), null)
})

test('describeTonConnectError gives short generic messages', () => {
  assert.match(describeTonConnectError(new Error('[TON_CONNECT_SDK_ERROR] User rejects the action')), /declined/)
  assert.match(describeTonConnectError(new Error('ManifestNotFoundError: Manifest not found')), /manifest/i)
  assert.match(describeTonConnectError('boom'), /wallet reported an error/)
  assert.match(describeTonConnectError(undefined), /wallet reported an error/)
})

test('public/tonconnect-manifest.json is valid and contains non-placeholder values', async () => {
  const fs = await import('node:fs')
  const raw = fs.readFileSync('public/tonconnect-manifest.json', 'utf8')
  const json = JSON.parse(raw)
  assert.equal(typeof json, 'object')
  assert.equal(json.name, 'NEXORA')
  const result = checkTonManifest(json, json.url)
  assert.deepEqual(result, { status: 'ok', originMismatch: false })
})
