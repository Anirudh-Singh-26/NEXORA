import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { handleCollections } from './api/collections.ts'
import { handleCollection } from './api/collection.ts'
import { handleCollectionItems } from './api/collection-items.ts'
import { handleCollectionActivity } from './api/collection-activity.ts'
import { handleWalletTokens } from './api/wallet-tokens.ts'
import { handleSolanaBalance } from './api/solana-balance.ts'
import { handleWalletNfts } from './api/wallet-nfts.ts'
import { handleWalletActivity } from './api/wallet-activity.ts'
import { handleSolanaActivity } from './api/solana-activity.ts'
import { handleSolanaTransfer } from './api/solana-transfer.ts'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

/**
 * Dev-only: serves the same handler as the Vercel function (api/collections.ts) at /api/collections so
 * `npm run dev` works without `vercel dev`. OPENSEA_API_KEY is read from .env.local (no VITE_ prefix, so it is
 * never exposed to browser code) and used only inside this Node process.
 */
function collectionsApi(apiKey: string | undefined): Plugin {
  return {
    name: 'nexora-collections-api',
    configureServer(server) {
      server.middlewares.use('/api/collections', (req, res) => {
        void handleCollections(new Request(`http://localhost/api/collections`, { method: req.method }), { apiKey }).then(async (response) => {
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(await response.text())
        })
      })
      // Single-collection details: /api/collection?slug=<opensea-slug> (same server-side key handling).
      server.middlewares.use('/api/collection', (req, res) => {
        void handleCollection(new Request(`http://localhost/api/collection${req.url ?? ''}`, { method: req.method }), { apiKey }).then(async (response) => {
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(await response.text())
        })
      })
      // Item pages and activity feeds for the collection detail page (same server-side key handling).
      for (const [route, handler] of [['/api/collection-items', handleCollectionItems], ['/api/collection-activity', handleCollectionActivity]] as const) {
        server.middlewares.use(route, (req, res) => {
          void handler(new Request(`http://localhost${route}${req.url ?? ''}`, { method: req.method }), { apiKey }).then(async (response) => {
            res.statusCode = response.status
            response.headers.forEach((value, key) => res.setHeader(key, value))
            res.end(await response.text())
          })
        })
      }
    },
  }
}

/**
 * Dev-only: serves the same handler as the Vercel function (api/wallet-tokens.ts) at /api/wallet-tokens.
 * ALCHEMY_API_KEY is read from .env.local (no VITE_ prefix, so it is never exposed to browser code).
 */
function walletTokensApi(apiKey: string | undefined): Plugin {
  return {
    name: 'nexora-wallet-tokens-api',
    configureServer(server) {
      server.middlewares.use('/api/wallet-tokens', (req, res) => {
        void handleWalletTokens(new Request(`http://localhost/api/wallet-tokens${req.url ?? ''}`, { method: req.method }), { apiKey })
          .then(async (response) => {
            res.statusCode = response.status
            response.headers.forEach((value, key) => res.setHeader(key, value))
            res.end(await response.text())
          })
          .catch(() => { res.statusCode = 500; res.setHeader('content-type', 'application/json'); res.end('{"error":{"code":"upstream","message":"Unexpected server error."}}') })
      })
    },
  }
}

/**
 * Dev-only: serves the same handler as the Vercel function (api/solana-balance.ts) at /api/solana-balance.
 * Reuses ALCHEMY_API_KEY (server-only, no VITE_ prefix).
 */
function solanaBalanceApi(apiKey: string | undefined): Plugin {
  return {
    name: 'nexora-solana-balance-api',
    configureServer(server) {
      server.middlewares.use('/api/solana-balance', (req, res) => {
        void handleSolanaBalance(new Request(`http://localhost/api/solana-balance${req.url ?? ''}`, { method: req.method }), { apiKey })
          .then(async (response) => {
            res.statusCode = response.status
            response.headers.forEach((value, key) => res.setHeader(key, value))
            res.end(await response.text())
          })
          .catch(() => { res.statusCode = 500; res.setHeader('content-type', 'application/json'); res.end('{"error":{"code":"upstream","message":"Unexpected server error."}}') })
      })
    },
  }
}

