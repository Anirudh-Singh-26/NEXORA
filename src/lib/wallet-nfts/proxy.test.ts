import assert from 'node:assert/strict'
import { test } from 'node:test'
import { handleWalletNfts, parseOwnedNfts } from '../../../api/wallet-nfts.ts'

const KEY = 'test-secret-key-123'
const ADDR = '0xAbCdEf0123456789abcdef0123456789ABCDEF01'
const C1 = '0x' + 'a1'.repeat(20)
const req = (query: string, method = 'GET') => new Request(`http://localhost/api/wallet-nfts?${query}`, { method })
const good = `chainId=1&address=${ADDR}`
const owned = (over: Record<string, unknown> = {}) => ({
  contract: { address: C1, name: 'Contract Name', tokenType: 'ERC721', isSpam: false, openSeaMetadata: { collectionName: 'Cool Apes' } },
  tokenId: '42', tokenType: 'ERC721', name: 'Ape #42', image: { thumbnailUrl: 'https://cdn.example/t.png', originalUrl: 'ipfs://x' }, balance: '1', ...over,
})
const page = (ownedNfts: unknown[], extra: Record<string, unknown> = {}) => ({ ownedNfts, totalCount: ownedNfts.length, pageKey: null, ...extra })
function upstream(body: unknown, status = 200) {
  const urls: string[] = []
  const impl = ((input: RequestInfo | URL) => { urls.push(String(input)); return Promise.resolve(new Response(JSON.stringify(body), { status })) }) as typeof fetch
  return { impl, urls }
}

test('parseOwnedNfts: maps fields, prefers OpenSea collection name and thumbnail, de-duplicates, hides spam', () => {
  const r = parseOwnedNfts(page([
    owned(), owned(),
    owned({ tokenId: '0x2a' }),
    owned({ tokenId: '7', contract: { address: C1, isSpam: true } }),
    owned({ tokenId: '8', name: null, image: null, contract: { address: C1, name: 'Fallback Name' } }),
    owned({ tokenId: 'bad' }), { contract: { address: 'nope' }, tokenId: '1' }, null,
  ], { pageKey: 'abc=' }))
  assert.deepEqual(r.nfts.map((n) => n.tokenId), ['42', '8'])
  assert.equal(r.nfts[0].collectionName, 'Cool Apes')
  assert.equal(r.nfts[0].image, 'https://cdn.example/t.png')
  assert.equal(r.nfts[1].collectionName, 'Fallback Name')
  assert.equal(r.nfts[1].image, null)
  assert.equal(r.nfts[1].name, null)
  assert.equal(r.hiddenSpam, 1)
  assert.equal(r.nextPageKey, 'abc=')
})

test('parseOwnedNfts: empty ownership is valid; malformed envelope throws; bad page key is dropped; non-https image rejected', () => {
  assert.deepEqual(parseOwnedNfts(page([])).nfts, [])
  assert.throws(() => parseOwnedNfts({ nope: true }))
  assert.equal(parseOwnedNfts(page([], { pageKey: 'bad key!' })).nextPageKey, null)
  assert.equal(parseOwnedNfts(page([owned({ image: { thumbnailUrl: 'http://x/a.png', cachedUrl: 'javascript:alert(1)' } })])).nfts[0].image, null)
})

test('handler: validates method, key, chain, address and cursor before any upstream call', async () => {
  const { impl, urls } = upstream(page([]))
  const call = (r: Request, apiKey: string = KEY) => handleWalletNfts(r, { apiKey, fetchImpl: impl })
  assert.equal((await call(req(good, 'POST'))).status, 405)
  assert.equal((await call(req(good), '')).status, 503)
  assert.equal((await call(req(`chainId=56&address=${ADDR}`))).status, 400)
  assert.equal((await call(req(`chainId=59144&address=${ADDR}`))).status, 400)
  assert.equal((await call(req('chainId=1&address=nope'))).status, 400)
  assert.equal((await call(req(`${good}&pageKey=bad%20key`))).status, 400)
  assert.equal(urls.length, 0)
})

test('handler: queries Alchemy NFT v3 for the requested chain and lower-cased owner with a fixed path; key never in the body', async () => {
  const { impl, urls } = upstream(page([owned()]))
  const res = await handleWalletNfts(req(`chainId=137&address=${ADDR}&pageKey=cur_1`), { apiKey: KEY, fetchImpl: impl })
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('cache-control'), 'private, no-store')
  const url = new URL(urls[0])
  assert.equal(url.hostname, 'polygon-mainnet.g.alchemy.com')
  assert.equal(url.pathname, `/nft/v3/${KEY}/getNFTsForOwner`)
  assert.equal(url.searchParams.get('owner'), ADDR.toLowerCase())
  assert.equal(url.searchParams.get('pageKey'), 'cur_1')
  assert.equal(url.searchParams.get('pageSize'), '24')
  const text = await res.text()
  assert.ok(!text.includes(KEY))
  const body = JSON.parse(text)
  assert.equal(body.chainId, 137)
  assert.equal(body.address, ADDR.toLowerCase())
})

test('handler: provider failures map to fixed errors that never include the key or URL', async () => {
  const run = async (status: number, body: unknown) => handleWalletNfts(req(good), { apiKey: KEY, fetchImpl: upstream(body, status).impl })
  for (const [status, code] of [[429, 'rate-limited'], [401, 'provider-auth'], [500, 'upstream']] as const) {
    const res = await run(status, { message: 'x' })
    const text = await res.text()
    assert.equal(JSON.parse(text).error.code, code)
    assert.ok(!text.includes(KEY) && !text.includes('alchemy.com'))
  }
  assert.equal(JSON.parse(await (await run(400, { message: 'NFT API is not enabled for this network' })).text()).error.code, 'chain-unsupported')
  assert.equal(JSON.parse(await (await run(200, { unexpected: true })).text()).error.code, 'upstream')
  const thrown = await handleWalletNfts(req(good), { apiKey: KEY, fetchImpl: (() => Promise.reject(new TypeError(`fetch failed https://x/${KEY}`))) as typeof fetch })
  const text = await thrown.text()
  assert.equal(thrown.status, 502)
  assert.ok(!text.includes(KEY))
})
