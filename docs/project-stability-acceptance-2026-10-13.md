# 项目稳定性验收：2026-10-13

本次在 `codex/learning-budget-evidence` 上修复已确认的问题，并对当前工作区的多义词、学习预算、语音练习和交付流程进行验收。保留已有功能改动，整理为本地稳定提交；未推送或发布。

## 修复与文件

| 问题 | 修复 | 主要文件 |
| --- | --- | --- |
| 种子更新覆盖个人词条状态或编辑正文 | 增加可选 `contentEdited`，保留暂停、优先级、已知标记、个人等级及学习记录；未编辑正文继续更新；旧记录按时间戳保守识别编辑 | `src/lib/db.ts`、`src/domain/types.ts`、`src/App.tsx`、`src/lib/wordSenses.ts`、`src/lib/backup.ts` |
| 修改中文释义后旧错误答案仍被判对 | 清除与旧释义规范化相同的答案，保留其他独立答案并加入新释义 | `src/App.tsx` |
| 两个导出脚本引用不存在的导出，无法打包 | 共享磁盘种子加载器，使用当前可信词包、独立 staging 和跨平台压缩，拒绝覆盖已有 ZIP | `scripts/exportShareBundle.mjs`、`scripts/exportVocabularyArchive.mjs`、`scripts/lib/loadSeedPack.mjs`、`scripts/lib/archive.mjs` |
| 异常 URL 导致分享服务请求失败或进程退出 | 无效编码返回 400，异步错误由请求处理器捕获；验证后续正常请求仍可访问 | `scripts/shareLocalServer.mjs` |
| 导出中的 Vite SSR 隐式改变 `NODE_ENV`，后续构建包含 React 开发代码 | 无论加载成功、失败或关闭异常，均恢复调用前的环境状态 | `scripts/lib/loadSeedPack.mjs` |

新增交付冒烟脚本 `scripts/checkShareBundle.mjs`，接入 `package.json` 与 `.github/workflows/ci.yml`。对应回归覆盖位于 `src/lib/db.test.ts`、`src/lib/backup.test.ts`、`src/App.test.tsx`、`scripts/exportEntries.test.ts` 和 `scripts/shareLocalServer.test.ts`。README 补充导出命令、备份兼容性和按 origin 保存凭证的说明。

原有多义词、等级、语音相关工作一并保存在稳定版本中；这些不是本次新增加的需求。

## 自动验证

| 检查 | 实际结果 |
| --- | --- |
| `npm test` | 57 个文件、435 个测试通过 |
| `npm run lint` | exit 0，无阻断错误；仍有 warning |
| `npm run build`，以及 `npm run share:export -- --output-dir <独立目录>` 的生产构建 | TypeScript 与 Vite 构建成功；最终生产主 JS 约 825.55 kB，仍有大 chunk 提示 |
| `npm run share:check -- --skip-build` | Windows 实际生成 ZIP、解压并启动分享服务；首页、JS、三个字典数据资源、未配置语音状态、异常 URL 400 及后续正常请求均通过；包内无真实凭证文件 |
| `npm run vocabulary:export -- --output-dir <独立目录>` | 成功生成词库 ZIP；完整种子 7,497 条、7,635 个 memberships；当前可信源词包 7,361 条、7,500 个 memberships |
| 实际词库 JSON 解析 | 完整种子和可信源词包均通过应用的 `parseVocabularyPack` |
| `npm run seed:quality` | bundledWords 7,257；hard failures 0、warnings 0 |
| `npm run seed:validate-sense --strict` | hard findings 0、collisions 0；soft findings 130，见下文 |
| 跨日定向测试 | `StudySession.test.tsx`、`studyTime.test.ts`、`scheduler.test.ts` 中跨日计划重建和预算相关 4 个测试通过 |
| 备份恢复后再升级 | `backup.test.ts` 验证 `contentEdited`、个人释义、暂停、优先级、FSRS 与回忆记录在导出、导入、种子升级后保留；该文件 17 个测试通过 |
| 独立代码复核 | 原始修复及 `NODE_ENV` 后续修复均完成只读复核，未发现阻断问题 |

