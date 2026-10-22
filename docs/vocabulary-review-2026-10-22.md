# 130 条义项提示复核：2026-10-22

后续进展：本文记录的 100 条重建差异已完成逐项复核，并在内容修订 5.3.2 解决；见[种子重建一致性验收](seed-rebuild-review-2026-10-22.md)。以下数量与限制保留为 5.3.1 当时的验收记录。

在内容版本 5.3.0 的 130 条提示上完成逐项复核：**93 个既有条目修正，37 条保留**。发布种子仍为 7,257 条，完整种子仍为 7,497 条。种子内容版本提升为 **5.3.1**，触发现有升级机制，保留个人编辑与学习记录。

## 问题与修改

- 纠正词性及义项错配，例如 somewhat 的程度副词、please 的礼貌请求用法、lean 的瘦肉名词、impress 的印象名词、task 的工作名词。
- 93 条均替换了对应例句及搭配；其中 45 条修正英文释义、15 条修正中文及答案、4 条修正词性。保留 ID、expression、lemma、senseKey、学习状态、优先级和词库成员关系。
- 去掉把活动当作文件归档的 bring/file 模板，以及将考虑或登记过程当作金额计算的搭配。其余语法成立但教学价值有限的元语言例句暂保留，不把它们定性为语法错误。
- 检查器此前把 the act of / the process of 当成动词定义，因此误报名词且漏报部分动词错配。现在区分这些名词结构与 to 开头的结构；保留对形容词错配的原有检查。

