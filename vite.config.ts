import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { IncomingMessage } from 'node:http'
import { dirname, extname, join, resolve } from 'node:path'

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((res) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => res(data))
    req.on('error', () => res(''))
  })
}

function readBodyBuffer(req: IncomingMessage): Promise<Buffer> {
  return new Promise((res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => res(Buffer.concat(chunks)))
    req.on('error', () => res(Buffer.alloc(0)))
  })
}

const safeName = (s: string) =>
  (s || 'diagrama').replace(/[^a-z0-9_\-.]/gi, '-').replace(/\.txt$/i, '') + '.txt'

// Nombre de archivo subido: conserva extension, saca caracteres peligrosos y
// puntos iniciales (evita .. y ocultos). Subdir: solo letras/num/_/-//.
const safeUploadName = (s: string) =>
  ((s || 'archivo').replace(/[^a-z0-9_\-.]/gi, '-').replace(/^\.+/, '') || 'archivo')
const safeSubdir = (s: string) =>
  (s || 'progreso').replace(/\\/g, '/').replace(/[^a-z0-9_\-/]/gi, '-').replace(/\.+/g, '.')

const RAW_MIME: Record<string, string> = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm',
  '.mov': 'video/quicktime', '.ogg': 'video/ogg', '.ogv': 'video/ogg',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.avif': 'image/avif', '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
}

