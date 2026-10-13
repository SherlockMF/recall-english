# 项目稳定性修复计划

**目标：** 完成已确认的四项修复及发布前本地验收，保留当前工作区的用户改动。

**设计：** 沿用 React、IndexedDB 和现有脚本结构。种子正文增加可选 `contentEdited` 标记，升级始终保留个人状态、排序及学习历史；旧记录缺少标记且时间戳显示发生过修改时保守保留正文。纠错移除被替换的中文答案，保留其他答案。导出在 Node 中从磁盘加载完整种子，不复用浏览器 fetch；分享服务对无效路径返回 400。

**约束：** 不增加依赖，不发布、不推送，不输出或修改凭证。生产调用仅在用户确认费用授权后使用已有配置。所有递归清理仅针对验证过的临时目录。

## 1. 升级保留

- [x] 在 `src/lib/db.test.ts` 增加暂停、排序、已编辑内容、连续两次未编辑升级测试；备份恢复后再升级由 `src/lib/backup.test.ts` 验证。运行 `npm test -- src/lib/db.test.ts` 确认失败。
- [x] 在 `src/domain/types.ts` 增加可选布尔 `contentEdited`，在 `src/lib/backup.ts` 校验该字段；`src/App.tsx` 和 `src/lib/wordSenses.ts` 仅在正文发生个人编辑时设为 true。
- [x] `src/lib/db.ts` 对已有非 seed 或已编辑正文保留，对未编辑种子应用更新并设为 false，始终保留 status、priority、knownAt、vocabularyLevel 和 createdAt。
- [x] 运行 DB、备份和多义词测试，确认全部通过。

## 2. 释义纠错

- [x] 在 `src/App.test.tsx` 用真实编辑界面替换释义，验证旧答案被拒绝、独立同义答案保留、进度不变；运行定向测试确认失败。
- [x] 修改 `updateItem`：仅在释义改变时从 acceptedZhAnswers 中移除与旧 zhGloss 规范化相同的答案，再加入新释义。
- [x] 运行 App、grading 和字典义项测试。

## 3. 交付与服务

- [x] 为两个导出入口增加模块链接测试，为异常 URL 增加子进程 HTTP 回归测试，先确认失败。
- [x] 用现有 TypeScript/Vite 工具在 Node 里读取手写种子，并从 public/data 读取 bundled JSON；两个导出入口共享此加载器。
- [x] 导出脚本支持非覆盖的独立输出目录和跨平台压缩；CI 运行分享包生成及启动冒烟验证。
- [x] 无效 URL 返回 400，异步请求错误不会终止进程；验证后续正常请求仍返回 200。

## 4. 验收与提交

- [x] 运行完整 test、lint、build、词库硬闸及义项一致性检查。
- [x] 验证打包后种子数量、静态资源、无凭证文件、服务启动；独立浏览器 origin 验证备份导出与恢复。
- [x] 验证跨日学习预算；真实语音/AI 部分按授权状态执行并明确报告限制。
- [x] 请求独立代码复核，修复有效发现，更新 README 与人工验收记录，整理本地稳定版本提交。
