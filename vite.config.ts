import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { macDesktopShortcut } from './scripts/macDesktopShortcut.ts'
import { createVoiceHandler } from './scripts/qwenVoiceServer.mjs'
import { join } from 'node:path'

export default defineConfig(({ mode }) => {
  const voice = createVoiceHandler({ env: { ...loadEnv(mode, process.cwd(), 'DASHSCOPE_'), ...process.env }, credentialFile: join(process.cwd(), '.env.voice.local.json') })
  return {
    plugins: [react(), macDesktopShortcut(), {
      name: 'qwen-voice',
      configureServer(server) {
        server.httpServer?.once('close', voice.close)
        server.middlewares.use(async (req, res, next) => { try { if (!(await voice(req, res))) next() } catch (error) { next(error) } })
      },
      configurePreviewServer(server) {
        server.httpServer?.once('close', voice.close)
        server.middlewares.use(async (req, res, next) => { try { if (!(await voice(req, res))) next() } catch (error) { next(error) } })
      },
    }],
    server: {
      proxy: {
        '/api/deepseek': {
          target: 'https://api.deepseek.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/deepseek/, ''),
        },
        '/api/dictionary': {
          target: 'https://api.dictionaryapi.dev',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/dictionary/, ''),
        },
        '/api/youdao': {
          target: 'https://dict.youdao.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/youdao/, ''),
        },
      },
    },
    preview: {
      proxy: {
        '/api/deepseek': {
          target: 'https://api.deepseek.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/deepseek/, ''),
        },
        '/api/dictionary': {
          target: 'https://api.dictionaryapi.dev',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/dictionary/, ''),
        },
        '/api/youdao': {
          target: 'https://dict.youdao.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/youdao/, ''),
        },
      },
    },
    test: {
      include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
      // Full-library IndexedDB fixtures need predictable CPU and memory on CI.
      maxWorkers: 2,
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.ts',
      css: true,
    },
  }
})
