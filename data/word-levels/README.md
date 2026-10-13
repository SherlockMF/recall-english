# 词级数据来源与许可

来源：[Open Language Profiles / English CEFR-J](https://github.com/openlanguageprofiles/olp-en-cefrj)，版本和下载文件 SHA-256 见 provenance.json。执行 `node scripts/buildVocabularyLevels.mjs` 可从固定提交重新生成 src/data/vocabularyLevels.json；应用运行时不请求词级服务。

CEFR-J Wordlist Version 1.5（A1–B2）：Tono Laboratory, Tokyo University of Foreign Studies. 基于 CEFR-J 项目词表。来源允许研究及商业使用，要求引用，版权归 Tono Laboratory。项目引用：http://www.cefr-j.org/ 。

Octanove Vocabulary Profile C1/C2 Version 1.0：Octanove Labs。源 CSV 和生成 JSON 中 C1/C2 部分按 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 提供。生成 JSON 是按 headword/pos/CEFR 提取、统一大小写、拆分斜线拼写后的改编数据；重复词性选较低等级。A1–B2 部分保留上述 CEFR-J 使用条件。

匹配表达或 lemma 及词性，得到词级参考，不能保证每个专业义项难度一致。未匹配时统一估算 B2，界面标注「估算」，支持人工改级。不会以词长伪造 CEFR 评级。
