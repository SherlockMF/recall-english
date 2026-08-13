import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'

export const MAC_SHORTCUT_MARKER = '.mac-desktop-shortcut'
export const MAC_SHORTCUT_FILENAME = 'Recall English.command'

export function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export function buildMacShortcutScript(projectRoot: string, localUrl: string): string {
  const root = shellSingleQuote(projectRoot)
  const url = shellSingleQuote(localUrl)
  return `#!/bin/bash
set -euo pipefail

ROOT=${root}
URL=${url}

is_up() {
  curl -sf -o /dev/null --max-time 1 "$URL"
}

if is_up; then
  open "$URL"
  exit 0
fi

cd "$ROOT"

(
  for _ in $(seq 1 120); do
    if is_up; then
      open "$URL"
      exit 0
    fi
    sleep 0.5
  done
) &

exec npm run dev
`
}

export function resolveLocalDevUrl(server: ViteDevServer): string {
  const fromResolved = server.resolvedUrls?.local?.[0]
  if (fromResolved) return fromResolved.endsWith('/') ? fromResolved : `${fromResolved}/`

  const address = server.httpServer?.address()
  if (address && typeof address === 'object') {
    const host =
      address.address === '::' || address.address === '0.0.0.0' ? '127.0.0.1' : address.address
    return `http://${host}:${address.port}/`
  }

  return 'http://127.0.0.1:5173/'
}

export function createMacDesktopShortcut(options: {
  projectRoot: string
  localUrl: string
  homeDir?: string
  platform?: NodeJS.Platform
}): { created: boolean; shortcutPath: string; reason?: string } {
  const platform = options.platform ?? process.platform
  const homeDir = options.homeDir ?? os.homedir()
  const projectRoot = path.resolve(options.projectRoot)
  const markerPath = path.join(projectRoot, MAC_SHORTCUT_MARKER)
  const shortcutPath = path.join(homeDir, 'Desktop', MAC_SHORTCUT_FILENAME)

  if (platform !== 'darwin') {
    return { created: false, shortcutPath, reason: 'not-darwin' }
  }

  if (fs.existsSync(markerPath)) {
    return { created: false, shortcutPath, reason: 'marker-exists' }
  }

  fs.mkdirSync(path.dirname(shortcutPath), { recursive: true })
  fs.writeFileSync(shortcutPath, buildMacShortcutScript(projectRoot, options.localUrl), {
    encoding: 'utf8',
    mode: 0o755,
  })
  fs.chmodSync(shortcutPath, 0o755)
  fs.writeFileSync(markerPath, `${shortcutPath}\n`, 'utf8')

  return { created: true, shortcutPath }
}

export function macDesktopShortcut(): Plugin {
  return {
    name: 'mac-desktop-shortcut',
    apply: 'serve',
    configureServer(server) {
      if (process.platform !== 'darwin') return

      server.httpServer?.once('listening', () => {
        const tryCreate = () => {
          try {
            const result = createMacDesktopShortcut({
              projectRoot: server.config.root,
              localUrl: resolveLocalDevUrl(server),
            })
            if (result.created) {
              server.config.logger.info(
                `[mac-desktop-shortcut] Created Desktop launcher: ${result.shortcutPath}`,
              )
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            server.config.logger.warn(`[mac-desktop-shortcut] ${message}`)
          }
        }

        // resolvedUrls is filled just after listen; defer one tick.
        setImmediate(tryCreate)
      })
    },
  }
}
