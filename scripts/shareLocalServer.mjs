/**
 * Local share server: static app/ + API proxies matching vite.config.ts.
 * The share bundle includes the ws runtime used by voice messages.
 *
 * Usage: node server.mjs
 * Env: PORT=4173
 */
import { createServer } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { dirname, extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadVoiceEnv, createVoiceHandler } from './qwenVoiceServer.mjs'

const serverDirectory = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 4173)
const ROOT = [
  join(serverDirectory, 'app'),
  join(serverDirectory, 'dist'),
  join(serverDirectory, '..', 'dist'),
].find((candidate) => existsSync(candidate))

if (!ROOT) {
  console.error('Cannot find app/ or dist/ next to server.mjs')
  process.exit(1)
}

const voiceDirectory = dirname(ROOT)
const voice = createVoiceHandler({ env: loadVoiceEnv(voiceDirectory), credentialFile: join(voiceDirectory, '.env.voice.local.json') })

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
}

/** Same rewrite rules as vite.config.ts server.proxy */
const PROXIES = [
  {
    prefix: '/api/dictionary',
    origin: 'https://api.dictionaryapi.dev',
    stripPrefix: '/api/dictionary',
  },
  {
    prefix: '/api/youdao',
    origin: 'https://dict.youdao.com',
    stripPrefix: '/api/youdao',
  },
  {
    prefix: '/api/deepseek',
    origin: 'https://api.deepseek.com',
    stripPrefix: '/api/deepseek',
  },
]

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers)
  res.end(body)
}

function safeJoin(root, requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0] || '/')
  const relative = decoded.replace(/^\/+/, '')
  const candidate = normalize(join(root, relative))
  if (candidate !== root && !candidate.startsWith(root + sep)) return null
  return candidate
}

function proxyRequest(clientReq, clientRes, rule) {
  const incoming = new URL(clientReq.url || '/', `http://127.0.0.1:${PORT}`)
  const stripped = incoming.pathname.slice(rule.stripPrefix.length) || '/'
  const target = new URL(stripped + incoming.search, rule.origin)

  const headers = { ...clientReq.headers, host: target.host }
  delete headers.connection

  const upstream = httpsRequest(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || 443,
      path: target.pathname + target.search,
      method: clientReq.method,
      headers,
    },
    (upstreamRes) => {
      clientRes.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers)
      upstreamRes.pipe(clientRes)
    },
  )

  upstream.on('error', (error) => {
    if (!clientRes.headersSent) {
      send(
        clientRes,
        502,
        JSON.stringify({ error: 'proxy-failed', message: String(error.message || error) }),
        { 'content-type': 'application/json; charset=utf-8' },
      )
    } else {
      clientRes.destroy(error)
    }
  })

  clientReq.pipe(upstream)
}

function serveStatic(req, res) {
  const urlPath = (req.url || '/').split('?')[0] || '/'
  let filePath = safeJoin(ROOT, urlPath === '/' ? '/index.html' : urlPath)
  if (!filePath) {
    send(res, 403, 'Forbidden')
    return
  }

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    const indexPath = join(ROOT, 'index.html')
    if (!existsSync(indexPath)) {
      send(res, 404, 'Not found')
      return
    }
    filePath = indexPath
  }

  const type = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream'
  res.writeHead(200, { 'content-type': type })
  createReadStream(filePath).pipe(res)
}

const server = createServer(async (req, res) => {
  try {
    if (await voice(req, res)) return
    const path = (req.url || '/').split('?')[0] || '/'
    const rule = PROXIES.find((entry) => path === entry.prefix || path.startsWith(`${entry.prefix}/`))
    if (rule) {
      proxyRequest(req, res, rule)
      return
    }
    serveStatic(req, res)
  } catch (error) {
    if (res.headersSent) { res.destroy(); return }
    send(res, error instanceof URIError ? 400 : 500, error instanceof URIError ? 'Bad request' : 'Internal server error')
  }
})

server.once('close', voice.close)
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Recall English: http://127.0.0.1:${server.address().port}`)
  console.log('Proxies: /api/dictionary /api/youdao /api/deepseek')
  console.log('Close this window to stop.')
})
