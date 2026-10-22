# 人工复核任务单

以下是自动化测试覆盖不到、需要人工走查的事项，按优先级排列。
2026-10-22 补充：[130 条义项提示复核](vocabulary-review-2026-10-22.md) 已修正 93 条、保留 37 条，并记录全量种子重建额外产生 100 条的历史差异，后续需逐义项比较。
2026-10-13 补充：[项目稳定性验收记录](project-stability-acceptance-2026-10-13.md) 包含本次修复、435 个测试、分享包、备份恢复及真实 AI/语音调用证据。以下旧任务单中未完成的项目仍需走查。
最后更新：2026-10-07（对应分支 `codex/learning-budget-evidence`，提交 `8237323` 之后）。

## 1. 一次性冒烟走查（上线前做一次，约 15 分钟）

最近的改动多为行为保持型优化，206 个测试全绿，但以下路径值得真人点一遍：

- [ ] **全新安装路径**：清除站点数据后打开应用，确认种子词库正常写入、首页可开始学习（种子现在是按需 fetch 的，重点看首次加载）。
- [ ] **老用户路径**：不清数据直接刷新两次，确认二次打开不重新下载 12MB 词库（DevTools Network 面板不应出现 `bundledSeed*.json`）。
- [ ] **导出学习备份**：点导出能下载；取消下载后再看设置页不应出现「已备份」时间戳（lastBackupAt 现在只在真正触发下载后写入）。
- [ ] **导入学习备份**：确认整库替换后复习进度保留。
- [ ] **设置对话框**：Esc 能关闭（导入/导出进行中时 Esc 应无效）；Tab 键焦点被困在对话框内；关闭后焦点回到打开它的按钮。
- [ ] **学习计时**：开始学习后切到别的标签页再回来，确认计时没在后台累计；断网状态下 LLM 判分超时后能正常回退到规则判分并继续学习。
- [ ] **报错可见性**：可以临时断开 DeepSeek 网络再点 AI 相关功能，确认右上/下方出现 toast 错误提示而不是无反应。
- [ ] **渲染兜底**：如需验证 ErrorBoundary，可在 DevTools 里临时抛错，确认出现「应用遇到了问题」兜底页且「导出学习备份」可用。

## 2. App.tsx / StudySession 拆分（最大的结构性债，需人工回归）

现状：`src/App.tsx` 约 760 行（状态容器 + 业务 + 工具函数混杂），向 StudySession 传 20+ props；`src/components/StudySession.tsx` 约 760 行、24 个 hook，混合题目/反馈/预算/完成四种视图。

建议拆分顺序（每步一个提交，测试保持全绿）：

1. 把 App.tsx 里的纯工具函数（`buildUsagePrompts`、`slugify`、`makeId`、`stripHydration` 等，约 App.tsx 底部 80 行）抽到 `src/lib/`。
2. 抽 `addToMyVocabulary` / `toggleStatus` / `updateItem` 等词条 CRUD 到 `src/lib/wordActions.ts`（接收 db 句柄，返回纯数据操作）。
3. StudySession 按 phase 拆：`QuestionCard`（答题）/ `FeedbackCard`（反馈）/ `BudgetScreen` / `CompleteScreen`，计时器叶子组件已就位（`SessionClock` 等，保持在文件底部即可）。
4. App 状态用 `useReducer` 或分域 Context 收敛后再收窄 StudySession 的 props。

人工回归清单（拆完后必做）：
- [ ] 完整做一轮「回忆 → 反馈 → 提示 → 用题 → 完成」流程。
- [ ] 跨午夜场景：改系统日期或等跨天，确认学习计划按新的一天重建。
- [ ] 预算到达后的「结束 / 继续 5 分钟」两条路径。
- [ ] 词库页的暂停/恢复、编辑词条、加入优先学习。
- [ ] 备份导出→清数据→导入恢复全流程。

## 3. 补种不变式（未来加删词功能时必读）

`db.ts` 的 `getLibrarySeedStatus` 依赖「seedContentRevision 戳与种子写入同事务提交」这一不变式来跳过补种。
**如果将来实现删除词条功能（或允许导入「revision 相同但词条是子集」的备份），必须在删除/导入时使 revision 失效**（例如删词时把存储的 seedContentRevision 置空），否则缺失的种子词永远不会被补回。代码内注释见 `getLibrarySeedStatus` 的 docstring。

## 4. 有意保留、无需处理的记录

- `StudySession` 里 `speechAccent` prop → state 的镜像 effect：改成派生模式收益为零，保留现状。
- `no-array-index-key` 的 3 处复合键（词义选项、证据时间线）：时间戳/词义可能重复，index 是必要的去重后缀。
- LLM 判分的双层超时（evaluateAssist 2.5s 竞速 + chatJson 30s 兜底）：语义上是有意设计，已在代码注释说明。
- `backup.ts` 里 settings 对 V1 备份校验两次（一次断言、一次归一化）：每次导入多一次小对象校验，成本可忽略，改动收益低于 API 风险。
- oxlint 剩余 56 条警告均为有理由的保留项：`no-await-in-loop`（IndexedDB 顺序写入）、`no-underscore-dangle`（`_` 解构跳过约定）、`exhaustive-deps`/`refs`/`set-state-in-effect`（计时器等处已审查的刻意模式）、`consistent-function-scoping`、`no-shadow` 等。
