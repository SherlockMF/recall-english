# lint 复核：2026-10-22

本轮对既有诊断逐项分类：原 lint 范围从 **97** 条 warning 降至 **70** 条，**0 errors**。现已额外检查 E2E 与两份配置文件，这些新增检查范围没有 warning 或 error。

已修复：语音请求包装错误保留 cause（先失败、后通过）；七天统计随分钟时钟刷新（先失败、后通过）；保存回调 ref 移到 commit effect；worker 改用一次性事件监听；去除变量遮蔽、无捕获 helper 的重复创建及 promise 返回遗漏。MessagePort/DedicatedWorker 没有 targetOrigin，针对误报添加局部说明；保留 ES2022 目标，测试只对副本 reverse。没有全局降低规则级别。

下表列出全部保留项，作为本次收尾决策。它们仍会出现在 lint 输出中，没有把 warning 清空当作完成标准；以后修改相关逻辑时需重新判断。

| 位置 | 规则 | 决策理由 |
| --- | --- | --- |
| scripts/buildDictionarySensePack.mjs:18 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| scripts/buildDictionarySensePack.mjs:23 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| scripts/buildDictionarySensePack.mjs:28 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| scripts/buildDictionarySensePack.mjs:44 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| scripts/buildDictionarySensePack.mjs:82 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| scripts/buildDictionarySensePack.mjs:89 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| scripts/buildVocabularyLevels.mjs:26 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| scripts/buildVocabularyLevels.mjs:28 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| scripts/buildVocabularyLevels.mjs:30 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| scripts/enrichDictionaryContexts.mjs:106 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| scripts/enrichDictionaryContexts.mjs:113 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| scripts/enrichTrustedV1.mjs:547 | eslint(no-underscore-dangle) | 可信词包维护脚本的既有 _fix* 中间字段；改名会改变历史加工约定。 |
| scripts/enrichTrustedV1.mjs:548 | eslint(no-underscore-dangle) | 可信词包维护脚本的既有 _fix* 中间字段；改名会改变历史加工约定。 |
| scripts/enrichTrustedV1.mjs:552 | eslint(no-underscore-dangle) | 可信词包维护脚本的既有 _fix* 中间字段；改名会改变历史加工约定。 |
| scripts/enrichTrustedV1.mjs:552 | eslint(no-underscore-dangle) | 可信词包维护脚本的既有 _fix* 中间字段；改名会改变历史加工约定。 |
| scripts/enrichTrustedV1.mjs:553 | eslint(no-underscore-dangle) | 可信词包维护脚本的既有 _fix* 中间字段；改名会改变历史加工约定。 |
| scripts/enrichTrustedV1.mjs:555 | eslint(no-underscore-dangle) | 可信词包维护脚本的既有 _fix* 中间字段；改名会改变历史加工约定。 |
| scripts/enrichTrustedV1.mjs:555 | eslint(no-underscore-dangle) | 可信词包维护脚本的既有 _fix* 中间字段；改名会改变历史加工约定。 |
| scripts/enrichTrustedV1.mjs:556 | eslint(no-underscore-dangle) | 可信词包维护脚本的既有 _fix* 中间字段；改名会改变历史加工约定。 |
| scripts/enrichTrustedV1.mjs:558 | eslint(no-underscore-dangle) | 可信词包维护脚本的既有 _fix* 中间字段；改名会改变历史加工约定。 |
| scripts/enrichTrustedV1.mjs:559 | eslint(no-underscore-dangle) | 可信词包维护脚本的既有 _fix* 中间字段；改名会改变历史加工约定。 |
| scripts/macDesktopShortcut.ts:100 | unicorn(consistent-function-scoping) | 保留当前局部组织：测试辅助闭包或低频启动／连接 helper；本轮不做仅移动函数位置的重构。 |
| scripts/qwenVoiceMessages.mjs:45 | unicorn(consistent-function-scoping) | 保留当前局部组织：测试辅助闭包或低频启动／连接 helper；本轮不做仅移动函数位置的重构。 |
| scripts/seedRebuild.test.ts:33 | unicorn(consistent-function-scoping) | 保留当前局部组织：测试辅助闭包或低频启动／连接 helper；本轮不做仅移动函数位置的重构。 |
| src/App.test.tsx:390 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| src/App.tsx:449 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| src/App.tsx:458 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| src/components/AddView.tsx:538 | react(no-array-index-key) | 只读预览与历史记录可有重复时间戳／词义，现有复合键中的 index 用于区分同值条目。 |
| src/components/AddView.tsx:544 | react(no-array-index-key) | 只读预览与历史记录可有重复时间戳／词义，现有复合键中的 index 用于区分同值条目。 |
| src/components/AddView.tsx:545 | react(no-array-index-key) | 只读预览与历史记录可有重复时间戳／词义，现有复合键中的 index 用于区分同值条目。 |
| src/components/LearningEvidenceDetails.tsx:45 | react(no-array-index-key) | 只读预览与历史记录可有重复时间戳／词义，现有复合键中的 index 用于区分同值条目。 |
| src/components/LearningEvidenceDetails.tsx:64 | react(no-array-index-key) | 只读预览与历史记录可有重复时间戳／词义，现有复合键中的 index 用于区分同值条目。 |
| src/components/LibraryView.test.tsx:174 | unicorn(consistent-function-scoping) | 保留当前局部组织：测试辅助闭包或低频启动／连接 helper；本轮不做仅移动函数位置的重构。 |
| src/components/LibraryView.test.tsx:200 | unicorn(consistent-function-scoping) | 保留当前局部组织：测试辅助闭包或低频启动／连接 helper；本轮不做仅移动函数位置的重构。 |
| src/components/LibraryView.tsx:68 | react(exhaustive-effect-dependencies) | 分页需在筛选变化后重置；计时器监听器按挂载生命周期绑定，以 ref 读取最新值。 |
| src/components/LibraryView.tsx:68 | react(set-state-in-effect) | 同步外部设置、筛选分页、麦克风显示、口音或外部异步补全状态；保留已有交互。 |
| src/components/MicrophoneIndicator.tsx:12 | react(set-state-in-effect) | 同步外部设置、筛选分页、麦克风显示、口音或外部异步补全状态；保留已有交互。 |
| src/components/SettingsDialog.tsx:68 | react(set-state-in-effect) | 同步外部设置、筛选分页、麦克风显示、口音或外部异步补全状态；保留已有交互。 |
| src/components/StudySession.test.tsx:467 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| src/components/StudySession.tsx:162 | react(set-state-in-effect) | 同步外部设置、筛选分页、麦克风显示、口音或外部异步补全状态；保留已有交互。 |
| src/components/StudySession.tsx:326 | react-hooks(exhaustive-deps) | 计时器生命周期固定，完整 timer 对象每次 render 都变化；直接加入会重装监听器或反复触发补全。 |
| src/components/StudySession.tsx:327 | react(set-state-in-effect) | 同步外部设置、筛选分页、麦克风显示、口音或外部异步补全状态；保留已有交互。 |
| src/components/VoiceMessages.test.tsx:66 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| src/components/VoiceMessages.test.tsx:83 | unicorn(consistent-function-scoping) | 保留当前局部组织：测试辅助闭包或低频启动／连接 helper；本轮不做仅移动函数位置的重构。 |
| src/data/vocabularyV5.test.ts:128 | unicorn(consistent-function-scoping) | 保留当前局部组织：测试辅助闭包或低频启动／连接 helper；本轮不做仅移动函数位置的重构。 |
| src/data/vocabularyV5.test.ts:147 | unicorn(consistent-function-scoping) | 保留当前局部组织：测试辅助闭包或低频启动／连接 helper；本轮不做仅移动函数位置的重构。 |
| src/data/vocabularyV5.test.ts:163 | unicorn(consistent-function-scoping) | 保留当前局部组织：测试辅助闭包或低频启动／连接 helper；本轮不做仅移动函数位置的重构。 |
| src/data/vocabularyV5.test.ts:164 | unicorn(consistent-function-scoping) | 保留当前局部组织：测试辅助闭包或低频启动／连接 helper；本轮不做仅移动函数位置的重构。 |
| src/data/vocabularyV5.test.ts:268 | unicorn(consistent-function-scoping) | 保留当前局部组织：测试辅助闭包或低频启动／连接 helper；本轮不做仅移动函数位置的重构。 |
| src/lib/db.test.ts:390 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| src/lib/db.test.ts:392 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| src/lib/db.ts:284 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| src/lib/db.ts:289 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| src/lib/db.ts:292 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| src/lib/db.ts:462 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| src/lib/db.ts:463 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| src/lib/db.ts:540 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| src/lib/db.ts:854 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| src/lib/llm/client.ts:53 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| src/lib/llm/client.ts:59 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| src/lib/speech.ts:107 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| src/lib/useStudyTimer.ts:16 | react(refs) | 固定 StudyClock 的惰性创建，以及未用于渲染的命令 API 快照；耗时 UI 通过 useSyncExternalStore 订阅。 |
| src/lib/useStudyTimer.ts:18 | react(refs) | 固定 StudyClock 的惰性创建，以及未用于渲染的命令 API 快照；耗时 UI 通过 useSyncExternalStore 订阅。 |
| src/lib/useStudyTimer.ts:69 | eslint(no-await-in-loop) | 保留顺序：事务读写依赖前一步、保存／重试串行、词典限流或按用户步骤操作；不改为无限并发。 |
| src/lib/useStudyTimer.ts:113 | react-hooks(exhaustive-deps) | 计时器生命周期固定，完整 timer 对象每次 render 都变化；直接加入会重装监听器或反复触发补全。 |
| src/lib/useStudyTimer.ts:145 | react(exhaustive-effect-dependencies) | 分页需在筛选变化后重置；计时器监听器按挂载生命周期绑定，以 ref 读取最新值。 |
| src/lib/useStudyTimer.ts:148 | react(refs) | 固定 StudyClock 的惰性创建，以及未用于渲染的命令 API 快照；耗时 UI 通过 useSyncExternalStore 订阅。 |
| src/lib/voice/audio.test.ts:18 | unicorn(prefer-add-event-listener) | 测试中一次性 FileReader.onload，实例只用于这一次读取。 |
| src/lib/voice/audio.test.ts:34 | unicorn(consistent-function-scoping) | 保留当前局部组织：测试辅助闭包或低频启动／连接 helper；本轮不做仅移动函数位置的重构。 |
| src/lib/voice/audio.test.ts:73 | unicorn(consistent-function-scoping) | 保留当前局部组织：测试辅助闭包或低频启动／连接 helper；本轮不做仅移动函数位置的重构。 |

独立只读复核核对了计时器、补全 effect 和顺序 await 的语义。复核指出的七天统计缺依赖问题已经修复，不在保留列表中。配置文件的中间件改为 async/await + try/catch，继续将错误交给 Connect 的 next。
