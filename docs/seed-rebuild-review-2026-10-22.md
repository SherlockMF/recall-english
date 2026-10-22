# 种子重建一致性验收：2026-10-22

内容修订 **5.3.2** 解决全量 `seed:pack` 与发布资产不一致的问题。逐项复核原先多出的 100 个源词条后，94 条同义改写与已有手写义项去重，6 条真正不同的义项保留。另有 4 条继续由原来的英文定义精确匹配去重。

结果：bundled **7,263** 条 + 手写 **240** 条 = 完整种子 **7,503** 条；bundled memberships **7,395** 条，完整 memberships **7,642** 条。原有 7,257 条 bundled 内容逐项完全不变，只新增 6 条和对应的 7 个成员关系，没有删除、改写或重排旧条目。

## 根因与修复

原有去重函数只识别词头、词性标签和英文定义完全相同的条目。同一个义项的同义改写，以及 `noun phrase` 与 `plural noun` 等标签差异没有被识别；更早发布的资产则使用了另一套按词头筛除的结果。这使全量重建额外产生 100 个词条，其中也包含应保留的不同义项。

本次没有放宽为词头或中文相同就合并：

- `data/vocabulary-packs/handcrafted-overlap-review.json` 保存全部 100 条人工决策、理由及 source/canonical 语义快照。`budget` 明确对应企业预算，不匹配个人预算。
- `scripts/lib/handcraftedSenses.mjs` 仅对对应源 ID 应用决策，并验证两边的表达、词性、中文、英文定义；手写目标必须恰好匹配一条。定义变化、目标消失或出现歧义时报错。
- `scripts/buildBundledSeedPack.mjs` 读取复核记录，拒绝重复复核 ID 或已经消失的源 ID，在写资产之前完成检查。未知义项仍使用原有严格匹配规则。
- 6 条保留内容在可信源词包中收窄为明确学习单位，并替换不成立的模板例句及搭配；运行构建器直接生成资产，没有手工投影或回填。

完整记录见[人工去重复核数据](../data/vocabulary-packs/handcrafted-overlap-review.json)。快照只绑定语义字段，修改例句不要求重新判断是否同义；改变定义等语义字段时应重新复核后更新记录。

## 保留的 6 条

| 表达 | 本次保留 | 已有手写义项 | 主要查核依据 |
| --- | --- | --- | --- |
| accrual | 应计确认过程 | 应计项目 | [政府会计术语表](https://www.cambridgeshire-pcc.gov.uk/SysSiteAssets/media/downloads/cambs-pcc/money-downloads/stat-acc-23-24/cc-final-accounts-2324.pdf) |
| attendance | 出勤记录 | 出席行为 | [Merriam-Webster](https://www.merriam-webster.com/dictionary/attendance) |
| deposit | 计入总价的定金／部分预付款 | 可退押金 | [Cambridge](https://dictionary.cambridge.org/us/dictionary/english/deposit) |
| discount rate | 央行贴现窗口贷款利率 | 计算现值的折现率 | [Federal Reserve](https://www.federalreserve.gov/monetarypolicy/discountrate.htm) |
| liquidity | 资产变现的难易程度 | 企业短期偿付能力 | [Fidelity 的资产流动性说明](https://www.fidelity.com/learning-center/trading-investing/liquidity) |
| transfer | 交通换乘 | 银行转账 | [Cambridge](https://dictionary.cambridge.org/us/dictionary/english/transfer?topic=travelling) |

定义为对应义项的自行概括，例句为项目编写，不是词典引文。例句不引用实际利率、路线或个案政策。`deposit` 不再接受押金为该义项的答案，央行 `discount rate` 不再接受折现率，`attendance` 不再以出勤率作为答案。

## 验证

- 新增回归先复现失败，再修正至通过：同义改写与不同词性标签去重、真多义保留、source/canonical 快照变化、目标歧义、源 ID 消失。
- 隔离目录复制构建所需文件，完整生成两次；两份资产均与发布文件逐字节相同，第二次与第一次一致。
- 升级回归验证 6 条只加入一次，既有 FSRS、个人编辑及曾导入的重复词条不被删除或覆盖；换乘与转账的中文判分保持区分。
- 定向测试：3 个文件、11 个测试通过。
- 全量 `npm test`：61 个文件、446 个测试全部通过。首次全量运行发现的 5 个旧数量断言已同步为 7,503 及对应分类数量，重新运行后通过。
- `npm run seed:quality`：7,263 条，0 hard failures、0 warnings。
- `npm run seed:validate-sense`：0 hard findings、0 collisions、27 soft findings，与上次已复核提示相同。
- `npm run lint`：exit 0，现有 warning 保留。
- `npm run build`：TypeScript 与 Vite 生产构建成功，主 JS 约 825.50 kB；大 chunk 提示仍存在。
- 分享包导出时重新运行相对路径生产构建，成功；主 JS 约 825.55 kB。
- `npm run share:check -- --skip-build`：解压、7,503 条词库与 7,642 条成员关系一致性、无凭证、应用入口、词典资产、语音配置接口及异常 URL 隔离全部通过。
- 最终交付 ZIP 中的两份 bundled 资产另行计算 SHA-256，与工作区发布文件完全一致；没有 `.env` 等凭证文件，仅含 `.env.example`。
- 独立只读复核确认 94/6 决策、语义保护条件及原有词条不变，未发现阻断问题。

资产 SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| bundledSeedWords.json | `62164020b6a65d0c7af032ea6e7e00f4f815fdd1fa51204a16aff56efa3188ce` |
| bundledSeedMemberships.json | `c2f3e869575c80cd2bd0819ade17c8395f06be03f05d2795f4759cb7b767528a` |

## 本地交付包

新包保存在 `C:/Users/84754/Downloads/Recall-English-5.3.2-2026-10-22-verified/`，没有覆盖之前版本：

| 文件 | SHA-256 |
| --- | --- |
| recall-english-v53-share-2026-10-22.zip | `4f69ab83b5aa21febea9c1357fb65f40378ad4c20f2b83dc14c56d04f9feb184` |
| recall-english-vocabulary-v53-2026-10-22.zip | `95674aa18e4282c61762b56227cb14bb7c3fa3bb3f3b6f0894629c5b3a76fb35` |

文件名沿用项目现有 `v53` 命名规则，分享包内部内容修订为 `5.3.2`。

## 维护与限制

完整重建使用 `npm run seed:pack`。修改源义项或手写义项后，若收到 `Sense overlap review ...` 错误，应先比较新旧语义，再更新相应决策及快照；不要关闭检查或扩大为中文／词头匹配。已有隔离重建测试在 `npm test` 中运行，会检查生成器与已提交资产是否漂移。

没有自动清理历史本地词条；即使某个源 ID 不再进入新种子，用户原有导入、编辑和学习记录仍由现有数据库保护逻辑保留。已受个人编辑保护的本地内容不会被本次修订强制覆盖。

本轮没有运行远端 GitHub CI、macOS 启动或真实麦克风验收，也没有再次调用收费 AI 服务。lint 与大包提示继续保留。
