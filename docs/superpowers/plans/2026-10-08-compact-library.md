# 紧凑词库与义项浮窗 Implementation Plan

> **For agentic workers:** 使用 executing-plans 在当前已授权工作区实施；保留既有修改，不提交、不发布，不新建工作树。

**Goal:** 落实用户选择的“小卡片与浮窗”设计，提高词库密度，独立查看与操作每个义项。

**Architecture:** LibraryView 保留搜索、场景、难度与已会筛选。卡片预览最多三个中文义项；点击打开 WordEntryDialog，浮窗始终读取当前完整词条，按 Word.id 切换内容和操作。学习摘要显示三种练习状态，LearningEvidenceDetails 的 compact 模式去除重复说明，详细规则及最近记录按需展开。旧数据库、排程、学习证据和 App 回调保持不变。

**Tech Stack:** React、TypeScript、现有 portal/focus-trap、CSS、Vitest。

## Global Constraints

- 只改变词库呈现及必要的组件/集成测试，不改变词义保存、每日排程或进度模型。
- 英文左侧放大，中文义项右侧较小；卡片不包含例句、依据长文或训练操作。
- 完整浮窗可查看全部义项；缺中文不能训练，补全失败要在浮窗提示；新增义项不撑大卡片。
- 编辑、双口音发音、例句播放、暂停/恢复、优先学习、自报已会继续针对当前义项。
- 浮窗支持 Escape、遮罩关闭、焦点约束与恢复；窄屏义项排列改为换行按钮，操作文字不溢出。
- 不增加依赖，不发送新的外部请求，不覆盖用户已有的 voice、difficulty 等工作。

## Task 1: 行为回归先行

Files: src/components/LibraryView.test.tsx、src/components/LearningEvidenceDetails.test.tsx、src/App.test.tsx。

- [x] 新增/调整测试：列表不展开详情，点击义项打开对应浮窗；切换后更新例句、证据和操作目标；超过三个义项可全部选择；搜索后的浮窗仍有完整词条；更新或补全后保持选中的 ID；错误提示、缺中文禁用、编辑与关闭焦点兼容。
- [x] 核心断言：`expect(screen.queryByRole('dialog')).not.toBeInTheDocument()`；打开后 `within(screen.getByRole('dialog'))` 检查当前例句及 `onToggleStatus` 的 Word.id。
- [x] 执行 `npm test -- src/components/LibraryView.test.tsx src/components/LearningEvidenceDetails.test.tsx`，确认新行为失败。
- [x] 将 App 集成操作改为先打开词条，再从浮窗进行训练/已会/编辑，继续验证数据库记录没有被重置。

## Task 2: 紧凑卡片与义项浮窗

Files: src/components/LibraryView.tsx、src/components/WordEntryDialog.tsx、src/components/LearningEvidenceDetails.tsx、src/styles.css。

Interfaces: WordEntryDialog 接收 `entry: WordEntry`、`item: VocabularyItem`、`evidenceByItemId: ReadonlyMap<string, LearningEvidence>`、`onSelectSense(id: string)` 和既有义项操作回调。LibraryView 用选中 ID 查找当前数据；编辑时临时切换到既有 EditWordDialog，完成后回到选中的义项。

- [x] 卡片采用 `entry.senses.slice(0, 3)` 有界预览；若当前选中义项不在前三级，以其替换第三个预览，不改变词条数据。
- [x] 新组件通过 `createPortal(dialog, document.body)` 展示，沿用 `useEscapeToClose`、`useFocusTrap` 和既有 body 滚动锁定方式。
- [x] 浮窗使用完整词条义项列表、当前定义/例句、学习摘要；所有异步操作统一 busy 状态，catch 后给出具体失败信息。
- [x] `LearningEvidenceDetails` 增加 `compact?: boolean`，默认呈现兼容原调用；compact 模式合并相同缺失条件、仅展示最近五条证据记录，不重复方向说明。
- [x] 根据实际多义项可读性反馈，卡片调整到约 176–200 px 高，桌面三列、平板两列、手机一列；窄卡片使用上下排列。浮窗高度随视口约束，按钮使用内容宽度与 nowrap，长内容可滚动。
- [x] 运行 Task 1 测试及 `npm test -- src/App.test.tsx`，要求通过。

## Task 3: 验收与文档

Files: README.md、本计划。

