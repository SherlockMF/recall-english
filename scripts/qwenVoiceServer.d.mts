import type { IncomingMessage, ServerResponse } from 'node:http'
import type WebSocket from 'ws'
export function loadVoiceEnv(directory: string, fallbackDirectory?: string): Record<string, string | undefined>
export function createVoiceHandler(options?: { env?: Record<string, string | undefined>; fetch?: typeof fetch; credentialFile?: string; productionOrigin?: string; reserveUsage?: (userId: string, kind: string, requestId?: string) => Promise<boolean>; messageConnect?: (url: string, options: WebSocket.ClientOptions) => WebSocket }): ((req: IncomingMessage & { authUserId?: string }, res: ServerResponse) => Promise<boolean>) & { close: () => void }
