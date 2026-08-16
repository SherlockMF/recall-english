/**
 * Build a shareable zip: runnable web app (vocab bundled) + importable V5.3 seed pack.
 * Mac-first: includes double-clickable 「启动 Recall English.command」.
 *
 * Run: npx vite-node scripts/exportShareBundle.mjs
 * Output: ~/Downloads/recall-english-v53-share-YYYY-MM-DD.zip
 */
import { mkdirSync, writeFileSync, rmSync, cpSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { ALL_VOCABULARY_LISTS } from '../src/data/vocabularyLists.ts'
import { seedMemberships, seedWords } from '../src/data/seedVocabulary.ts'
import { SEED_CONTENT_REVISION } from '../src/data/seedContentRevision.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const now = new Date()
const exportedAt = now.toISOString().replace(/\.\d{3}Z$/, '.000Z')
const stamp = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(now)

const downloads = join(process.env.USERPROFILE ?? process.env.HOME ?? root, 'Downloads')
const zipName = `recall-english-v53-share-${stamp}.zip`
const zipPath = join(downloads, zipName)
const stageRoot = join(root, 'data', 'vocabulary-packs', '_export', 'share-stage')
const appDir = join(stageRoot, 'app')
const vocabDir = join(stageRoot, 'vocabulary')

if (existsSync(stageRoot)) rmSync(stageRoot, { recursive: true, force: true })
mkdirSync(appDir, { recursive: true })
mkdirSync(vocabDir, { recursive: true })

console.log('Building app with relative base…')
execFileSync('npm', ['run', 'build', '--', '--base', './'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
})

const dist = join(root, 'dist')
if (!existsSync(dist)) throw new Error('dist/ missing after build')
cpSync(dist, appDir, { recursive: true })

const shareServerSrc = join(root, 'scripts', 'shareLocalServer.mjs')
if (!existsSync(shareServerSrc)) throw new Error('scripts/shareLocalServer.mjs missing')
cpSync(shareServerSrc, join(stageRoot, 'server.mjs'))

const systemLists = ALL_VOCABULARY_LISTS.filter((list) => list.isSystem)
const completeSeed = {
  version: 1,
  kind: 'vocabulary-pack',
  exportedAt,
  words: seedWords,
  lists: systemLists,
  memberships: seedMemberships,
}
writeFileSync(
  join(vocabDir, 'recall-english-v53-complete-seed.json'),
  `${JSON.stringify(completeSeed)}\n`,
)

const listCounts = {}
for (const item of seedMemberships) {
  const list = systemLists.find((entry) => entry.id === item.listId)
  const slug = list?.slug ?? item.listId
  listCounts[slug] = (listCounts[slug] ?? 0) + 1
}

const readme = `# Recall English V5.3 分享包（Mac）

导出时间：${exportedAt}
词库版本：V5.3（seedContentRevision ${SEED_CONTENT_REVISION}）
义项数量：${seedWords.length}

---

## Mac 怎么用

### 方式 1：终端一键（最省事，推荐）

1. 解压 zip。
2. 打开「终端」。
3. 把下面整段粘贴执行（把路径改成你的解压目录）：

\`\`\`bash
cd ~/Downloads/recall-english-v53-share-*
# 若解压后是文件夹，先进那个文件夹，例如：
# cd ~/Downloads/recall-english-v53-share-2026-08-16
xattr -cr .
chmod +x "启动 Recall English.command"
open "启动 Recall English.command"
\`\`\`

浏览器会打开 http://localhost:4173。关闭终端窗口即停止。

本地服务会代理词典 / 有道 / DeepSeek，因此 **「词典辅助」可用**（需联网）。  
「AI 补全」仍需你在设置里填写自己的 DeepSeek API Key。

### 方式 2：双击 .command（若被系统拦截）

若弹出「Apple 无法验证…」：

1. 先点 **完成**（不要点「移到废纸篓」）。
2. 对该文件 **右键 → 打开** → 再点 **打开**。
3. 若仍不行：系统设置 → **隐私与安全性** → 拉到下方 → 点 **仍要打开**。
4. 或在终端对解压目录执行：

\`\`\`bash
xattr -cr .
chmod +x "启动 Recall English.command"
\`\`\`

然后再双击。

> 需要已安装 [Node.js LTS](https://nodejs.org/)。  
> 不要直接双击 \`app/index.html\`。

---

## 包里有什么

| 路径 | 说明 |
| --- | --- |
| \`启动 Recall English.command\` | Mac 启动脚本 |
| \`一键启动（终端）.command\` | 自动清隔离属性再启动（同样可能需右键打开一次） |
| \`server.mjs\` | 本地静态服务 + API 代理（词典/有道/DeepSeek） |
| \`app/\` | 网页应用；**内置完整 V5.3 词库** |
| \`vocabulary/recall-english-v53-complete-seed.json\` | 可导入词库包（${seedWords.length} 条） |
| \`README.md\` | 本说明 |

列表规模（memberships）：${JSON.stringify(listCounts)}

---

## 可选：只导入词库

应用内：设置 → 导入词库包 → 选 \`vocabulary/recall-english-v53-complete-seed.json\`

---

## 注意

- 学习进度在本机浏览器；换机请用应用内「学习备份」。
- 从网盘/微信下载的文件常带「隔离属性」，所以会触发 Apple 验证提示，用上面的 \`xattr -cr .\` 即可。
- 词典辅助 / 有道读音需要联网；AI 功能需要自备 DeepSeek Key。
- 请用 \`启动 Recall English.command\` 或 \`node server.mjs\` 启动，不要双击 \`app/index.html\`（否则没有 API 代理）。
`

writeFileSync(join(stageRoot, 'README.md'), readme)

const macCommand = `#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
URL="http://127.0.0.1:4173"

# Clear download quarantine so subsequent opens are quieter
xattr -cr . 2>/dev/null || true

if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display dialog "未检测到 Node.js。\\n请先安装 Node.js LTS：https://nodejs.org/" buttons {"好"} default button 1 with icon stop'
  exit 1
fi

if [[ ! -f "./server.mjs" ]]; then
  osascript -e 'display dialog "缺少 server.mjs。请重新解压完整分享包。" buttons {"好"} default button 1 with icon stop'
  exit 1
fi

is_up() {
  curl -sf -o /dev/null --max-time 1 "$URL/" || curl -sf -o /dev/null --max-time 1 "$URL"
}

if is_up; then
  open "$URL"
  exit 0
fi

(
  for _ in $(seq 1 120); do
    if is_up; then
      open "$URL"
      exit 0
    fi
    sleep 0.5
  done
) &

echo "正在启动 Recall English…"
echo "浏览器将打开 $URL"
echo "已启用词典 / 有道 / DeepSeek 本地代理。"
echo "关闭本窗口即停止服务。"
exec node ./server.mjs
`

const bootstrapCommand = `#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
xattr -cr . 2>/dev/null || true
chmod +x "启动 Recall English.command" 2>/dev/null || true
chmod +x "一键启动（终端）.command" 2>/dev/null || true
exec bash "启动 Recall English.command"
`

const macCommandPath = join(stageRoot, '启动 Recall English.command')
const bootstrapPath = join(stageRoot, '一键启动（终端）.command')
writeFileSync(macCommandPath, macCommand.replace(/\r\n/g, '\n'))
writeFileSync(bootstrapPath, bootstrapCommand.replace(/\r\n/g, '\n'))

try {
  execFileSync('chmod', ['+x', macCommandPath, bootstrapPath], { stdio: 'ignore' })
} catch {
  // Built on Windows
}

// Plain text helper for users who cannot open .command yet
writeFileSync(
  join(stageRoot, '打不开请看这里.txt'),
  `若双击「启动 Recall English.command」弹出「Apple 无法验证」：

1. 点「完成」，不要移到废纸篓。
2. 打开「终端」，粘贴（路径按你的解压位置改）：

cd ~/Downloads
cd recall-english-v53-share-*
xattr -cr .
chmod +x "启动 Recall English.command"
open "启动 Recall English.command"

需要已安装 Node.js：https://nodejs.org/
`,
  'utf8',
)

const bat = `@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Install LTS from https://nodejs.org/
  pause
  exit /b 1
)
echo Starting Recall English on http://127.0.0.1:4173
echo Dictionary / Youdao / DeepSeek proxies enabled.
echo Close this window to stop the server.
node server.mjs
pause
`
writeFileSync(join(stageRoot, 'start-windows.bat'), bat)

if (existsSync(zipPath)) rmSync(zipPath, { force: true })

execFileSync(
  'powershell.exe',
  [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path '${stageRoot}\\*' -DestinationPath '${zipPath}' -Force; if (-not (Test-Path -LiteralPath '${zipPath}')) { throw 'zip was not created' }`,
  ],
  { stdio: 'inherit' },
)

console.log(
  JSON.stringify(
    {
      zipPath,
      words: seedWords.length,
      revision: SEED_CONTENT_REVISION,
      exportedAt,
      macLauncher: '启动 Recall English.command',
    },
    null,
    2,
  ),
)