新释义是所选义项的自行概括，新例句为本项目编写，**不是词典原句**。罕见义项及专业概念查核了一手来源，例如 [Merriam-Webster 的 lean](https://www.merriam-webster.com/dictionary/lean)、[impress](https://www.merriam-webster.com/dictionary/impress)、[please](https://www.merriam-webster.com/dictionary/please)、[Marine Insurance Act 1906 的委付条款](https://www.legislation.gov.uk/ukpga/Edw7/6/41/2013-04-06/data.html)、[IFRS 3](https://www.ifrs.org/content/dam/ifrs/publications/pdf-standards/english/2022/issued/part-a/ifrs-3-business-combinations.pdf?bypass=on) 和 [DMO 的投标发行说明](https://www.dmo.gov.uk/media/n20pqriq/prosp100381.pdf)。各条目的来源链接和逐字段 before/after 见 [机器可读复核记录](../data/vocabulary-packs/sense-review-2026-10-22.json)。

balanced budget with surplus 保留原表达，按不出现赤字的广义 balanced 解释盈余，并删除原有倒装占位式定义；没有把它宣称为准则中的正式术语。这个广义用法可在 [Cambridge 的 balanced 条目](https://dictionary.cambridge.org/dictionary/english/balanced?topic=justice-and-fairness) 查核。cost accounting by products 保留按产品核算成本的语境，没有误改成 by-products 副产品核算；参考 [教育主管部门的成本会计教材](https://curriculumresources.edu.gh/wp-content/uploads/2024/09/Business-Studies-Manual-2.pdf)。

## 验证结果

- 新增回归先复现错误，再修正至通过：具体义项、错误搭配、内容版本升级保留个人编辑及复习记录、检查器误报与真正错配。
- npm run seed:quality：7,257 条，0 hard failures、0 warnings。
- npm run seed:validate-sense：0 hard findings、0 collisions、27 soft findings。
- npm test：59 个文件、439 个测试通过；测试清理路径检查调整后，4 个新增回归再次通过。
- npm run lint：exit 0，96 条现有 warning 保留。
- npm run build：TypeScript 与 Vite 生产构建成功，主 JS 825.50 kB；分享包相对路径构建为 825.55 kB，大 chunk 提示仍存在。
- npm run share:check -- --skip-build：实际生成、解压并启动分享包，7,497 条种子和 7,635 个 memberships 与当前文件一致，凭证排除、入口、字典资产、语音运行时及异常 URL 隔离均通过。另对正式交付 ZIP 中 bundledSeedWords.json 计算 SHA-256，与当前资产完全一致。
- share:export 和 vocabulary:export 均成功，分享包种子内容修订为 5.3.1，完整种子 7,497 条。并行执行两个导出进程时出现 Vite HMR 默认端口 24678 占用提示，但均 exit 0；本次未修改导出运行时，后续串行执行导出以避免该共享资源竞争。
- 独立只读复核确认：可信源和发布资产均只变更 manifest 中的 93 个旧 ID，没有新增、删除、重排或词头变更，memberships 与基线逐字一致。

## 生成器差异与后续边界

现行 seed:pack 的手写种子去重策略与已经发布的资产存在历史差异：全量运行会多生成 100 个词条。本次先用现有构建器生成，再只回填本次复核的 93 个已有 ID，保留已发布资产的规模和 memberships；其余 100 条未经本轮内容及去重复核，未混入本次更新。可信源仍为 7,361 条。

这意味着**全量重新生成与本次发布资产还不完全一致**。后续应单独比较这 100 条与手写种子的实际义项，确认哪些是重复、哪些确需保留，再统一生成策略。日常 build 和分享导出读取已提交 public 资产，不会自行加入这 100 条。未修改生成器默认行为以掩盖差异。

本轮未运行远端 GitHub CI、macOS 启动、真实麦克风验收，也未再次使用凭证调用收费服务。以上仍沿用上次验收记录的限制。

## 仍被检查器提示的 27 条

这些提示已复核保留。没有添加 ID 白名单或关闭相应规则，以便未来内容变化仍能被检查。

| 表达 | 提示 | 保留理由 |
| --- | --- | --- |
| non-current asset | example_missing_expression | 正常改述、复数或同条已展开的机构缩写 |
| non-current liability | example_missing_expression | 正常改述、复数或同条已展开的机构缩写 |
| ensure | def_short_trailing_function_word | 完整的字典式短释义，句末介词有其语法作用 |
| abolish | def_short_trailing_function_word | 完整的字典式短释义，句末介词有其语法作用 |
| defray | def_short_trailing_function_word | 完整的字典式短释义，句末介词有其语法作用 |
| amid | def_short_trailing_function_word | 完整的字典式短释义，句末介词有其语法作用 |
| suffer | def_short_trailing_function_word | 完整的字典式短释义，句末介词有其语法作用 |
| colleague | def_short_trailing_function_word | 完整的字典式短释义，句末介词有其语法作用 |
| approve | def_short_trailing_function_word | 完整的字典式短释义，句末介词有其语法作用 |
| relate | def_short_trailing_function_word | 完整的字典式短释义，句末介词有其语法作用 |
| obtain | def_short_trailing_function_word | 完整的字典式短释义，句末介词有其语法作用 |
| accompany | def_short_trailing_function_word | 完整的字典式短释义，句末介词有其语法作用 |
| oppose | def_short_trailing_function_word | 完整的字典式短释义，句末介词有其语法作用 |
| alter | def_short_trailing_function_word | 完整的字典式短释义，句末介词有其语法作用 |
| admire | def_short_trailing_function_word | 完整的字典式短释义，句末介词有其语法作用 |
| advertise | def_short_trailing_function_word | 完整的字典式短释义，句末介词有其语法作用 |
| entertain | def_short_trailing_function_word | 完整的字典式短释义，句末介词有其语法作用 |
| educate | def_short_trailing_function_word | 完整的字典式短释义，句末介词有其语法作用 |
| obey | def_short_trailing_function_word | 完整的字典式短释义，句末介词有其语法作用 |
| compose | def_short_trailing_function_word | 完整的字典式短释义，句末介词有其语法作用 |
| weaken | def_short_trailing_function_word | 完整的字典式短释义，句末介词有其语法作用 |
| evaluate | def_short_trailing_function_word | 完整的字典式短释义，句末介词有其语法作用 |
| comprise | def_short_trailing_function_word | 完整的字典式短释义，句末介词有其语法作用 |
| national association of accountants | example_missing_expression | 正常改述、复数或同条已展开的机构缩写 |
| overseas private investment corporation | example_missing_expression | 正常改述、复数或同条已展开的机构缩写 |
| federal home loan bank board | example_missing_expression | 正常改述、复数或同条已展开的机构缩写 |
| singapore inter-bank offering rate | example_missing_expression | 正常改述、复数或同条已展开的机构缩写 |

## 全部 130 条复核决策

| 序号 | 表达 | 决策 | 理由 |
| --- | --- | --- | --- |
| 1 | account management | 已修正 | 名词过程定义正确；替换泛化例句及不自然的 prepare/confirm 搭配。 |
| 2 | cost allocation | 已修正 | 名词定义正确；allocate the cost allocation 循环搭配不能示范成本分配。 |
| 3 | customs clearance | 已修正 | 名词定义正确；替换 ship against 等不成立的搭配。 |
| 4 | delivery | 已修正 | 名词定义正确；ship against the delivery 不自然，改为具体配送语境。 |
| 5 | enrolment | 已修正 | 注册入学过程不能 download，改为过程及截止日期的搭配。 |
| 6 | market entry | 已修正 | 替换把市场进入过程作为 prepare/confirm 直接宾语的泛化示例。 |
| 7 | non-current asset | 保留 | 第二例是非流动资产分类测试的正确改述，第一例已包含完整词头。 |
| 8 | non-current liability | 保留 | 第二例 liabilities 是 liability 的正常复数；第一例包含单数词头。 |
| 9 | quality control | 已修正 | 替换 prepare the quality control 等泛化搭配。 |
| 10 | stocktake | 已修正 | 盘点不是被 count/value/move 的货物，改为执行盘点。 |
| 11 | submission | 已修正 | submit the submission 与 download the submission 不适合所选提交行为义项。 |
| 12 | tax compliance | 已修正 | 税务合规不是税额，不能 compute/file/estimate the tax compliance。 |
| 13 | valuation | 已修正 | 定义和原搭配正确；原模型对估值假设的示例含混，改为估值对象和依据。 |
| 14 | visa renewal | 已修正 | 替换 use/remember the visa renewal 的泛化搭配，不增加具体签证规则。 |
| 15 | visitor registration | 已修正 | calculate/compare the visitor registration 误把登记过程当作数值。 |
| 16 | ensure | 已修正 | 短定义 make certain of 正确；原例句缺宾语或使用 risky option 等错误语境。 |
| 17 | acknowledge | 已修正 | 承认与确认收讫不是同一个义项。 |
| 18 | comparison | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 19 | arrival | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 20 | possession | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 21 | departure | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 22 | transportation | 已修正 | 移动人或货物对应运输，不是机器运转。 |
| 23 | acquisition | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 24 | accredit | 已修正 | 授予资格的正式认可义项应与例句及中文一致。 |
| 25 | admission | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 26 | abolish | 已修正 | do away with 是完整字典式同义释义；替换不合宾语要求的例句。 |
| 27 | procurement | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 28 | defray | 已修正 | bear the expenses of 正确；defray 的宾语应为费用。 |
| 29 | redeem | 已修正 | 履行契约/承诺与挽回名誉的定义不一致。 |
| 30 | intervention | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 31 | exploitation | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 32 | certification | 已修正 | 原定义混入 franchise 授权，改为认证的正式证明义项。 |
| 33 | enrollment | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 34 | demolition | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 35 | abandonment | 已修正 | 保留海上保险的委付义项，不能只定义为一般放弃。 |
| 36 | authorization | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 37 | amid | 已修正 | surrounded by 是有效介词释义，替换不能说明 amid 用法的示例。 |
| 38 | inwards | 已修正 | 副词不能以进口税作中文答案。 |
| 39 | cancellation | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 40 | cession | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 41 | underwriting | 已修正 | 保留保险业语境，定义为承保过程而非普通财务支持的动词。 |
| 42 | cover | 已修正 | 盖子是物体，不是遮掩行为。 |
| 43 | fight | 已修正 | 名词定义正确，但 bring/file the fight 与该义项不成立；替换相应模板例句与搭配。 |
| 44 | design | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 45 | visit | 已修正 | 名词定义正确，但 bring/file the visit 与该义项不成立；替换相应模板例句与搭配。 |
| 46 | contain | 已修正 | 包含的普通义项不是数学中的整除。 |
| 47 | please | 已修正 | 保留表示请的副词，删除使人高兴的动词定义。 |
| 48 | recognize | 已修正 | 认出不等于意识到某事，定义与例句对齐识别义项。 |
| 49 | suffer | 已修正 | undergo or be subjected to 是有效动词释义；原例句的宾语和搭配错误。 |
| 50 | travel | 已修正 | 名词定义正确，但 bring/file the travel 与该义项不成立；替换相应模板例句与搭配。 |
| 51 | progress | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 52 | colleague | 保留 | an associate that one works with 是完整的关系从句名词定义，with 的介词宾语由关系从句先行词补足。 |
| 53 | equal | 已修正 | 对手是名词，不能使用 be identical 的动词定义。 |
| 54 | secure | 已修正 | 保留无忧虑的形容词义项，不使用确保付款的动词释义。 |
| 55 | escape | 已修正 | 名词定义正确，但 bring/file the escape 与该义项不成立；替换相应模板例句与搭配。 |
| 56 | defend | 已修正 | 保护义项不能仅定义为发表辩护意见；替换混入另一义项的示例。 |
| 57 | approve | 已修正 | give sanction to 完整；示范 approve 和 approve of 的实际用法。 |
| 58 | except | 已修正 | 保留动词排除义项；原中文除与反对义项的英文混配。 |
| 59 | relate | 已修正 | give an account of 正确；交货日期和数字不宜直接套入讲述模板。 |
| 60 | obtain | 已修正 | come into possession of 完整；替换获得 risky option 的不成立示例。 |
| 61 | experiment | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 62 | journey | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 63 | capture | 已修正 | 捕获是抓住人或动物并控制的义项，与数据抓取区分；原定义错误地只涉及剥夺财产。 |
| 64 | passage | 已修正 | 通道是可通行的地方，不是状态转变行为。 |
| 65 | somewhat | 已修正 | 英文定义为程度副词，原词性 noun 和中文某物属于另一用法。 |
| 66 | accompany | 已修正 | go or travel along with 完整；陪伴的宾语应为人而不是 risky option。 |
| 67 | oppose | 已修正 | 定义正确；删除 oppose with the supplier 的错误介词搭配。 |
| 68 | alter | 已修正 | 定义正确；具体化改变的对象，移除不说明词义的模板。 |
| 69 | reckon | 已修正 | 计算/估算与 reckon with 的考虑义项混淆。 |
| 70 | discovery | 已修正 | 名词定义正确，但 bring/file the discovery 与该义项不成立；替换相应模板例句与搭配。 |
| 71 | entitle | 已修正 | entitle 需要人及其权利内容，原句缺少必要宾语结构。 |
| 72 | squeeze | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 73 | repair | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 74 | impress | 已修正 | 保留名词的印象/印记义项；原英文为强制服役的另一义项。 |
| 75 | admire | 已修正 | 所选 feel admiration for 对应钦佩或赞赏，不要求实际说出赞美。 |
| 76 | advertise | 已修正 | call attention to 可表达广告义项；改为真实广告对象。 |
| 77 | entertain | 已修正 | 不能 entertain the latest figures；娱乐义项需要人作对象。 |
| 78 | consideration | 已修正 | 思考不是货币对价，删除 calculate/compare 等混配；名词过程定义保留。 |
| 79 | introduction | 已修正 | 对齐介绍人的义项，避免仅定义为开始新事物。 |
| 80 | prayer | 已修正 | 名词定义正确，但 bring/file the prayer 与该义项不成立；替换相应模板例句与搭配。 |
| 81 | punishment | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 82 | educate | 已修正 | 不能 educate 交货日期或数字，改为教育人。 |
| 83 | refusal | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 84 | reproduce | 已修正 | 保留中文繁殖义项，不使用复制的定义和供应商模板。 |
| 85 | shave | 已修正 | 名词定义正确，但 bring/file the shave 与该义项不成立；替换相应模板例句与搭配。 |
| 86 | decay | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 87 | step | 已修正 | 步骤不是抬脚移动的一步。 |
| 88 | push | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 89 | task | 已修正 | 工作/任务是名词，不能定义为分派任务的动词。 |
| 90 | hurt | 已修正 | 保留伤害名词，改掉使人痛苦的动词定义。 |
| 91 | lift | 已修正 | 举起义项与 temporary assistance 不对应。 |
| 92 | kick | 已修正 | 名词定义正确，但 bring/file the kick 与该义项不成立；替换相应模板例句与搭配。 |
| 93 | lean | 已修正 | 保留真实存在的瘦肉名词义项，删除倾斜的动词定义。 |
| 94 | busy | 已修正 | 忙碌形容词不等于使忙碌的动词；原例句出现忙碌的记录等错配。 |
| 95 | kiss | 已修正 | 名词定义正确，但 bring/file the kiss 与该义项不成立；替换相应模板例句与搭配。 |
| 96 | harm | 已修正 | 保留名词，去掉 cause/do harm 的动词定义。 |
| 97 | obey | 已修正 | be obedient to 是有效短释义；数字和供应商不能套作服从对象。 |
| 98 | clap | 已修正 | 保留拍手名词，改掉动词不定式定义。 |
| 99 | revision | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 100 | suicide | 已修正 | 名词定义正确，但 bring/file the suicide 与该义项不成立；替换相应模板例句与搭配。 |
| 101 | compose | 已修正 | form the substance of 与组成一致；删除 compose with the supplier 等错句。 |
| 102 | condemn | 已修正 | 所选中文判刑与谴责的英文释义不一致；保留判刑义项。 |
| 103 | sponsor | 已修正 | 保留保证人名词义项，不能定义为承担赞助的动词。 |
| 104 | boost | 已修正 | 提升/促进与单纯给予希望的旧定义不完全对应，改为增加或改善的名词义项。 |
| 105 | weaken | 已修正 | lessen the strength of 完整；不能削弱交货日期。 |
| 106 | victimize | 已修正 | 原中文使牺牲含混；宾语应为受害者而不是数字。 |
| 107 | evaluate | 已修正 | form a critical opinion of 是有效动词释义；替换不完整或不说明意义的例句。 |
| 108 | embrace | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 109 | comprise | 已修正 | be composed of 完整；comprise 不能在所选包含义项中无宾语使用。 |
| 110 | storage | 已修正 | 所选定义是储存过程，不是计算机存储器。 |
| 111 | registration | 已修正 | 登记行为不是用于计算、比较、解释的数值，替换不成立的泛化搭配。 |
| 112 | grin | 已修正 | 露齿笑名词不能使用 draw back 的动词定义。 |
| 113 | accordingly | 已修正 | 相应地是副词；in accordance with 是缺少补语的介词片段，原中文说得相应地不成立。 |
| 114 | theft | 已修正 | 名词定义正确，但 bring/file the theft 与该义项不成立；替换相应模板例句与搭配。 |
| 115 | transmission | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 116 | pursuit | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 117 | ban | 已修正 | 保留名词，明确是禁令而非禁止的动作。 |
| 118 | bet | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 119 | fry | 已修正 | 油炸对应动词；原定义把烹饪和鱼苗两个义项混在一起。 |
| 120 | fit | 已修正 | 选择与适合相符的尺寸动词义项，删除健康和适宜形容词的混合定义。 |
| 121 | rub | 保留 | the act/process of 引出名词定义，词性与当前中文含义对应；现有通用例句未形成词性错误。 |
| 122 | consolidation by purchase | 已修正 | 原定义只是颠倒词序；用购买取得控制权说明概念，不把历史措辞宣称为现行准则名称。 |
| 123 | offer by tender | 已修正 | 原定义机械倒装，清关例句混入无关海关义项。 |
| 124 | balanced budget with surplus | 已修正 | 删除机械倒装释义；按不出现赤字的广义 balanced 表达盈余，不把严格收支相等与盈余混为一谈。 |
| 125 | national association of accountants | 保留 | 第二例使用第一例已展开的 NAA 缩写。 |
| 126 | cost accounting by products | 已修正 | 原定义无意义；保留按产品核算成本的概念，不误改为副产品 by-products 会计。 |
| 127 | issue by tender | 已修正 | 原定义机械倒装，明确发行证券的动词短语及投标方式。 |
| 128 | overseas private investment corporation | 保留 | OPIC 为同条另一例已展开的机构缩写。 |
| 129 | federal home loan bank board | 保留 | FHLBB 为同条另一例已展开的机构缩写。 |
| 130 | singapore inter-bank offering rate | 保留 | SIBOR 为同条另一例已展开的历史基准缩写。 |

## 本机交付

目录：`C:/Users/84754/Downloads/Recall-English-5.3.1-2026-10-22-verified`。

- `recall-english-v53-share-2026-10-22.zip`：应用分享包，内容修订 5.3.1。
- `recall-english-vocabulary-v53-2026-10-22.zip`：完整发布种子与可信源词包。

旧交付包保留，新包不包含真实配置。