- [x] 用隔离本地浏览器页面验证实际卡片密度、义项切换、训练操作、依据收起和 320/390 px 不横向溢出；不操作用户词库数据。
- [x] 执行 `npm test`、`npm run build`、`npm run lint` 和 `git diff --check`，记录真实结果。
- [x] 更新 README 的小卡片/浮窗用法和验收记录；交付实际变化与未验证项。

## 验收记录（2026-10-08）

- 小卡片、完整义项浮窗、当前义项操作、compact 学习依据、编辑返回均已完成；补全更新继续按 Word.id 保留选择。
- 红绿验证覆盖关闭时预览按钮被替换、保存时按钮禁用后的 Tab 约束、学习依据 summary 的原生键盘路径；修复 shared useFocusTrap 并复核，相关 12 项组件测试通过。
- 全套 `npm test`：48 个文件、355 项通过。最终 CSS 修改后 `npm run build` 再次通过；`npm run lint` 退出码 0，保留既有 warnings；`git diff --check` 通过，仅有 Git 换行提示。
- 隔离 origin `http://127.0.0.1:5177/` 实际浏览器：桌面四列，普通卡片约 134 px 高；长英文自然换行增高。budget 个人/企业义项切换同步对应例句；暂停并恢复企业义项成功，未操作用户 localhost:5173 的数据库。
- 390 / 320 px 宽的真实同源 iframe 页面验收：单列卡片、浮窗底部操作文字不溢出，正文可滚动，依据默认折叠。修复筛选组固有宽度及 html/body 320 px 最小宽度造成的窄屏横向滚动；最终 document.scrollWidth 与 clientWidth 相等。
- 浏览器截图通道此前持续超时，本次以实际 DOM、尺寸、交互断言验收，未取得最终截图。未提交或发布，既有构建体积和 lint 警告不在本次范围内。

## 可读性修订（2026-10-08）

- 用户截图显示单词被切成 abandon/ment、abnorma/l、depreciat/ion。实际测量四列布局中的英文区仅 120.73 px；修订为桌面三列及英文/中文 1.65:1，英文区 192.18 px。增加留白、中文字号及两行预览，卡片宽约 362.66 px、高约 198 px。
- 在用户截图相同 origin 127.0.0.1:5177 通过已有补全按钮查询前八个词条；七个成功，新增 31 个暂停义项：abandon +6、abandonment +5、abandonment cost +2、ability +2、abnormal depreciation +1、abolish +1、above +14。30-day terms 查询超时，保留原义项。未批量补全全库。
- 刷新后显示 7496 个词条、7528 个义项，新增内容持久化。实际 DOM Range 验证前八个卡片没有英文单词跨行切开；390/320 px 页面 scrollWidth 与 clientWidth 相等，320 px 卡片英文区改用全宽 245 px。
- 12 项相关组件测试通过；生产 build 通过（保留已有大 chunk 警告）；样式和文档 diff --check 通过。截图捕获仍在 fonts loaded 后超时，未声称已完成截图视觉检查。
- 保留词库预览页及 5177 本地服务，供用户查看补全后的真实排版；数据只通过已有词义保存流程写入浏览器，不写入项目种子。
## 问题复核与修复（2026-10-11）

- 搜索/场景/等级筛选只匹配部分义项时，卡片的「全部义项数」此前取自筛选结果，和浮窗不一致；改用完整词条索引计数，预览继续只显示匹配义项。
- 自定义场景词补全时，my-vocabulary 被映射成 daily 且没有传递场景备注，导致新增义项误归日常生活；现在保留自定义场景及备注。集成测试验证原内容和 tracks 不变，新增义项仍暂停。
- 在旧保存 pending 时取消并重新打开相同义项编辑，旧 Promise 返回会关闭新窗并丢弃新草稿；编辑状态现在用独立会话对象，保存完成只关闭属于自己的编辑会话。
- above 的 15 义项实际浏览器复现：选末项后正文标题被共同滚动至视口外。改为义项导航和正文各自滚动；手机导航限高，保留正文与底部操作空间；切换义项会复位正文滚动位置。
- 320 px 浮窗标题仍把 abnormal / depreciation 切开；手机标题现在占完整一行，发音和关闭操作另起一行。
- 三个逻辑问题先以回归测试确认失败，修复后相关测试通过。全套 npm test：48 文件、357 项通过；最终 npm run build、npm run lint、git diff --check 通过，仍有既有 lint 和大 chunk 警告。
- 浏览器验收使用既有 127.0.0.1:5177 数据，只读取与切换义项，不再查词或改训练状态；桌面和 320/390 px 检查滚动、标题及底部操作。未执行截图捕获，不将尺寸断言表述为截图视觉验收。