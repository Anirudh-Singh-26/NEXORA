import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fetchWalletNfts, mergeNftPages, parseWalletNftsResponse, resolveNftTarget } from './wallet-nfts.ts'
import { isNftChain, openSeaAssetUrl } from './chains.ts'

const A = '0xabcdef0123456789abcdef0123456789abcdef01'
const B = '0x1111111111111111111111111111111111111111'
const C1 = '0x' + 'c1'.repeat(20)
const envelope = (over: Record<string, unknown> = {}) => ({
  chainId: 1, address: A, provider: 'alchemy', nextPageKey: null, totalCount: 1, hiddenSpam: 0,
  nfts: [{ contract: C1, tokenId: '42', tokenType: 'ERC721', name: 'Ape #42', collectionName: 'Apes', image: 'https://img.example/42.png', balance: null }], ...over,
})
const reply = (body: unknown, status = 200, type = 'application/json') => (() => Promise.resolve(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': type } }))) as typeof fetch

test('resolveNftTarget: every wallet state', () => {
  assert.deepEqual(resolveNftTarget(null, 1), { kind: 'no-wallet' })
  assert.deepEqual(resolveNftTarget('0x12', 1), { kind: 'invalid-address' })
  assert.deepEqual(resolveNftTarget(A, null), { kind: 'unknown-network' })
  assert.deepEqual(resolveNftTarget(A, 59144), { kind: 'unsupported-network', chainId: 59144 })
  assert.deepEqual(resolveNftTarget(A, 11155111), { kind: 'unsupported-network', chainId: 11155111 })
  assert.deepEqual(resolveNftTarget(A.toUpperCase().replace('0X', '0x'), 8453), { kind: 'ready', chainId: 8453, address: A })
  for (const id of [1, 10, 137, 8453, 42161]) assert.equal(resolveNftTarget(A, id).kind, 'ready', String(id))
})

test('account or chain change yields a different target (state keyed on it cannot be reused)', () => {
  assert.notDeepEqual(resolveNftTarget(A, 1), resolveNftTarget(B, 1))
  assert.notDeepEqual(resolveNftTarget(A, 1), resolveNftTarget(A, 137))
})

test('parse: valid page, empty page, drops malformed and duplicate entries, rejects non-https images', () => {
  const ok = parseWalletNftsResponse(envelope())
  assert.equal(ok.nfts.length, 1)
  assert.equal(ok.nfts[0].image, 'https://img.example/42.png')
  assert.equal(parseWalletNftsResponse(envelope({ nfts: [] })).nfts.length, 0)
  const messy = parseWalletNftsResponse(envelope({ nfts: [
    { contract: C1, tokenId: '1', image: 'http://insecure.example/a.png' },
    { contract: C1.toUpperCase().replace('0X', '0x'), tokenId: '1' },
    { contract: 'nope', tokenId: '2' }, { contract: C1, tokenId: 'abc' }, null, 'x',
    { contract: C1, tokenId: '3', name: '', collectionName: undefined },
  ] }))
  assert.deepEqual(messy.nfts.map((n) => n.tokenId), ['1', '3'])
  assert.equal(messy.nfts[0].image, null)
  assert.equal(messy.nfts[1].name, null)
  assert.throws(() => parseWalletNftsResponse({ chainId: 1 }))
  assert.throws(() => parseWalletNftsResponse(null))
})

test('fetch: success, and the request carries the requested chain and normalised address', async () => {
  let url = ''
  const impl = ((input: RequestInfo | URL) => { url = String(input); return reply(envelope())('x') }) as typeof fetch
  const result = await fetchWalletNfts(1, A.toUpperCase().replace('0X', '0x'), { fetchImpl: impl })
  assert.equal(result.status, 'ok')
  const q = new URL(url, 'http://x').searchParams
  assert.equal(q.get('chainId'), '1')
  assert.equal(q.get('address'), A)
})

test('fetch: a response for another account or chain is rejected, never attached to the current one', async () => {
  const other = await fetchWalletNfts(1, A, { fetchImpl: reply(envelope({ address: B })) })
  assert.deepEqual(other.status === 'error' && other.kind, 'malformed')
  const wrongChain = await fetchWalletNfts(1, A, { fetchImpl: reply(envelope({ chainId: 137 })) })
  assert.deepEqual(wrongChain.status === 'error' && wrongChain.kind, 'malformed')
})

test('fetch: unsupported chain/invalid address never reach the network; provider and transport failures map to kinds', async () => {
  let calls = 0
  const counting = (() => { calls += 1; return reply(envelope())('x') }) as typeof fetch
  assert.equal((await fetchWalletNfts(59144, A, { fetchImpl: counting })).status, 'error')
  assert.equal((await fetchWalletNfts(1, 'nope', { fetchImpl: counting })).status, 'error')
  assert.equal(calls, 0)
  const kind = async (f: typeof fetch) => { const r = await fetchWalletNfts(1, A, { fetchImpl: f }); return r.status === 'error' ? r.kind : 'ok' }
  assert.equal(await kind(reply({ error: { code: 'not-configured' } }, 503)), 'not-configured')
  assert.equal(await kind(reply({ error: { code: 'rate-limited' } }, 429)), 'rate-limited')
  assert.equal(await kind(reply({ error: { code: 'chain-unsupported' } }, 422)), 'chain-unsupported')
  assert.equal(await kind(reply('<html></html>', 200, 'text/html')), 'proxy-missing')
  assert.equal(await kind(reply('not json', 200)), 'malformed')
  assert.equal(await kind((() => Promise.reject(new TypeError('x'))) as typeof fetch), 'network')
})

test('mergeNftPages never duplicates an asset across pages', () => {
  const nft = (id: string) => ({ contract: C1, tokenId: id, tokenType: null, name: null, collectionName: null, image: null, balance: null })
  assert.deepEqual(mergeNftPages([nft('1'), nft('2')], [nft('2'), nft('3')]).map((n) => n.tokenId), ['1', '2', '3'])
})

test('chains: only documented NFT chains; OpenSea links use the right chain slug', () => {
  assert.equal(isNftChain(1), true)
  assert.equal(isNftChain(59144), false)
  assert.equal(isNftChain('1'), false)
  assert.equal(openSeaAssetUrl(137, C1, '5'), `https://opensea.io/assets/matic/${C1}/5`)
  assert.equal(openSeaAssetUrl(56, C1, '5'), null)
})
