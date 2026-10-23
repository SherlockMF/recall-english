# Supabase 数据库

在新 Supabase 项目的 SQL Editor 中执行 `migrations/202610230001_cloud.sql`。迁移由一个事务包裹；本地测试使用 PGlite 执行同一文件，不依赖 Docker 或 `pgcrypto`。首次生产执行前仍需在真实 Supabase 项目验证 Auth、PostgREST 和邮件流程。

## 邀请与账号启用

先在 Authentication 中关闭公开注册、匿名登录，配置 SMTP、Site URL 和明确的回调 URL，然后使用 Dashboard 的邀请功能。邀请用户后，在 SQL Editor 中执行以下语句，将示例邮箱替换为受邀用户的邮箱：

```sql
insert into public.app_memberships(user_id)
select id from auth.users where email = 'invited@example.com'
on conflict (user_id) do update set active = true;
```

仅受控管理端或 SQL Editor 管理成员及额度。用户无法自行创建成员资格或修改 `active`、额度。停用后，其 RLS 数据访问和同步 RPC 均被拒绝；服务端也必须为每个付费请求检查成员状态。

```sql
update public.app_memberships
set active = false
where user_id = (select id from auth.users where email = 'invited@example.com');

update public.app_memberships
set daily_deepseek_limit = 100,
    daily_voice_session_limit = 30,
    daily_voice_message_limit = 100
where user_id = (select id from auth.users where email = 'invited@example.com');
```

## 表与权限

| 表 | 用途 | authenticated 权限 |
| --- | --- | --- |
| `app_memberships` | `user_id`、`active`、三种每日额度 | 仅读取自身启用中的记录 |
| `profiles` | `user_id`、`display_name`、`timezone` | 启用成员读写自身普通资料 |
| `words` | 固定 ID 的共享词条，`id` + `data` | 启用成员只读 |
| `user_words` | 用户完整词条覆盖及新增词条 | 启用成员读取自身，通过 RPC 写入 |
| `vocabulary_lists` | 词表 | 同上 |
| `word_list_items` | 词表归属 | 同上 |
| `learning_tracks` | FSRS 状态 | 同上 |
| `review_attempts` | 作答事件 | 同上 |
| `study_time_entries` | 学习会话累计时长 | 同上 |
| `user_settings` | 学习设置 | 同上 |
| `cloud_revisions` | 每用户 CAS revision | 无直接权限 |
| `usage_events` | 请求 ID、类型、UTC 日期、预约结果、剩余额度 | 启用成员读取自身，无写权限 |

同步表均有 `(user_id, id)` 主键、`data jsonb`、`revision bigint`、`deleted boolean`。`data` 为原有 TypeScript 记录本体，不使用另一个包装格式。所有同步写入经过 RPC，避免绕过 CAS 和漏记 revision。用户隔离由 RLS 和 RPC 中的 `auth.uid()` 双重校验。`service_role` 是受信任管理身份，不能放入浏览器。

词表归属、轨道和作答具有生成的关联列。关联私有词时，外键同时绑定 `user_id`；关联未修改的内置词时，外键可以直接指向共享 `words`，不要求复制到 `user_words`。作答的 `(user_id, trackId, itemId)` 必须同时匹配轨道。引用字段必须是非空字符串，`data.id` 必须与同步 ID 完全一致。

FK 与活跃父记录检查均可延迟至事务结束，允许父子在同批写入或一起删除。跨批新增先传 `words/lists`，再传 `memberships/tracks`，最后传 `attempts`；删除反过来。删除父记录但保留活跃子记录会失败，已删除父记录不能接收新子记录。每批最多 200 条。

## RPC

`cloud_pull(p_after_revision bigint)` 使用登录身份，返回 JSON object：

```json
{"revision": 2, "changes": [{"collection": "settings", "id": "primary", "data": null, "revision": 2}]}
```

集合为 `words/lists/memberships/tracks/attempts/timeEntries/settings`。`cloud_pull(0)` 返回所有当前个人变更和墓碑，不重复返回共享词库。删除以 `data: null` 永久保留，不能随意清理；新设备也需要这些删除记录。大于云端 revision 的游标返回 SQLSTATE `40001`，不能把它视为已同步。

`cloud_apply(p_expected_revision bigint, p_changes jsonb)` 使用登录身份，接收上述集合的 `{collection,id,data}` 数组，成功返回 `{"revision": 3}`。非空批次把本用户 revision 增加一次；空批次不增加。CAS 不匹配返回 `40001`，参数校验失败返回 `22023`，非法关联返回 `23503`；整批失败时完全回滚。客户端应保留 outbox 并先拉取、合并后重试。

`reserve_usage(p_user_id uuid, p_kind text, p_request_id uuid)` 只允许 `service_role` 调用，返回 `{"allowed": true, "remaining": 99}`。`kind` 为 `deepseek/voice_session/voice_message`，默认每日 `100/30/100` 次，按 UTC 日期计算。锁定成员记录以串行处理同账号并发请求，相同 `(user_id, request_id)` 返回首次结果，不重复扣减；请求 ID 不能换一种类型重用。失败预约也保留结果，不存请求内容、答案、音频或供应商密钥。重试同一个上游操作应沿用同一个 request ID；新操作生成新 ID。

## 共享词库导入

检查本地固定词条数，不访问 Supabase：

```text
node scripts/seedCloudWords.mjs --dry-run
```

正式导入前，将 `SUPABASE_URL`（也支持 `VITE_SUPABASE_URL`）和 `SUPABASE_SECRET_KEY` 设置为进程环境变量，再执行：

```text
node scripts/seedCloudWords.mjs
```

工具复用 `loadSeedPackFromDisk`，包含手写核心词和 `public/data/bundledSeedWords.json`，每批 200 条，按 ID upsert；不会删除旧共享词。成功仅输出数量，失败不打印提供商响应或凭证。

`applyBundledDictionarySenses` 补充的义项不在 `loadSeedPackFromDisk` 的固定共享种子集合中，必须作为个人 `words` 在关联轨道之前同步，不能靠共享词预导入满足外键。历史本地库可能已经使用随机 UUID；应保留已有 ID，以保留用户学习记录。

本地验证：`npm test -- scripts/cloudDatabase.test.ts`。
