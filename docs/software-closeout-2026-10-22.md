# 非真机软件收尾：2026-10-22

范围为浏览器关键流程、三系统 CI、加载代码体积和 lint 整理。基于 `38f2e2a`；词库内容修订仍为 `5.3.2`，没有修改词库、凭证或用户原站点数据。本轮不申请麦克风、不调用收费 AI、不推送或部署。

## 改动与用途

| 文件／模块 | 结果 |
| --- | --- |
| `e2e/critical-flows.spec.ts`、`playwright.config.ts` | Chromium 测试完整生产资源；覆盖首次／再次启动、完整回忆与重开、义项隔离、备份实际下载与恢复，以及可选页面按需加载 |
| `e2e/server.mjs` | 复制生产资源和服务运行文件到独立临时目录；不复制环境文件。由 Playwright setup 返回 teardown，等待子进程退出再清理目录，修复 Windows wrapper 被强杀时遗留目录的问题 |
| `.github/workflows/ci.yml` | Ubuntu、Windows、macOS 三平台矩阵；每个平台运行 lint、单测、构建、分享包与 Chromium 测试，失败保存报告 7 天 |
| `src/App.tsx` | 用 `lazy`／`Suspense` 按需加载添加、词库、训练、语音、设置模块；保留导航与加载状态 |
| App 统计与回归 | 修正“近 7 天”统计只按日期缓存的问题：现在在现有分钟时钟刷新时，越过七天边界的样本会移出统计，不必等待午夜或新作答 |
| worker、语音请求与计时器 | worker 使用一次性事件监听，包装请求错误保留 cause；保存回调 ref 在 commit effect 更新，避免未提交渲染改变回调 |
| `vite.config.ts`、TypeScript 配置 | 单测与 E2E 分开收集；限制两个 jsdom worker，减小完整词库测试的并发 CPU／内存竞争；生产构建同时检查 E2E 和 Playwright 配置的类型 |

E2E 通过界面作答、编辑、下载和导入，仅用只读 IndexedDB 查询核对结果。整个词库在浏览器内计算规范化 SHA-256，避免把数万条完整记录发送到测试进程和 trace。对象属性按键排序、数组顺序保留；这使备份 JSON 与 IndexedDB 的属性枚举顺序差异不会造成误报，内容、记录 ID 和关联仍须一致。义项编辑同时检查其他义项的 ID 和内容；备份恢复先确认本地数据确实发生变化。

## 性能测量

相同 Windows 机器、Playwright Chromium 156、本机生产服务、完整词库；空浏览器上下文首次打开，再在同一上下文刷新。数字为单次本地观测，受磁盘、CPU 和后台负载影响，不是设备性能承诺。

| 指标 | 修改前 | 最终相对路径分享构建 |
| --- | --- | --- |
| 主入口 JS（构建文件字节，未 gzip） | 825,500 bytes | 471,227 bytes |
| 首屏 JS 合计（含入口依赖） | 825,500 bytes | 685,314 bytes |
| 最大单个 JS chunk | 约 825.50 kB | 约 471.22 kB |
| 首次启动至首页 | 13.31 秒 | 16.65 秒 |
| 同库刷新至首页 | 2.44 秒 | 2.73 秒 |
| 词库打开、搜索并进入详情 | 1.21 秒 | 1.24 秒 |

首屏 JS 减少约 **17%**；主入口拆分后减少约 **43%**，不再出现超过 500 kB 的 chunk 提示。训练等模块在进入对应功能时加载，E2E 检查语音模块在首页未请求、进入语音页后才请求。计时结果没有证明本机冷启动改善；完整词库初始化仍是可见耗时，不能把拆包收益换算成同等百分比的启动速度。没有修改词库初始化、学习排程或统计门槛来缩短测量。

## 验证与复核

- `npm test`：61 个文件、**447** 个测试通过。七天统计回归先复现失败，再修正通过；语音请求 cause 回归同样先失败后通过。
- `npm run test:e2e`：**4** 个生产资源浏览器流程全部通过，覆盖完整回忆、义项编辑、备份恢复与首次／再次加载。随后按复核意见补强 FSRS 断言：逐个作答关联检查 track 存在且 reps 等于作答次数；该流程单独重跑通过，避免空 tracks 的假阳性。
- `npx tsc -b`：应用、E2E、Playwright 配置类型检查通过。
- `npm run lint`：0 errors，保留 **70** 条已逐项复核的 warning，原范围为 97 条；E2E 和配置文件新增检查范围没有 warning。详见[完整清单](lint-review-2026-10-22.md)。没有全局关闭规则。
- `npm run share:export`：TypeScript 与相对路径生产构建成功，无大 chunk 提示。
- `npm run share:check -- --skip-build`：解压、7,503 条词库与 7,642 条成员关系、凭证排除、入口、词典资源、语音配置接口、异常 URL 隔离全部通过。
- `npm run seed:quality`：0 hard failures、0 warnings；`npm run seed:validate-sense`：0 hard findings、0 collisions，保留原有 27 条已复核 soft findings。
- actionlint **1.7.12** 对三平台 workflow 静态检查通过；工具来自官方发布包并核验 SHA-256。矩阵、安装 Chromium 与报告输入按[GitHub workflow 文档](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)、[Playwright CI 文档](https://playwright.dev/docs/ci)、[upload-artifact v4 接口](https://github.com/actions/upload-artifact/blob/v4/action.yml)核对。
- 独立只读复核确认测试隔离、义项保护、备份变更前提、lazy 边界与 worker 生命周期；指出的 Windows 临时目录泄漏、七天统计缺依赖和 FSRS 断言假阳性均已修复，补充复核未发现剩余 P1／P2。

## 本地交付

目录：`C:/Users/84754/Downloads/Recall-English-software-closeout-2026-10-22-verified/`。没有覆盖前一份交付目录。

| 文件 | SHA-256 |
| --- | --- |
| recall-english-v53-share-2026-10-22.zip | `55edcd4d2c302760d07041210c070a3e2ff914b4539b607de12753d6eaf3ed43` |
| recall-english-vocabulary-v53-2026-10-22.zip | `f4a55f432ab733c73fc7c31306af82a55dcc39cdf9674136ec85380ae0a92bfa` |

最终分享 ZIP 的 **13** 份 JS／CSS 逐份计算 SHA-256，与构建目录一致；包内没有真实环境凭证文件。

## 验收边界

远端三平台 CI 尚未触发；本轮只确认配置正确及本机 Windows 命令结果。需在推送或 PR 后以实际 Actions 结果确认 Ubuntu／macOS runner。麦克风、扬声器、噪声及 macOS Finder／权限提示仍按[实机任务单](runtime-acceptance-2026-10-22.md)验收，未标记完成。

早期 Windows wrapper 测试留下的 5 个 `recall-e2e-*` 临时目录仍保留。自动审批拒绝删除，仅返回 `blocked by policy`，未给出具体原因；没有改用其他方式删除。新版 setup／teardown 的测试运行已确认不再新增遗留目录，并释放测试端口。
