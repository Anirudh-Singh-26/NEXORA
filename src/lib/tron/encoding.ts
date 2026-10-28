/** Small, dependency-free helpers for TRON base58check addresses. Pure and synchronous (no Web Crypto needed). */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n))

export function sha256(data: Uint8Array): Uint8Array {
  const length = data.length
  const padded = new Uint8Array(((length + 9 + 63) >> 6) << 6)
  padded.set(data)
  padded[length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(padded.length - 8, Math.floor((length * 8) / 0x100000000))
  view.setUint32(padded.length - 4, (length * 8) >>> 0)
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19])
  const w = new Uint32Array(64)
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4)
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, hh] = h
    for (let i = 0; i < 64; i += 1) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh
  }
  const out = new Uint8Array(32)
  const outView = new DataView(out.buffer)
  h.forEach((value, i) => outView.setUint32(i * 4, value))
  return out
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) return null
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function base58Encode(bytes: Uint8Array): string {
  let value = 0n
  for (const byte of bytes) value = value * 256n + BigInt(byte)
  let out = ''
  while (value > 0n) { out = ALPHABET[Number(value % 58n)] + out; value /= 58n }
  for (const byte of bytes) { if (byte !== 0) break; out = '1' + out }
  return out
}

function base58Decode(text: string): Uint8Array | null {
  let value = 0n
  for (const char of text) {
    const digit = ALPHABET.indexOf(char)
    if (digit < 0) return null
    value = value * 58n + BigInt(digit)
  }
  const bytes: number[] = []
  while (value > 0n) { bytes.unshift(Number(value % 256n)); value /= 256n }
  let zeros = 0
  for (const char of text) { if (char !== '1') break; zeros += 1 }
  return new Uint8Array([...new Array<number>(zeros).fill(0), ...bytes])
}

/** The 21-byte account payload (0x41 prefix + 20 bytes) of a valid base58check TRON address, else null. Verifies the checksum. */
export function decodeTronAddress(address: string): Uint8Array | null {
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) return null
  const raw = base58Decode(address)
  if (!raw || raw.length !== 25) return null
  const payload = raw.slice(0, 21)
  if (payload[0] !== 0x41) return null
  const check = sha256(sha256(payload)).slice(0, 4)
  for (let i = 0; i < 4; i += 1) if (raw[21 + i] !== check[i]) return null
  return payload
}

export function encodeTronAddress(payload: Uint8Array): string {
  if (payload.length !== 21 || payload[0] !== 0x41) throw new RangeError('A TRON account payload is 21 bytes starting with 0x41')
  const check = sha256(sha256(payload)).slice(0, 4)
  return base58Encode(new Uint8Array([...payload, ...check]))
}

export function isValidTronAddress(address: string): boolean {
  return decodeTronAddress(address) !== null
}