// Dev-only: integra la app con Claude Code (loop diagrama <-> codigo).
//   GET  /__diagrams         -> lista los .txt de /diagrams en vivo (boton recargar)
//   POST /__diagrams/push    -> {name, source} escribe un .txt en /diagrams
//   POST /__design           -> {content, file?} escribe la spec viva (design.md)
//   GET  /__files            -> lista archivos de un repo (?root) para el picker
//   POST /__upload           -> sube un archivo (?root&dir&name, body binario) al
//                               repo del proyecto; devuelve la ruta relativa
//   GET  /__raw              -> sirve un archivo (?root&path) para el preview
//   watcher /diagrams        -> WS 'diagrams:changed' (auto-reload sin recargar)
// En prod no existe (la app cae al glob bundleado / no exporta).
function diagramsLibraryPlugin(): Plugin {
  return {
    name: 'diagrams-library',
    configureServer(server) {
      // resolve() normaliza separadores (Vite guarda root con '/', Node usa '\'
      // en Windows -> el startsWith fallaria sin esto).
      const root = resolve(server.config.root)
      const dir = resolve(root, 'diagrams')

      server.middlewares.use('/__diagrams', async (req, res, next) => {
        try {
          if (req.method === 'GET') {
            const files = existsSync(dir)
              ? readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.txt'))
              : []
            const out = files.map((f) => ({
              name: f.replace(/\.txt$/i, ''),
              source: readFileSync(join(dir, f), 'utf8'),
            }))
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(out))
            return
          }
          if (req.method === 'POST' && (req.url === '/push' || req.url?.startsWith('/push'))) {
            const body = JSON.parse((await readBody(req)) || '{}') as { name?: string; source?: string }
            if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
            const file = safeName(body.name ?? 'diagrama')
            writeFileSync(join(dir, file), body.source ?? '', 'utf8')
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, file }))
            return
          }
          next()
        } catch {
          res.statusCode = 500
          res.end('{}')
        }
      })

      server.middlewares.use('/__design', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        try {
          const body = JSON.parse((await readBody(req)) || '{}') as { content?: string; file?: string }
          const file = (body.file ?? 'design.md').replace(/[^a-z0-9_\-./]/gi, '-')
          const target = resolve(root, file)
          if (!target.startsWith(root)) throw new Error('fuera del root')
          writeFileSync(target, body.content ?? '', 'utf8')
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true, file }))
        } catch {
          res.statusCode = 500
          res.end('{}')
        }
      })

      // Lista archivos de un repo (para el picker de archivos del nodo). root es
      // opcional (default = cwd del dev server); permite apuntar a OTRO proyecto.
      server.middlewares.use('/__files', (req, res, next) => {
        if (req.method !== 'GET') return next()
        try {
          const q = new URL(req.url || '', 'http://x').searchParams
          const rootParam = q.get('root')
          const base = rootParam ? resolve(rootParam) : root
          const IGNORE = new Set([
            'node_modules', '.git', 'dist', 'build', '.next', '.vite', '.cache',
            'coverage', 'out', '.turbo', '.svelte-kit',
          ])
          const files: string[] = []
          const MAX = 5000
          const walk = (d: string, rel: string) => {
            if (files.length >= MAX) return
            let entries
            try { entries = readdirSync(d, { withFileTypes: true }) } catch { return }
            for (const e of entries) {
              if (files.length >= MAX) break
              const relPath = rel ? `${rel}/${e.name}` : e.name
              if (e.isDirectory()) {
                if (IGNORE.has(e.name) || e.name.startsWith('.')) continue
                walk(join(d, e.name), relPath)
              } else if (e.isFile() && !e.name.startsWith('.')) {
                files.push(relPath)
              }
            }
          }
          walk(base, '')
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ root: base, files, truncated: files.length >= MAX }))
        } catch {
          res.statusCode = 500
          res.end('{"files":[]}')
        }
      })

      // Sube un archivo (evidencia/avance) al repo del proyecto. El body es el
      // binario crudo; root/dir/name van en query. Devuelve la ruta relativa al
      // root (la que se vincula al nodo en el attr `assets`).
      server.middlewares.use('/__upload', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        try {
          const q = new URL(req.url || '', 'http://x').searchParams
          const rootParam = q.get('root')
          const base = rootParam ? resolve(rootParam) : root
          const sub = safeSubdir(q.get('dir') || 'progreso')
          const name = safeUploadName(q.get('name') || 'archivo')
          const target = resolve(base, sub, name)
          if (target !== base && !target.startsWith(base + '\\') && !target.startsWith(base + '/')) {
            throw new Error('fuera del root')
          }
          const buf = await readBodyBuffer(req)
          mkdirSync(dirname(target), { recursive: true })
          writeFileSync(target, buf)
          const rel = `${sub}/${name}`.replace(/\/+/g, '/')
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true, path: rel, bytes: buf.length }))
        } catch {
          res.statusCode = 500
          res.end('{"ok":false}')
        }
      })

      // Sirve un archivo del repo del proyecto para el preview (video/img/pdf).
      server.middlewares.use('/__raw', (req, res, next) => {
        if (req.method !== 'GET') return next()
        try {
          const q = new URL(req.url || '', 'http://x').searchParams
          const rootParam = q.get('root')
          const base = rootParam ? resolve(rootParam) : root
          const rel = q.get('path') || ''
          const target = resolve(base, rel)
          if (target !== base && !target.startsWith(base + '\\') && !target.startsWith(base + '/')) {
            throw new Error('fuera del root')
          }
          if (!existsSync(target)) {
            res.statusCode = 404
            res.end('not found')
            return
          }
          const buf = readFileSync(target)
          const mime = RAW_MIME[extname(target).toLowerCase()] || 'application/octet-stream'
          res.setHeader('Content-Type', mime)
          res.setHeader('Content-Length', String(buf.length))
          res.setHeader('Cache-Control', 'no-store')
          res.end(buf)
        } catch {
          res.statusCode = 500
          res.end('error')
        }
      })

      // Auto-reload: avisa al cliente cuando cambian los .txt de /diagrams.
      if (existsSync(dir)) server.watcher.add(dir)
      const notify = (file: string) => {
        const f = file.replace(/\\/g, '/')
        if (f.includes('/diagrams/') && f.toLowerCase().endsWith('.txt')) {
          server.ws.send({ type: 'custom', event: 'diagrams:changed' })
        }
      }
      server.watcher.on('add', notify)
      server.watcher.on('change', notify)
      server.watcher.on('unlink', notify)
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    diagramsLibraryPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Diagrama',
        short_name: 'Diagrama',
        description: 'Editor de diagramas diagram-as-code estilo eraser.io',
        lang: 'es',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precachea todos los assets buildeados para arranque offline
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Monaco se carga desde jsdelivr: cachealo tras la primera carga
            // asi el editor tambien anda offline.
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'jsdelivr-monaco',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    // Escucha en todas las interfaces (no solo localhost) para poder abrir la
    // app desde el celular en la misma WiFi: http://<IP-de-la-PC>:5173
    host: true,
  },
  build: {
    target: 'esnext',
  },
})
