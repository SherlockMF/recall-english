# 实时畅聊逐句纠错实施计划

**目标：** 按用户截图，在已完成的个人发言旁自动显示语法、用词纠正及中文解释，聊天无需结束。

**设计：** 复用现有 DeepSeek JSON 客户端，每条发言独立检查和取消请求。只发送本句与上一条完整、未被打断的 AI 发言；不发送音频。保留原句，最多显示三项明确错误，无明确错误时显示检查结果，不把合乎语法的过去式、口语省略或风格差异当成错误。

**范围：** 仅截图中的实时畅聊。沿用现有 React、样式、配置及课后反馈，不新增依赖或服务端接口，不修改语音消息模式。宽屏并排，窄屏自然换行。DeepSeek 未配置时说明原因；检查失败仅允许手动重试；退出、重新开始或转写变化后取消旧请求。

1. [x] 在 `src/components/VoicePractice.test.tsx`、`src/lib/voice/feedback.test.ts` 添加回归测试并确认缺少逐句反馈时失败。
2. [x] 在 `src/lib/voice/feedback.ts` 实现 `generateVoiceTurnFeedback(learnerSpeech, previousReply, signal)`，验证引用来自本句、响应结构及数量，支持空纠正列表。
3. [x] 新增 `src/components/VoiceTurnFeedback.tsx`，接入 `src/components/VoicePractice.tsx` 与 `src/styles.css`，处理加载、成功、失败重试及取消，并补充 README。
4. [x] 运行 `npm test -- src/lib/voice/feedback.test.ts src/components/VoicePractice.test.tsx`，再运行相关语音测试、`npm run lint`、`npm run build`；检查宽窄屏布局并审查差异。

**验收重点：** 仅最终用户转写触发；AI 字幕和计时更新不重复请求；连续发言的结果不串行归属；重启后无旧结果；正确句子不强制修改；模拟服务结果不能证明真实模型速度和准确率。

**验证记录：** 9 个相关测试文件、73 项测试通过；TypeScript/Vite 构建通过；改动文件 lint 无警告，仓库 lint 无错误但有既有警告。Chromium 在 1440px 宽屏中并排、390px 窄屏中换行且无横向溢出。审查发现的异步长反馈滚动问题已修复：只在原本贴底时随内容增高滚动，阅读历史时保持位置；使用实际页面及模拟返回验证，三项长反馈后 scrollTop=519、scrollHeight=859、clientHeight=340。未调用真实语音或 DeepSeek 服务。

**滚动复审：** 使用 scroll 事件保存跟随状态，避免与浏览器原生 scroll anchoring 冲突。Chromium 390px fixture 中，上方内容增高 260px 时，阅读历史的 scrollTop 从 549 变为 809，距底保持 150px；原本贴底时从 699 变为 959，距底保持 0px。两种情况均通过。
