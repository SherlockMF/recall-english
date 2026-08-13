# Recall English

本地优先的主动回忆英语学习网页：不靠选择题，用「想起再说出」巩固表达。

面向马来西亚大学生活、商业沟通，以及金融 / 会计专业场景。学习进度保存在当前浏览器（IndexedDB），可选 DeepSeek 辅助判分与补全。

| | |
| --- | --- |
| **产品名** | Recall English |
| **仓库** | `recall-english` |
| **npm 包名** | `recall-english` |
| **版本** | 0.1.0 |
| **技术栈** | React 19 · Vite · TypeScript · IndexedDB (`idb`) · FSRS (`ts-fsrs`) |

## 功能概览

- **三条学习轨道**：日常生活 · 商业英语 · 金融会计（词库内再分 Daily / Business / Finance / Accounting）
- **主动回忆**：English → 中文、中文/场景 → English、真实使用；正式训练不提供选项
- **FSRS 复习**：默认按约 90% 目标保持率安排间隔；提示或揭示答案会缩短下次间隔
- **内置词库**：约 **996** 个高可信义项（手写核心 240 + V1 骨架 756；core/econ 已检疫待 V5.1+ 按需重建），可合并进已有本地库且不覆盖进度
- **查词与发音**：Free Dictionary API + 有道词典代理；UK / US 音频优先，缺失时回退 Web Speech
- **可选 AI**：设置页配置 DeepSeek API Key 后，支持语义判分、分层提示、词条补全、usage 题懒生成；失败时回退本地规则（Key 仅存 `localStorage`，不进入备份）
- **导入导出**：词库合并导入、学习备份整库替换；可请求浏览器持久存储

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开 Vite 输出的本地地址即可。首次启动会把缺失的种子词写入 IndexedDB。

```bash
npm test          # 单元 / 组件测试
npm run build     # 生产构建
npm run seed:pack # 从 data/vocabulary-packs/ 重建 bundledSeed*.json
```

### macOS 桌面快捷方式

首次成功执行 `npm run dev` 后，会在桌面生成 `Recall English.command`：双击即可启动本地服务并打开网页；若服务已在运行则只打开网页。若需重新生成，删除项目根目录的 `.mac-desktop-shortcut` 后再启动一次。

## 项目结构（简要）

```
src/
  components/   # 今日学习、词库、添加、设置、学习会话
  data/         # 种子词、列表定义、打包词库 JSON
  domain/       # 领域类型
  lib/          # DB、调度、词典、备份、发音、词包等
data/vocabulary-packs/   # 词包源文件（需时 npm run seed:pack）
scripts/                 # 词包构建、macOS 快捷方式等
```

开发服务器通过 Vite 代理访问 DeepSeek、Free Dictionary、有道，避免浏览器 CORS 限制。

## 学习与数据说明

- 每日优先复习到期内容，再加入少量新表达。
- 自定义词汇可先查词典缓存，只有加入「优先学习」或正式导入时才进入学习词表。
- **词库导出**：义项与分类归属；导入为合并，不覆盖学习进度。
- **学习备份**：词条 + 进度 + 设置；导入会整库替换。
- 清除站点数据会删除本地进度与 API Key，请定期备份。

## 许可与隐私

本仓库默认按作者用途分发；API Key 与学习数据均留在本机，不会上传到本项目自身的服务器。使用第三方词典 / AI 服务时，查询内容会发往对应服务商，请自行遵守其条款。
