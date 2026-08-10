# Recall English

一个本地优先、无选择题的主动回忆英语学习网页。内容面向马来西亚大学生活、金融会计与创业商业场景。

## 运行

```bash
npm install
npm run dev
```

Vite 会输出本地访问地址。首次打开会把 240 个初始义项写入浏览器 IndexedDB（统一 `words` 表，并归入 Daily / Business / Finance / Accounting；其中原金融种子已拆分，部分词可同时属于 Finance 与 Accounting）。

## 验证

```bash
npm test
npm run build
```

## 学习方式

- 每日先复习到期内容，再加入少量新表达。
- English → 中文、中文/场景 → English、真实使用分别记录进度。
- 正式训练不显示选项；使用提示或揭示答案会缩短下次间隔。
- `FSRS` 默认按 90% 目标保持率安排复习。
- 自定义词汇可使用 Free Dictionary API 补充英文释义、音标与音频；查询结果只缓存到 `dictionaryCache`，只有加入「我的词库」或正式导入时才写入学习词表。
- 词条支持 UK / US 发音：优先词典音频，缺失时回退到浏览器 Web Speech（`en-GB` / `en-US`）。
- 可选 DeepSeek V4 Flash：设置页填写 API Key 后，支持语义判分与反馈、分层提示、词条 AI 补全、usage 题懒生成；未配置或失败时回退本地规则。Key 存在 `localStorage`，不进入备份。

## 数据

学习进度只保存在当前浏览器。设置页可以导出或导入 JSON 备份，也可以请求浏览器提供持久存储。清除站点数据会删除本地进度与 API Key，请定期备份。