/**
 * Dev-only: serves the same handler as the Vercel function (api/wallet-nfts.ts) at /api/wallet-nfts.
 * Reuses ALCHEMY_API_KEY (server-only, no VITE_ prefix).
 */
function walletNftsApi(apiKey: string | undefined): Plugin {
  return {
    name: 'nexora-wallet-nfts-api',
    configureServer(server) {
      server.middlewares.use('/api/wallet-nfts', (req, res) => {
        void handleWalletNfts(new Request(`http://localhost/api/wallet-nfts${req.url ?? ''}`, { method: req.method }), { apiKey })
          .then(async (response) => {
            res.statusCode = response.status
            response.headers.forEach((value, key) => res.setHeader(key, value))
            res.end(await response.text())
          })
          .catch(() => { res.statusCode = 500; res.setHeader('content-type', 'application/json'); res.end('{"error":{"code":"upstream","message":"Unexpected server error."}}') })
      })
    },
  }
}

/**
 * Dev-only: serves the same handlers as the Vercel functions api/wallet-activity.ts (EVM transaction history) and
 * api/solana-activity.ts (Solana signatures) at /api/wallet-activity and /api/solana-activity.
 * Reuses ALCHEMY_API_KEY (server-only, no VITE_ prefix).
 */
function walletActivityApi(apiKey: string | undefined): Plugin {
  return {
    name: 'nexora-wallet-activity-api',
    configureServer(server) {
      for (const [route, handler] of [['/api/wallet-activity', handleWalletActivity], ['/api/solana-activity', handleSolanaActivity]] as const) {
        server.middlewares.use(route, (req, res) => {
          void handler(new Request(`http://localhost${route}${req.url ?? ''}`, { method: req.method }), { apiKey })
            .then(async (response) => {
              res.statusCode = response.status
              response.headers.forEach((value, key) => res.setHeader(key, value))
              res.end(await response.text())
            })
            .catch(() => { res.statusCode = 500; res.setHeader('content-type', 'application/json'); res.end('{"error":{"code":"upstream","message":"Unexpected server error."}}') })
        })
      }
    },
  }
}

/**
 * Dev-only: serves the same handler as the Vercel function (api/solana-transfer.ts) at /api/solana-transfer
 * (GET prepare/status, POST relay of an already-signed Devnet transaction). Reuses ALCHEMY_API_KEY (server-only).
 */
function solanaTransferApi(apiKey: string | undefined): Plugin {
  return {
    name: 'nexora-solana-transfer-api',
    configureServer(server) {
      server.middlewares.use('/api/solana-transfer', (req, res) => {
        const chunks: Buffer[] = []
        let size = 0
        req.on('data', (chunk: Buffer) => { size += chunk.length; if (size <= 16_384) chunks.push(chunk) })
        req.on('end', () => {
          const hasBody = req.method === 'POST'
          const request = new Request(`http://localhost/api/solana-transfer${req.url ?? ''}`, { method: req.method, ...(hasBody ? { body: size > 16_384 ? 'x'.repeat(8192) : Buffer.concat(chunks).toString('utf8') } : {}) })
          void handleSolanaTransfer(request, { apiKey })
            .then(async (response) => {
              res.statusCode = response.status
              response.headers.forEach((value, key) => res.setHeader(key, value))
              res.end(await response.text())
            })
            .catch(() => { res.statusCode = 500; res.setHeader('content-type', 'application/json'); res.end('{"error":{"code":"upstream","message":"Unexpected server error."}}') })
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), collectionsApi(loadEnv(mode, rootDir, '').OPENSEA_API_KEY), walletTokensApi(loadEnv(mode, rootDir, '').ALCHEMY_API_KEY), solanaBalanceApi(loadEnv(mode, rootDir, '').ALCHEMY_API_KEY), walletNftsApi(loadEnv(mode, rootDir, '').ALCHEMY_API_KEY), walletActivityApi(loadEnv(mode, rootDir, '').ALCHEMY_API_KEY), solanaTransferApi(loadEnv(mode, rootDir, '').ALCHEMY_API_KEY)],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
}))
