import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  MAC_SHORTCUT_FILENAME,
  MAC_SHORTCUT_MARKER,
  buildMacShortcutScript,
  createMacDesktopShortcut,
  shellSingleQuote,
} from './macDesktopShortcut'

const tempRoots: string[] = []

function makeTempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mac-shortcut-'))
  tempRoots.push(root)
  return root
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

describe('macDesktopShortcut helpers', () => {
  it('escapes single quotes for shell', () => {
    expect(shellSingleQuote(`It's fine`)).toBe(`'It'\\''s fine'`)
  })

  it('builds a smart launcher script', () => {
    const script = buildMacShortcutScript('/Users/me/engstudy', 'http://127.0.0.1:5173/')
    expect(script.startsWith('#!/bin/bash')).toBe(true)
    expect(script).toContain(`ROOT='/Users/me/engstudy'`)
    expect(script).toContain(`URL='http://127.0.0.1:5173/'`)
    expect(script).toContain('is_up')
    expect(script).toContain('open "$URL"')
    expect(script).toContain('exec npm run dev')
  })

  it('skips non-darwin platforms', () => {
    const projectRoot = makeTempRoot()
    const homeDir = makeTempRoot()
    const result = createMacDesktopShortcut({
      projectRoot,
      localUrl: 'http://127.0.0.1:5173/',
      homeDir,
      platform: 'win32',
    })
    expect(result.created).toBe(false)
    expect(result.reason).toBe('not-darwin')
    expect(fs.existsSync(path.join(homeDir, 'Desktop', MAC_SHORTCUT_FILENAME))).toBe(false)
  })

  it('creates desktop shortcut once on darwin', () => {
    const projectRoot = makeTempRoot()
    const homeDir = makeTempRoot()
    const first = createMacDesktopShortcut({
      projectRoot,
      localUrl: 'http://127.0.0.1:5173/',
      homeDir,
      platform: 'darwin',
    })
    expect(first.created).toBe(true)
    expect(fs.existsSync(first.shortcutPath)).toBe(true)
    expect(fs.existsSync(path.join(projectRoot, MAC_SHORTCUT_MARKER))).toBe(true)

    const content = fs.readFileSync(first.shortcutPath, 'utf8')
    expect(content).toContain(`ROOT=${shellSingleQuote(path.resolve(projectRoot))}`)

    const second = createMacDesktopShortcut({
      projectRoot,
      localUrl: 'http://127.0.0.1:5174/',
      homeDir,
      platform: 'darwin',
    })
    expect(second.created).toBe(false)
    expect(second.reason).toBe('marker-exists')
    expect(fs.readFileSync(first.shortcutPath, 'utf8')).toBe(content)
  })
})
