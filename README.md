# Recall English

本地优先的主动回忆英语学习网页：不靠选择题，用「想起再说出」巩固表达。

面向马来西亚大学生活、商业沟通，以及金融 / 会计专业场景。学习进度保存在当前浏览器（IndexedDB），可选 DeepSeek 辅助判分与补全。

| | |
| --- | --- |
| **产品名** | Recall English |
| **仓库** | `recall-english` |
| **npm 包名** | `recall-english` |
| **版本** | 0.1.0（词库 **V5.3**） |
| **技术栈** | React 19 · Vite · TypeScript · IndexedDB (`idb`) · FSRS (`ts-fsrs`) |

## 功能概览

- **三条学习轨道**：日常生活 · 商业英语 · 金融会计（词库内再分 Daily / Business / Finance / Accounting）
- **主动回忆**：English → 中文、中文/场景 → English、真实使用；正式训练不提供选项
- **每日共享预算**：默认 15 分钟、最多 5 个新表达；时长可设 5—120 分钟，新表达可设 0—100 个（0 表示只复习）。回忆与应用共用时间，可分多次完成
- **FSRS 复习**：默认按约 90% 目标保持率安排间隔；这是排程目标，不代表已达到的掌握程度
- **可解释的学习证据**：理解意思、主动表达、延迟保持与场景应用分别记录；在词库展开阶段标签可查看日期、提示、来源和缺失条件
- **内置词库**：**7497** 个义项（手写 240 + bundled 7257；V5.3 审计修复、不扩词）。seedContentRevision 变更时按 Word.id 刷新种子正文（FSRS track 保留）
- **查词与发音**：Free Dictionary API + 有道词典代理；UK / US 音频优先，缺失时回退 Web Speech
- **可选 AI**：设置页配置 DeepSeek API Key 后，支持语义判分、分层提示、词条补全、usage 题懒生成；开放造句需主动点击 AI 验证，每次提交最多请求一次。未请求或失败保留“待验证”（Key 仅存 `localStorage`，不进入备份）
- **导入导出**：词库合并导入、学习备份整库替换；可请求浏览器持久存储。可导入 pack **不含**顶层 `note`（说明在 `*.meta.json`）

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开 Vite 输出的本地地址即可。首次启动会把缺失的种子词写入 IndexedDB。

```bash
npm test                    # 单元 / 组件测试
npm run lint                # oxlint 静态检查
npm run build               # 生产构建
npm run seed:pack           # 从 trusted_v5_2 重建 public/data/bundledSeed*.json
npm run seed:quality        # 词库硬闸
npm run seed:validate-sense # 义项一致性（strict）
```

### 词库维护（V5.3）

生产 SoT：`data/vocabulary-packs/trusted_v5_2_vocabulary_pack.json` + `src/data/seedVocabulary.ts`。不要手改 `public/data/bundledSeed*.json`。

历史批次脚本（`seed:fix-p0` … `seed:fix-b8`、`seed:upgrade*` 等）已归档至 `scripts/archive/`，仅作追溯；日常维护只用 `seed:pack` / `seed:quality` / `seed:validate-sense`。总报告：`data/vocabulary-packs/v53-wrapup-report.md`。

种子词库以静态资源形式放在 `public/data/`，只在空库或 seedContentRevision 变化时按需加载，不进入 JS bundle。

时效性术语（SIBOR / OPIC / FHLBB / NAA）：**保留历史头词**，定义与中文标明历史地位及现行接替名称。

### macOS 桌面快捷方式

首次成功执行 `npm run dev` 后，会在桌面生成 `Recall English.command`：双击即可启动本地服务并打开网页；若服务已在运行则只打开网页。若需重新生成，删除项目根目录的 `.mac-desktop-shortcut` 后再启动一次。

## 项目结构（简要）

```
src/
  components/   # 今日学习、词库、添加、设置、学习会话
  data/         # 种子词（手写部分）、列表定义
  domain/       # 领域类型
  lib/          # DB、调度、词典、备份、发音、词包等
public/data/             # 打包词库 JSON（按需加载的静态资源）
data/vocabulary-packs/   # 词包源文件（需时 npm run seed:pack）
scripts/                 # 词包构建、质量闸、macOS 快捷方式等
```

开发服务器通过 Vite 代理访问 DeepSeek、Free Dictionary、有道，避免浏览器 CORS 限制。

## 学习与数据说明

- 首页与开始学习使用同一份 `DailyPlan`。先安排到期回忆、已解锁的应用及已引入表达未完成的方向，再按剩余时间安排新表达。
- 新词额度按每天首次引入的唯一义项计算，重试、另一方向、暂停词条或继续学习均不会绕过上限。
- 预计题量按回忆题 45 秒、应用题 120 秒组题；实际计时只记录前台、有焦点且可操作的学习和反馈时间，排除后台、暂停和阻塞等待。120 秒无操作会暂停；达到预算后完成当前题，再结束或主动继续 5 分钟。继续部分计入同一天，新词上限不变。
- 学习计时每 5 秒及暂停、退出时保存。跨午夜分别归入当地日期；异常关闭可能遗漏最后不足 5 秒，不推算离线时间。
- “表达数”“不同题数”“作答次数”分开：重试增加作答次数，不增加表达或不同题数。近 7 天延迟正确率要求距上次同方向练习至少 24 小时，排除首次学习、提示、自评、即时重试与未知结果；无提示主动揭晓记为失败。少于 10 个可判定样本时不据表现调整新词；正确率低于 65% 减至上限的 50%，低于 80% 减至 75%，其余不减量，均向下取整。
- “双向可回忆”要求两个方向均有无提示成功证据；“保持已验证”还要求各方向至少两次有效成功，后一次距离此前最近一次同方向练习至少 7 天，且都在最近明确失败之后。7 天是透明的产品门槛，不代表永久掌握。慢但正确不等于遗忘，到期和暂停也不抹除能力证据。
- 填空、自由造句分开验证。关键词或范句匹配不证明自由应用；AI 通过标明辅助来源，不推定其他场景的迁移能力。缺应用题不阻塞基础回忆阶段。
- 自定义词汇可先查词典缓存，只有加入「优先学习」或正式导入时才进入学习词表。
- **词库导出**：义项与分类归属；导入为合并，不覆盖学习进度。
- **学习备份 V3**：词条 + 进度 + 证据 + 时间账本 + 设置；导入会整库替换。继续支持 V1/V2 导入；旧版应用不支持新 V3 文件。
- **旧数据升级**：保留词条 ID、FSRS 与全部作答；旧 `coreMinutes` 迁入每日预算，`extensionMinutes` 不自动相加。旧作答缺乏可靠计时与来源，不回填时间或推定为已验证证据；因此新证据统计可能少于旧阶段统计，原有复习进度仍保留。
- 清除站点数据会删除本地进度与 API Key，请定期备份。

## 许可与隐私

本仓库默认按作者用途分发；API Key 与学习数据均留在本机，不会上传到本项目自身的服务器。使用第三方词典 / AI 服务时，查询内容会发往对应服务商，请自行遵守其条款。
