# Render + Supabase 邀请制上线设计

用户已确认：lomivex.top、Render、Supabase、少量邀请用户，关闭公开注册。

生产使用 Singapore 单个常驻 Node.js Web Service，Node 22，构建 npm ci && npm run build，启动 npm start；本地开发和分享包保持原行为。配置 Supabase 的构建才启用邮箱邀请登录。浏览器按 user.id 隔离 IndexedDB；所有 API 验证用户及 app_memberships.active，生产不允许通过 UI 更改服务密钥。DeepSeek 与 DashScope 密钥仅服务端保存。

共享 words 由管理员导入；user_words 保存用户变更后的词条覆盖。其他云表为 profiles、app_memberships、vocabulary_lists、word_list_items、learning_tracks、review_attempts、study_time_entries、user_settings、usage_events。用户表使用 RLS 限制本人及 active 成员；管理员权限、额度仅受控服务端可写。旧文本 ID 保持，外键同时约束 user_id。同步表保存 payload JSONB 和可查询索引列；不改变现有备份字段。

本地读写与 outbox 同事务。云端通过 revision CAS 原子提交增量；持久 outbox 保存变更前值用于三方合并。删除用 tombstone 传播。作答按 ID 幂等；冲突保留所有事件，从共同基线按 reviewedAt、id 排序重算 FSRS，并保存 desiredRetention。无法安全自动合并的个人编辑保留本地和远端，显示冲突，用户选择后才能继续提交。累计时长按 session/date 取最大，不重复相加。同步过程使用浏览器 Web Locks，避免同账号多标签页竞争。退出/切换账号停止同步和语音后再切换数据库。旧 localhost 数据通过备份导入迁移，不自动认领到账号。

生产服务提供 /healthz、固定词典代理、/api/deepseek/chat/completions、既有语音接口。API 仅允许受信任 Origin，付费请求先验证权限并原子预约每日调用额度。语音消息每用户一个会话，会话归属不可跨用户访问；清理断开/空闲资源。实时 WebRTC 音频直连供应商，服务端不声称能强制按分钟断流。日志不保存密钥、完整学习内容、音频。

数据库迁移、RLS 测试、Render Blueprint、共享词库导入工具和部署运行手册随代码交付。域名、SMTP、实际项目、密钥配置及首次生产发布需要在账户后台执行。应用备份和数据库备份相互独立；平台免费额度不被当作生产备份承诺。
