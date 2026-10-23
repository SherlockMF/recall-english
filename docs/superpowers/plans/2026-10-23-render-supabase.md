# Render + Supabase Implementation Plan

> 执行方式：按可独立验证的任务落实，测试先于行为实现；新分支 codex/render-supabase。用户已同意设计，继续实施，无需重复设计审批。

**Goal:** 实现已确认的邀请登录、私有数据同步、托管 AI/语音及 Render 部署配置。

**Architecture:** 本地版继续使用现有 App。云版本先通过 Supabase Auth 登录，再选择账号数据库；增量由 outbox 与 revision RPC 同步。Render 服务为付费接口验证用户，并隔离语音会话。

**Tech Stack:** React 19、Vite、TypeScript、IndexedDB/idb、ts-fsrs、Supabase JS、Node.js；使用 PGlite 在本机验证 PostgreSQL 迁移及 RLS。

## 约束与接口

- 不读取真实凭证，不部署或覆盖现有 DNS；不修改 artifacts/。
- 新增 cloud dependency 仅 @supabase/supabase-js，SQL 测试 dependency 为 @electric-sql/pglite。
- 同步集合固定为 words/lists/memberships/tracks/attempts/timeEntries/settings。
- RPC cloud_pull(p_after_revision bigint) -> {revision, changes:[{collection,id,data,revision}]}，data=null 表示删除。
- RPC cloud_apply(p_expected_revision bigint,p_changes jsonb) -> {revision}，冲突 SQLSTATE 40001；每批最多 200 条。
- 服务端额度 RPC reserve_usage(p_user_id uuid,p_kind text,p_request_id uuid) -> {allowed,remaining}，仅 service_role 可调用。kind 为 deepseek/voice_session/voice_message。
- 生产 createVoiceHandler 增加 productionOrigin，验证过的 req.authUserId 按用户隔离；GET config 可读，PUT/DELETE config 生产拒绝。

## Task 1: 数据库与权限

- [x] 创建 supabase/migrations/202610230001_cloud.sql，表、索引、成员 RLS、CAS 增量及额度 RPC。
- [x] 先写 scripts/cloudDatabase.test.ts，执行 npm test -- scripts/cloudDatabase.test.ts，观察未实现功能失败。
- [x] 实现并验证本人读写、停用成员拒绝、跨用户关联拒绝、原子 CAS、删除传播和额度并发。
- [x] 提供 scripts/seedCloudWords.mjs，使用环境中的管理员密钥分批导入内置共享词条；输出仅数量。

## Task 2: 生产服务

- [x] 先写 scripts/productionServer.test.ts，覆盖未登录、跨域、禁用用户、代理白名单、生产凭证写入拒绝。
- [x] 创建 scripts/productionServer.mjs；验证真实 Supabase 用户身份，固定上游、限制 body/超时、服务端 DeepSeek Key。
- [x] 更新 qwenVoiceServer.mjs 与 qwenVoiceMessages.mjs：productionOrigin、req.authUserId 隔离、并发和资源清理；保留本机测试。
- [x] 运行 npm test -- scripts/productionServer.test.ts scripts/qwenVoiceServer.test.ts scripts/qwenVoiceMessages.test.ts。

## Task 3: 账号与请求

- [x] 先写 src/lib/apiFetch.test.ts、src/components/CloudApp.test.tsx，验证 token 注入、登录门禁、无注册、账号数据库隔离。
- [x] 新增 cloud/config.ts、client.ts、CloudApp.tsx 和 apiFetch.ts；main.tsx 按构建配置懒加载云入口。
- [x] API 请求使用 apiFetch；托管模式 SettingsDialog 和 VoiceServiceStatus 仅显示服务状态，本机版保留凭证配置。

## Task 4: 持久同步

- [x] 先写 cloud/merge.test.ts 与 cloud/storage.test.ts，验证事务 outbox、账号隔离、幂等、并发复习、删除/编辑冲突、累计时长。
- [x] 扩展 db.ts：账号 scope、同步元数据 store、事务追踪；recordReview 保存 desiredRetention 和 baseline。
- [x] 实现 cloud/merge.ts、storage.ts、sync.ts：CAS、失败保留队列、分页提交、恢复远端记录、暂停训练时应用同步、冲突选择。
- [x] App 在初始化结束后启动同步并显示同步状态，账号切换卸载 App 和停止请求；备份导入继续作用于当前账号。

## Task 5: 部署与验证

- [x] 更新 package.json、.env.example、render.yaml，新增 docs/deployment.md，记录邀请/SMTP/DNS/备份/回滚步骤。
- [x] 运行针对性测试，再运行 npm run lint、npm test、npm run build 和相关 Playwright 流程。
- [x] 对最终差异做权限与数据丢失审查；真实 Supabase、SMTP、供应商和 DNS 未配置时明确列出尚未验证项。

## 验证记录

- 完整 Vitest：72 个测试文件、508 项通过。最后的 secret key 修复另跑种子导入与生产服务 16 项通过。
- TypeScript / Vite build 通过；lint 退出码 0，仍有警告；git diff --check 通过。
- 现有 Playwright 4 条端到端流程通过；共享包检查通过；seed dry-run 为 7503 条。
- Render Blueprint 已按官方 schema 验证。本地云登录页已检查；PGlite 验证数据库与同步，不能代替真实 Supabase。
- 真实 Render、Supabase、SMTP、DNS、AI/语音凭证和线上验收尚未配置或执行；没有发布、推送、发送邀请或修改 DNS。

## 云端配置进度（2026-10-23）

- 用户已新建 `lomivex`，项目 ID 为 `quedoinbjofdqsiolegq`，地区 `ap-southeast-1`，状态 Healthy；原美国东部项目未修改。
- 经用户执行前确认，在新项目执行同一迁移文件，SQL Editor 返回 Success。只读验收确认 12 张业务表全部启用 RLS，匿名用户没有表访问权限，三个 RPC 的执行权限符合设计。
- 已关闭公开注册并刷新验证；匿名登录保持关闭，邮箱确认保持开启。
- Auth Site URL 已保存为 `https://lomivex.top`，精确回调为 `/auth/invite` 和 `/auth/update-password`，刷新后确认共 2 条。
- 用户已选择 7503 行、约 10.7 MB 的 CSV，核对预览后通过 Table Editor 完成导入。云端只读 SQL 确认记录数、唯一 ID 数和有效 JSON 对象数均为 7503。
- 自定义 SMTP 尚未配置；Render 停在注册邮箱验证页面，尚未创建或发布服务，DNS 和 AI/语音凭证未配置。完整邀请、两账号同步、供应商调用与备份恢复仍待线上验收。
- 源码发布使用 `codex/render-supabase` 分支；现有 GitHub 仓库 `SherlockMF/recall-english` 为公开仓库，推送前需用户确认。当前尚未推送，不改远端默认分支。
