# 千问实时口语陪练实施计划

用户已批准实时口语方案及国内模型选择。实现范围为本机单人、每次 5 分钟、千问北京地域 `qwen3.8-omni-flash-realtime`，课后纠正使用现有 DeepSeek。

1. 共用服务端模块 `scripts/qwenVoiceServer.mjs`：GET `/api/voice/config` 返回配置状态、固定模型及 300 秒上限；POST `/api/voice/session` 接收不超过 64 KiB 的 `application/sdp`，通过服务端 `DASHSCOPE_API_KEY`、`DASHSCOPE_WORKSPACE_ID` 与北京地域协商，返回 SDP。限制本机、同源、请求速率、超时、重复并发；错误格式 `{ error: { code, message } }`，不返回上游原始错误或凭证。Vite dev/preview 和分享包使用同一模块。
2. `src/lib/voice/`：场景和难度配置、字幕事件归并、WebRTC 连接。支持服务端 `txt` DataChannel；配置 semantic VAD 和输入转写；明确等待 session.updated 后再开启采音和问候。取消、切页、后台、超时、断线均释放音轨和连接；迟到的权限请求结果也释放。被打断文本保留标记，按千问协议取消回复，提示字幕可能包含尚未播放的内容。
3. `VoicePractice.tsx` 及导航：3 类场景、2 档难度、最多 3 个自选词汇、5 分钟倒计时、静音、结束、字幕、慢速/中文解释/提示及播放解锁；服务未配置时说明本机配置方式。延续奶油色和绿色风格。口语不写复习进度或学习计时表。
4. `src/lib/voice/feedback.ts`：用户主动发送最终用户字幕至现有 chatJson，最多 3 条纠正和 3 个表达；严格验证返回值，排除未完成或被打断文本；无 Key、无用户文本或失败均说明原因。支持复制、下载当前字幕和反馈，默认不持久化或保存录音。
5. 交付：补充 `.env.example`、README 和分享打包清单；相关 Vitest 测试、全量测试、lint、build 及本地浏览器验证。付费语音联调必须具备本机凭证与模型权限，模拟测试不能证明真实通话质量。

接口来源：https://help.aliyun.com/zh/model-studio/realtime 和 https://help.aliyun.com/zh/model-studio/client-events 。千问 WebRTC 仅支持 VAD 模式。长期密钥仅在服务端读取，客户端仅得到 SDP 与不含密钥的状态。