种子保留、释义纠错、导出入口和异常 URL 的回归先复现失败，再修复到通过。`NODE_ENV` 回归同样先观察到失败再修复。没有新增依赖来实现这些稳定性修复。

## 浏览器与真实服务

浏览器验收使用独立测试 origin，不替换用户现有站点的数据。完成一次真实回忆并保存 FSRS，设置暂停及已知状态后导出 V3 备份，再改变状态并导入。导入完成后逐项比较 IndexedDB：32,647 个义项、91,147 条 tracks、1 次回忆和 2 条学习计时记录均与导出内容相同；暂停、已知标记保留。此处通过内存捕获下载 Blob 并作为文件导入，验证了导出内容和恢复流程，没有实际将学习备份下载到磁盘。设置窗口的 Escape 关闭及焦点恢复也通过。

用户授权使用现有配置进行少量真实调用。测试没有采集实际麦克风，也没有保存、更换或输出凭证：

- Qwen 语音消息：使用本地合成英文语音输入，收到 ASR、文本与约 4.88 秒语音回复。客户端中断后相同 turn 重试只发送一次上游 commit；缓存重放一致。结束返回 204，旧 session 返回 410，新 session 可重新建立。该轮 usage 为 input 766、output 82、total 848 tokens。
- 实时 WebRTC：使用受控静音音轨验证实际连接、配置确认、暂停/恢复、断连后的重试和结束清理；两个 peer 均已关闭。这不证明实际麦克风录音和环境噪声下的音质。
- DeepSeek：在历史 origin `http://127.0.0.1:5173` 和 `http://localhost:5173` 找到已有配置。当前 `5177` 没有同一份 localStorage 配置。使用原有 Key 在内存中对现有代理发起一次虚构句子的反馈请求，`deepseek-v4-flash` 返回 HTTP 200 及有效 JSON；usage 为 prompt 122、completion 78、total 200 tokens。未把 Key 复制到 `5177` 的持久存储。

测试浏览器页、配置探测页、合成音轨和临时服务已清理，用户原有 `5177` 页面保留。

## 交付产物

本机目录：`C:/Users/84754/Downloads/Recall-English-stable-2026-10-13-verified`。

| 文件 | 大小 | SHA-256 |
| --- | --- | --- |
| `recall-english-v53-share-2026-10-13.zip` | 5,403,289 bytes | `28bc9a60a1bdd8ca6d12931b447396d11dcf80af9c1dd4a5b33c5b8ae9fe3957` |
| `recall-english-vocabulary-v53-2026-10-13.zip` | 2,864,624 bytes | `7ed0d7249f873dded22b40e8ee8a461627de6f09345078bedb4d0967e7cbc88e` |

ZIP、构建目录、真实配置与字典查询缓存不提交到 Git。

旧的开发构建测试包目录 `Recall-English-stable-2026-10-13-154927` 与合成语音临时文件因清理操作被自动审批拒绝而保留。正式交付使用上面的 `verified` 目录。

## 保留的限制与下一步

- 义项一致性检查的 130 条是启发式人工复核提示：75 条 `noun_def_looks_verbal`、49 条 `short_def_trailing_functionword`、6 条 `example_missing_expression`。本次没有批量改写词库以消除提示。下一步优先逐条审查含义是否正确。
- lint warning 和生产 chunk 大小提示仍存在；后续按模块拆分并在真实设备测量加载表现。没有为了消除提示进行无关重构。
- GitHub Actions 已配置分享包检查，但本次未推送，未实际运行远端 CI。Unix 压缩分支及 macOS 启动脚本没有在对应操作系统实跑。
- 实际麦克风、扬声器、噪声与权限弹窗仍需真人验收；本次仅使用合成语音和静音音轨。
- 新版继续接受没有 `contentEdited` 的旧备份；旧版应用可能拒绝含此字段的新备份，回退前应保留原备份。
- [人工复核任务单](manual-review-checklist.md) 中未在本文给出证据的项目继续保留为待办。
