# 产品完整度改进

## 发布范围

2026-10-31 用户授权部署除额度管理以外的改进。主域名将用于其他网站，本次移除未发布的旧域名迁移页面，仅发布到现有英语服务。

1. 首次引导：选择场景、起始词级、每日表达数量和口音；新用户第一课最多 3 个表达，可跳过、重开。完成状态随备份与账号同步保留。
2. 口语复习：实时逐句纠错和两种模式的课后反馈支持确认英文、中文意思后加入优先学习；复用 FSRS、备份与同步，重复保存不重置进度，不生成掌握证据。
3. 学习成果：首页突出今日练习和下一步，长期指标与统计依据收进详情。
4. 账号数据：设置中提供账号与同步状态、密码重置、退出、数据流向和删除申请；本地模式清除需要明确输入确认。云端删除仍由管理员核实处理。

本次不改服务额度、积分、计费和模型用量统计；额度草案不包含在发布提交中。不改 DNS、凭据或数据库结构。

## 文件

- 引导：`src/App.tsx`、`src/components/OnboardingDialog.tsx`、`src/lib/onboarding.ts`、`src/domain/types.ts`、`src/lib/db.ts`、`src/lib/backup.ts`。
- 口语：`src/components/VoicePractice.tsx`、`src/components/VoiceMessages.tsx`、`src/components/VoiceTurnFeedback.tsx`、`src/components/VoiceFeedbackReview.tsx`、`src/components/SaveVoiceExpression.tsx`、`src/lib/voice/review.ts`。
- 首页与账号：`src/components/TodayView.tsx`、`src/components/SettingsDialog.tsx`、`src/components/AccountDataSection.tsx`、`src/components/CloudApp.tsx`、`src/styles.css`。
- 测试：`src/App.test.tsx`、`src/components/CloudApp.test.tsx`、`src/components/ProductFlows.test.tsx`、`src/lib/onboarding.test.ts`、`src/lib/voice/review.test.ts`。
- 文档：`README.md`、`docs/deployment.md`、本记录。

## 验证与边界

2026-10-31 发布前验证：Vitest 76 文件、575 项全部通过；生产构建成功；lint 退出 0（有现有警告）；学习、词条编辑、备份恢复等 4 条端到端测试通过；`git diff --check` 通过。此前已通过桌面及 390px 手机首课、设置和口语保存表单检查。

未使用真实付费模型、生产邮件投递或双设备同步进行本轮验收。新设置字段沿用现有 JSON 设置表；发布后旧页面应刷新，避免旧版严格校验拒绝新字段。完整口语录音与会话仍仅存页面内存，仅主动选择保存的表达进入复习与云同步。首次全量词库初始化的等待时间仍需后续优化。
