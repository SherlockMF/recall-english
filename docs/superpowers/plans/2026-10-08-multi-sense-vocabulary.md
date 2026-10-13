# 多义项词库 Implementation Plan

> **For agentic workers:** 使用 executing-plans 在当前会话逐项实施；保留工作区已有改动，不自动提交、发布或新建工作树。

**Goal:** 同词归并展示，保存词典返回的全部义项，由用户选定训练义项；各义项保持独立复习与学习证据。

**Architecture:** 保留 Word 作为独立义项，使用规范化 expression 构建展示分组，不合并短语、别名或学习记录。新词典义项未勾选时使用现有 paused 状态保存，进入词库及 V3 备份；缺中文的义项仅供查阅，补全后才能训练。所有保存使用 writeBatch，旧 ID、进度、用户内容不被替换。

**Tech Stack:** React、TypeScript、IndexedDB/idb、Vitest、现有 FSRS。

## Global Constraints

- 不增加依赖，不批量发起外部请求；查词沿用现有来源并由用户点击触发。
- 不承诺穷尽所有词义；展示来源返回的全部义项，不再截断为六项。
- 不把其他义项加入当前 acceptedZhAnswers，不将同词的学习证据合并。相同中文、不同英文定义保留为独立义项；无法确认旧记录的对应关系时不做语义合并。
- 每日新表达额度仍按义项计；难度筛选、自报已会及口语功能保持兼容。
- 旧 Word.id、LearningTrack 和 ReviewAttempt 保留，数据库/备份版本不变。

## Task 1: 独立义项保存与词条分组

Files: src/lib/wordSenses.ts、src/lib/wordSenses.test.ts。

Interfaces: groupWordsByExpression(items: VocabularyItem[]) 返回 expression/key/senses；saveDictionarySenses(result: DictionaryResult, selectedIndices: number[], category: SystemListSlug) 返回 added/activated/total。

- [x] 测试同词归并、短语与连字符不误合并、未选义项暂停、缺中文义项不能训练、重复补全不覆盖旧进度或用户内容。
- [x] 执行 `npm test -- src/lib/wordSenses.test.ts`，确认新增行为失败。
- [x] 实现展示分组和原子保存；只补充缺失轨道，为明确选择的义项添加优先学习归属。再次保存允许填补旧词典义项的空字段，不覆盖已有内容或复习进度。
- [x] 重跑测试，要求全部通过。

## Task 2: 添加与词库完整词义流程

Files: src/components/AddView.tsx、src/components/AddView.test.tsx、src/components/LibraryView.tsx、src/components/LibraryView.test.tsx、src/App.tsx、src/styles.css。

- [x] 测试第七个词义可见、勾选多个训练义项、保存全部词义、编辑当前义项保留其他义项、同词只有一个词条标题、单独暂停与已会、补全失败提示。
- [x] 执行两个组件测试，确认目标行为失败。
- [x] 添加页展示全部义项及训练复选框，表单确认当前义项；保存一次传递全部词义及训练选择。
- [x] 词库按词条分组，义项操作留在各自区域；增加手动补全按钮，补全的新义项默认暂停，缺中文显示需补全。
- [x] App 调用 saveDictionarySenses 后刷新数据；保存失败保留输入并提示。
- [x] 重跑组件和 App 集成测试。

## Task 3: 语境出题与目标义项判分

Files: src/components/StudySession.tsx、src/components/StudySession.test.tsx、src/lib/presentation.ts、src/lib/text.ts、src/lib/scheduler.ts、src/lib/scheduler.test.ts、src/lib/llm/gradeAssist.ts、src/lib/llm/usageGenerate.ts、src/lib/llm/contentAssist.test.ts。

- [x] 测试英译中展示英语例句但不泄露中文；造句题明确当前中文义项；传给 AI 的目标义项约束清晰。
- [x] 运行对应测试，确认新行为失败。
- [x] 回忆题优先英语例句，无例句使用英文定义或搭配；多义项缺少英语资料时暂不安排英译中（含新题和到期题），补齐后恢复。造句要求目标义项，AI 明确不能用其他词义替代。
- [x] 保留已有判分和 FSRS 轨道隔离，不更改每日义项额度。
- [x] 重跑测试。

## Task 4: 种子管线与迁移保护

Files: scripts/buildBundledSeedPack.mjs、scripts/lib/handcraftedSenses.mjs、scripts/handcraftedSenses.test.ts、src/lib/wordSenses.test.ts。

- [x] 测试手写词与来源同词不同义保留，同义重复跳过。
- [x] 运行测试，确认原来的按英文表达跳过逻辑不满足要求。
- [x] 用义项匹配替代按 expression 排除；不运行重建脚本、不更改未经审核的生产词库。
- [x] 验证新义项与原轨道、作答、已会及难度字段均能经现有备份往返保存。

## Task 5: 回归与交付

Files: README.md、本计划。

- [x] 更新词库用法、暂停义项、来源完整性及新义项额度说明。
- [x] 运行 `npm test`、`npm run lint`、`npm run build`，逐项检查退出码。
- [x] 检查 diff，不包含凭证、无关重构或覆盖用户修改。
- [x] 在本计划勾选完成项；交付修改文件、实际验证结果与词义覆盖限制。

## 验收记录

- 全量 `npm test`：48 个测试文件、346 项测试全部通过。
- `npm run build`：TypeScript 和 Vite 构建通过；仍有超过 500 kB 的 chunk 警告。
- `npm run lint`：退出码 0；工作区原有的 hooks、voice 等警告仍在，未为此进行无关重构。
- `git diff --check`：退出码 0；Git 提示现有 Windows LF/CRLF 转换。
- 独立只读审查发现并修正：同中文不同英文定义误合并、旧义项错误匹配、英文归档义项补中文后重复、补空字段未生效、无语境多义项出题歧义。回归测试覆盖，最终复审未发现上述问题继续存在。
- 桌面浏览器 DOM 验证：budget 归并为一个词条，展开后保留个人预算和企业预算两个义项及独立操作。
- 未完成：浏览器截图工具超时，手机视觉验收未完成；AI 出题/判分仅验证请求约束及模拟响应，未调用真实付费 AI 服务。
- 未运行 `seed:pack`，未批量补全内置词库，未提交或发布。词义覆盖以用户点击查词时来源返回的内容为准。