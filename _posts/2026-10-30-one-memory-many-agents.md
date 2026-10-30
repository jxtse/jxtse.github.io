---
layout: post
title: "One Memory, Many Agents: A Shared Memory Layer with Per-Agent Recall"
bilingual: true
title_zh: "多场景、多 agent 的记忆系统"
description_zh: "个人助手和 coding agent 各自维护记忆。我搭建了一套共享的 Markdown 记忆层，用 recall profile 为每个 agent 控制召回剂量，并用自己的真实使用记录评测：什么时候需要记忆，以及该给多少。"
date: 2026-10-30
author: "Jinxiang Xie"
description: "Personal and coding agents each keep their own memory. I built one shared Markdown memory with per-agent recall profiles and an automatic write path, then evaluated it on my own real agent sessions: when a turn needs memory, and how much to inject."
cover_image: /images/2026-10-30-one-memory-many-agents/cover.jpg
cover_thumbnail: /images/thumbnails/2026-10-30-one-memory-many-agents.webp
categories: [AI, Agents, Research]
permalink: /blog/one-memory-many-agents/
---

<style>
/* This bilingual post's wide metric tables scroll within the reading column. */
.post-content table { display: block; max-width: 100%; overflow-x: auto; }
.post-content a { overflow-wrap: anywhere; }
</style>

<noscript>
<p><a href="#english">English</a> · <a href="#chinese">中文</a> · <a href="#cite">引用 / Cite</a></p>
</noscript>

<section id="chinese" data-language-panel="zh" lang="zh-CN" markdown="1">

## 多场景、多 agent 的记忆系统 {#zh-title}

*One Memory, Many Agents*

谢锦翔（Jinxiang Xie） · 2026 年 10 月 30 日

一个人同时使用多个 LLM agent 已经很常见，比如使用 Muse 来规划日程、使用 Hermes 来追踪项目进度、使用 Codex 来执行一个具体的任务。但这些 agent 的记忆彼此隔离，同一条偏好或更正需要在每个系统里分别维护。本文介绍我为自己搭建的一套共享记忆层。所有 agent 读写同一份记忆接口，再由每个 agent 自己的 recall profile 决定召回的时机、范围和粒度。记忆的更新可以跨 session、跨 agent 自动运行。为了评估这套系统，我没有使用传统的记忆 benchmark，而是从自己的真实使用记录中构建了一个记忆评测环境。我从 agent eval 中吸取经验，结合程序化评估和基于 rubrics 的 LLM-as-a-Judge 进行评估，结合此后实际发生的对话来判断这一刻是否需要记忆，以及每条注入的记忆是否有用。在 467 个测试轮次上，相同召回预算下，本系统让 43.9% 的轮次拿到至少一条有用记忆，OpenViking 和 mem0 分别为 9.9% 和 32.3%，有害注入率为 2.0%，约为 mem0、BM25 和纯向量检索的一半。评测同时显示，在 agent 运行时，真正需要注入记忆的轮次只占 14%，而这其中约三分之二所需的信息从未被写入记忆。

**本文的贡献。**

1. 提出按 agent 控制召回剂量的 recall profile。同一份记忆由每个 agent 用自己的配置决定何时召回、能看哪些项目、注入什么粒度的信息。在 coding agent 上，它把普通编码提示的注入率从 18% 降到 2%，并且没有发生跨项目注入。
2. 搭建了一条没有人工审核的记忆自动更新管线，事实提炼、证据核对、与已有记忆的比对和回滚机制都自动完成。由人工标注的 38 张自动晋升卡片中有 31 张合格。
3. 我认为，记忆系统的评估不能依赖于合成数据的 benchmark，而是需要贴近真实使用记录的记忆评测环境，它衡量的是系统能否在对的时刻给出对的记忆，以及在不需要时能否保持安静。我基于个人的真实使用记录初步尝试了基于环境的记忆评估方式。

### 1. 背景：一个人身边的 agent 越来越多 {#zh-background}

过去一年里，我身边的 agent 数量增长得很快。自 Meta Muse 发布以来，personal agent 正逐步变成普通人的日常产品 [1]。Grok 在 8 月推出了 Grok Bot，每个 bot 都有自己的名字、职责和一台常驻的云电脑，可以全天候执行任务 [2]。开源社区也有自己部署的选择，例如 OpenClaw [3] 和我自己用作主助手的 Hermes Agent [4]。Coding agent 普及得更早，Codex、Claude Code 和 Pi [5] 已经成为我写代码时的日常工具。可以预见，以后还会出现更多面向特定领域的 agent（比如微信里的小微、飞书里的豆包工作），一个人在不同场景与多个 agent 协作可能将成为常态。

这些 agent 大多自带记忆，而且实现方式相当接近。Claude Code 用 CLAUDE.md 保存人写的长期指令，再用 auto memory 让模型自己积累经验 [6]。Codex 在本地维护一个独立于 ChatGPT 网页版的记忆库 [7]。OpenClaw 把记忆写成工作区里的纯文本 Markdown 文件 [8]。Hermes 则有两个常驻上下文的文件，MEMORY.md 记环境和经验，USER.md 记用户画像 [9]。单独看，每一种设计都合理。然而，在一个人同时使用它们的时候就会出现问题。

一个问题是记忆割裂。我在 Hermes 里定下“Python 环境一律用 uv 建独立环境”，Codex 并不知道，除非我在 Codex 里再说一遍。另一个问题是重复和矛盾。同一条偏好要在四个地方各写一次，而当相关内容有所变更，往往只有当时在用的那个 agent 更新了记忆，其余几个仍然按旧说法工作。时间一长就很难维护。

因此我希望有一套统一的记忆层，所有 agent 都从同一份记忆里读，也都把新学到的东西写回同一份记忆。它需要满足四个条件。第一，记忆只有一份真相源，改一处就对所有 agent 生效。第二，它通过统一的接口提供服务，比如通过 API 或 MCP，这样接入新 agent 时不需要改动记忆系统本身。第三，它要能跨设备共享。我的 agent 分布在本机和远程服务器上，这套服务通过 Tailscale Serve 只在我自己的私有网络（tailnet）内开放 [10]。第四，也是本文最关心的一点，每个 agent 都能单独控制召回的强度和粒度。

给 LLM agent 加外部记忆已经有不少研究。MemGPT 把有限的上下文窗口类比为操作系统的内存，让模型自己决定把哪些信息换进或换出上下文 [11]。Generative Agents 用自然语言记录 agent 的完整经历，再按时效、重要性和相关性检索，并定期把记忆综合成更高层的反思 [12]。MemoryBank 借鉴艾宾浩斯遗忘曲线，让记忆随时间衰减，并在被回忆时得到强化 [13]。Mem0 用 LLM 从对话中提炼事实，再对每条新事实选择新增、更新、删除或不变，以此维护记忆库 [14]。Zep 用带时间维度的知识图谱表示记忆，让过时的事实失效，同时保留历史 [15]。A-Mem 借鉴卡片盒笔记法，让记忆条目之间互相链接，并随着新信息不断演化 [16]。OpenViking 是火山引擎开源的上下文数据库，它把记忆、资源和技能统一组织成文件系统，并为每个节点生成三层表示：L0 是一句话摘要，L1 是概览，L2 是原文。agent 可以先读摘要，再决定是否打开全文 [17]。

这些工作关注的大多是单个 agent 怎样记得更多、更准。而我的场景多出一个维度：同一份记忆要同时服务几个角色完全不同的 agent，而它们需要的剂量相差很大。

### 2. 一份记忆，多种剂量 {#zh-dose}

#### 2.1 为什么召回要有剂量 {#zh-why-dose}

直觉上，记忆给得越多越好，模型自己会挑有用的部分。已有研究并不支持这种直觉。Liu 等人发现，当相关信息位于长上下文的中间位置时，模型的表现会明显下降，即使是专门为长上下文设计的模型也是如此 [18]。Shi 等人在数学题里加入无关信息后，多种提示方法的准确率都大幅下降 [19]。Chroma 的测试也显示，随着输入变长，模型表现会以不均匀、难以预测的方式退化 [20]。Anthropic 在讨论 agent 的上下文工程时，把上下文描述成一种有限的注意力预算，并建议只放入能产生预期行为的最少量高信号内容 [21]。

检索增强生成的研究也得出了相近的结论。Mallen 等人发现，检索对冷门知识帮助很大，对模型已经掌握的热门知识帮助有限，于是提出只在必要时才检索的自适应策略，同时降低了推理成本 [22]。Self-RAG 指出，不管是否需要都检索固定数量的段落，会降低模型的通用性，因此训练模型按需决定是否检索 [23]。FLARE 则在生成过程中主动判断何时检索、检索什么 [24]。更早的人机交互研究对这个问题也有讨论。Horvitz 在提出混合主动界面的原则时强调，系统在主动介入之前，应该结合对用户意图的不确定性，权衡行动的预期收益和打扰用户的代价 [25]。

对一个共享的记忆层来说，这些结论意味着两件事。第一，召回本身有成本，无关的记忆会分散模型的注意力，也会占用本该留给任务的上下文。第二，合适的剂量取决于 agent 的角色。负责统筹全局的主助手需要更宽的视野，正在修改某个函数的 coding agent 则几乎不需要额外信息。

#### 2.2 系统概览 {#zh-overview}

![图 1](/images/2026-10-30-one-memory-many-agents/fig1-architecture.png)

*图 1：系统架构。上排是读路径，每次提问都会走一遍（绿色实线，从左往右）。下排是写路径，每次会话结束后在后台静默进行（灰色虚线，从右往左）。*

据此我提出了 dose-mem，图 1 展示了系统的整体结构。左侧是以 Markdown 为真相源的记忆仓库，中间是对所有 agent 提供统一接口的记忆服务，右侧是各个 agent。服务内部有两条路径：每次提问时运行的读路径，以及每次会话结束后在后台运行的写路径。

每个 agent 都带着一个身份 token 和一个 profile 接入记忆服务。身份决定它能读写哪些项目的记忆，profile 决定它每次拿到多少记忆。接入新的 agent 时，只需要签发一个 token、写一个 profile，不需要改动服务本身。服务默认只监听本机端口。

#### 2.3 Recall profile {#zh-profile}

Recall profile 是整套设计的核心。一个 profile 由几个参数组成：触发方式决定什么时候召回，范围决定能看哪些项目，层级决定注入一句话摘要还是摘要加概览，此外还有召回的内容长度预算、最多条数和分数阈值。

第一种是给主助手用的 full profile。我的主助手是 Hermes，它负责协调我所有的研究项目，持续跟进实验和任务进度，因此需要随时了解各个项目的背景。full profile 在每一轮提问时都会尝试召回，可以跨项目检索，每轮最多注入 5 条记忆，总长度不超过 1,200 字节，每条包含一句话摘要和概览两层。

第二种是给 coding agent 用的 working profile，用于 Claude Code、Codex 和 Pi。它们是具体任务的执行者，通常由 Hermes 或我直接委派任务，在某个代码仓库里工作。working profile 只在三种情况下召回：会话的第一轮，工作切换到另一个项目时，或者我说了“按我的习惯”“上次”“之前”这类明确指向记忆的话。它只检索当前项目的记忆，再加上全局记忆中偏好、踩坑和约定三类卡片。每次最多注入 2 条一句话摘要，每条附带链接，agent 需要细节时可以自己读取原文。它的筛选分数阈值也高于 full profile。

第三种是给 personal agent 用的 personal profile，面向管理日程、邮件这类个人事务的 agent。它只召回与个人习惯相关的记忆，例如“早上 10 点喜欢来一杯咖啡”，不接触任何研究项目的内容。

#### 2.4 基于 context 的记忆检索 {#zh-retrieval}

记忆检索分为四步。第一步是确定这一轮属于哪个项目。系统从项目注册表里读取每个项目的名称、别名和昵称。如果 agent 显式指定了项目，就以它为准。如果没有指定，只有当提问唯一地命中某个项目时才推断范围，有歧义时保守地只检索全局记忆。对 coding agent 来说，项目由当前工作目录映射得到。

第二步是混合检索。系统把同一个查询分别交给稠密向量检索和 BM25 稀疏检索。稠密向量擅长语义上的近似匹配 [26]，BM25 擅长精确的词汇匹配 [27]，两者在中文和英文混杂、术语和数字密集的研究笔记上恰好互补。两路结果用 reciprocal rank fusion（RRF）合并，也就是按每路排名的倒数加权求和 [28]。这种方法不需要把两路分数校准到同一尺度，在检索文献里是一种稳健的融合方式。

第三步决定要不要插入记忆，这一步在设计上和“说什么”同样重要。检索结果会经过一系列过滤，分数低于 profile 阈值的条目也会被丢掉。如果没有一条合格，这一轮就什么都不注入。对 working profile，系统还要求一句话摘要本身与提问有足够的词汇支持，因为它只展示摘要，即使全文高度相关，也不应该注入一句与问题对不上的标题。

第四步是在预算内拼装。系统按排名依次放入完整的条目。

#### 2.5 易于维护的 Markdown 真相源 {#zh-markdown}

所有记忆都保存在一个 Git 仓库里的 Markdown 文件中，包括每个项目的简报、决策记录、一事一卡的记忆卡片和项目注册表。日常维护主要由 AI 完成，但我随时可以打开任何一个文件阅读、比较版本或手动修改。向量索引只是从这些文件派生出来的检索状态，随时可以从 Markdown 完整重建。我选择这种设计，一是因为人能读懂并检查的记忆更容易建立信任，二是因为 OpenClaw 等系统已经证明纯文件的记忆在实践中足够好用。

每条记忆都有三层表示，这一点参考了 OpenViking。L0 是一句话结论，取自卡片的结论字段或首句。L1 是有长度上限的概览。L2 是按标题切分的原文块。与 OpenViking 不同的是，这三层完全按规则生成，不调用 LLM，因此重建索引不产生模型调用费用，每次重建的结果也一致。每张卡片还带有生命周期信息。实验结果默认 180 天后过期，决策 365 天后过期，偏好、踩坑和约定没有期限。项目在注册表中被标记为归档后，它的记忆默认不再被自动召回，但仍然可以显式读取。

### 3. Case study {#zh-case-study}

![图 2](/images/2026-10-30-one-memory-many-agents/fig2-dose.png)

*图 2：同一句话，两种剂量。每行是同一句提示分别发给主助手（full）和 coding agent（working）时实际注入的内容，条的长短是注入字节数（上限 1,200 字节）。三个例子是线上服务的真实输出，项目名做了泛化。*

图 2 用三个真实例子展示了两种 profile 的差别。每个例子都是同一句话分别发给主助手和 coding agent，再记录两边实际收到的记忆。

第一个例子是一个普通的编码步骤：“把 `parse_table` 改个名，顺便更新测试。”主助手的 full profile 每轮都会召回，它被塞进了 1,199 字节的“后训练经验”。这条记忆和重命名函数毫无关系，只会占用上下文。coding agent 的 working profile 没有被触发，什么都没收到。对一个正在改代码的 agent 来说，这正是合适的剂量。

第二个例子是“帮我配一下这个项目的 Python 环境”。这句话在两个 agent 中都进行了召回。两边都拿到了“每个项目用 uv 建独立环境”这条记忆。主助手还多拿到一条“大型数据放在外置盘的哪个位置”。这条记忆其实也有用，working profile 为了控制剂量没有给。

第三个例子是在 B 项目的代码仓库里，问 A 项目的论文该怎样引用软件许可证。主助手召回了 A 项目的三条记忆，其中决策记录是有用的。coding agent 被直接挡住，收到 0 字节。在 B 项目里工作的 coding agent 不应该读到 A 项目的内容，这是有意设计的隔离。如果确实需要跨项目的信息，应该从全局记忆中召回，或是由主助手来协调。

为了在更大的样本上验证这些现象，我在隔离环境里做了两组测量。第一组是 50 条独立的普通编码提示。在 full profile 下，其中 9 条（18%）被注入了记忆，在 working profile 下只有 1 条（2%）。第二组是 5 个模拟的 10 轮编码会话。在这组会话上，working profile 召回的记忆长度减少了 79%。

这种低剂量有明确的代价。在评测集上，working profile 在前 2 条结果中召回到正确来源的比例约为 30%，full profile 在前 5 条中约为 75%。也就是说，coding agent 在不少本可以受益于记忆的时刻没有拿到记忆。我接受这个取舍，原因有两个。一是 Horvitz 所说的打扰代价对 coding agent 尤其高 [25]，一条无关记忆可能把它带离当前任务。二是这个损失可以弥补，coding agent 一直可以主动调用 `memory_search` 工具查询记忆，自动召回只是一个低剂量的默认值。

### 4. 记忆的自然生长 {#zh-growth}

![图 3](/images/2026-10-30-one-memory-many-agents/fig3-correction.png)

*图 3：一次没人审核的更正。这是端到端验收测试里的真实记录：先说“未验证的条目标成琥珀色”，后来改口“换成青色”。系统自动用新卡取代（supersede）旧卡，旧卡留在磁盘上，不再被召回。*

记忆系统必须回答一个问题：新的记忆从哪里来，谁来保证它是对的。最稳妥的做法是让人审核每一条候选记忆。我最初也是这样设计的，结果待审核的候选在收件箱里积压到了 218 条。我不想当记忆的审核员，事实证明我也没有时间当。但错误的长期记忆比没有记忆更糟，它会在此后几十次对话里反复误导 agent，而且不容易被发现。所以写入路径的目标是用自动检查代替人工审核，同时保持准入标准不降低。

写入路径分为四步，对应图 1 下排从右往左的流程。

第一步是捕获。系统只读取已经结束的会话。从本地读取 Hermes、Codex 和 Pi 的空闲会话的历史，至少包含 3 个用户轮次。每个会话被压缩成摘要，只保留用户的话、agent 的最终回答、调用过的工具名和有限的错误分类。

第二步是提炼。LLM 把摘要拆成原子事实，每条事实都要写明所属项目和置信度，并且必须附上一段连续的原话作为证据。系统随后逐字核对这段引文是否真的出现在原始对话中，只允许空白、全半角和引号这类格式差异。没有出处的事实会被直接丢弃。这一步的做法与 Mem0 用 LLM 从对话中提炼事实的思路相近 [14]，区别在于这里强制要求可核验的原文证据。

第三步是自动审核。每条候选先经过不调用模型的确定性预筛，再用混合检索找出最相近的 12 张已有卡片，最后交给一个 LLM 评委成批判断。评委有四种决定。promote 表示作为新卡片晋升，merge 表示并入已有卡片的证据，supersede 表示取代一张旧卡片，reject 表示丢弃。supersede 的门槛最高，必须有更新、更强、可核验的来源，或者是我本人明确说过的话。

第四步是写入。写入路径只追加新卡片，从不改写旧文件。被取代的旧卡片仍然保留在仓库里，新卡片通过 `supersedes` 字段指向它，检索时旧卡片会被过滤掉。图 3 展示的就是这样一次更正：我先说“未验证的条目标成琥珀色”，后来改口“换成青色”，系统判定为 supersede，旧卡片留在磁盘上，从此不再被召回。

我把由自动审核上线后的 38 张卡片全部读了一遍。其中 31 张合格，例如某个项目的许可证约束、某个测试集只能用于开发诊断、某次实验结果其实是评估格式造成的假象。6 张不该进入记忆，它们分别是一条通用的数据库知识、一段带时间戳的故障经过、一份命令修复日志、一个 Python 版本快照、一次交接文档的创建记录和一条一次性的任务指令。我把这 6 种错误类型写进了评委的拒绝规则，并用归档卡片取代了这 6 张卡片。

### 5. 评测环境：在真实使用里测记忆 {#zh-evaluation}

#### 5.1 现有 benchmark 测的是什么 {#zh-benchmarks}

长期记忆领域最常用的 benchmark 是 LoCoMo [29]。它先让 LLM agent 依据人设和事件图谱生成两个人之间的长对话，每段对话平均约 300 轮，最多跨越 35 个会话，经过人工校对后，再用第三人称的问答测试模型能否答出对话中的某个事实。Mem0 的主要实验就建立在 LoCoMo 上 [14]。LongMemEval 设计了 500 道题，覆盖信息提取、跨会话推理、时间推理、知识更新和拒答五种能力，并发现长上下文模型在其上的表现下降 30% 到 60% [30]。MemoryAgentBench 把评测改为增量的多轮交互，考察准确检索、测试时学习、长程理解和选择性遗忘 [31]。

这些 benchmark 推动了很多进展，LongMemEval 也已经覆盖了知识更新和拒答。不过它们有一个共同的设定：对话是生成的，问题是事后出的，出题时已经保证答案存在于历史中。我在实际使用中关心的问题与此不同。当我对 agent 说出下一句话时，记忆系统首先要判断这一刻需不需要记忆。如果需要，它要给出对的那几条。如果不需要，它应该保持安静。这个判断每一轮都在发生，而现有 benchmark 很难测出这种能力，因为它们几乎每一道题都需要记忆。

此外，记忆系统之间的比较本身也很脆弱。Zep 最初报告在 LoCoMo 上达到 84%，Mem0 的团队指出其计算有误，认为正确数字是 58.44%，Zep 修正后报告为 75.14% [32, 33]。同一个系统、同一个 benchmark，仅仅因为评测细节不同，数字就相差二十多个百分点。这提醒我，在自己的评测中，对比系统的接入方式必须尽可能贴近它们本来的用法。

#### 5.2 从真实使用中构建记忆环境 {#zh-environment}

基于上面的考虑，我从自己真实的 agent 使用记录中构建了一个评测环境。数据来自 2026 年 9 月 21 日到 10 月 26 日之间，我与 Hermes、Codex 和 Pi 的私人会话。我从中冻结了 500 个探针，其中 363 个来自 Hermes，89 个来自 Codex，48 个来自 Pi。数据按时间切分，前两周作为开发集，用于调参和选阈值，第 3 到 5 周作为测试集。

每一个需要测试的点称为探针，每个探针是我在真实会话中说过的一句话。系统在回答这个探针时，只能看到此前的上一轮对话和此前的记忆快照。我在这句话之后实际说了什么、agent 实际做了什么，最多 6 轮，只提供给评委，绝不进入任何系统的检索请求。记忆快照来自记忆仓库的 Git 历史。我每周取一个快照，它严格早于该周所有的探针，因此系统不可能读到未来的信息。

#### 5.3 标注与指标 {#zh-labels}

为了构建合理的评价指标，我人工构建了 rubrics，每个 rubrics 的真值标签由 LLM 给出。为了减少 LLM-as-a-Judge 的偏差，评委看不到系统名称和检索分数，候选条目的顺序被随机打乱，每个判断都必须引用候选原文或后续对话中的具体片段。

对每个探针，评委需要判断两件事。第一，结合我之后实际说的话和 agent 实际做的事，这一刻是否需要记忆。第二，每条注入的记忆属于哪一类：必要（没有它就做不对），有帮助，无关，或者有害（会误导 agent）。评委还会检查当我改过口时，系统给出的是新说法还是旧说法。为了检验标签的可靠性，我采用了不同厂商的模型独立复判了随机抽取的 20% 探针，并计算模型之间的一致性。

基于这些标签，我关心几个指标。命中率是至少注入了一条有用记忆（必要或有帮助）的轮次比例，它衡量系统有多少次真正帮上了忙。有用率和有害率分别是所有注入条目中有用和有害的比例，它们衡量注入内容的质量。此外还有需要记忆的轮次中拿到有用内容的比例，以及注入的内容长度。综合分把“说”和“不说”放在一起：在需要记忆的轮次，召回到必要条目得分，在不需要的轮次，保持沉默得分，注入有害内容则扣分。所有置信区间都按会话聚类做 2,000 次 bootstrap，因为同一会话里的轮次彼此相关，把它们当作独立样本会低估不确定性 [34]。

#### 5.4 对比系统与公平接入 {#zh-baselines}

对比系统有四个：OpenViking [17]、mem0 [14]、纯稠密向量检索 [26] 和纯 BM25 检索 [27]。后两个是检索领域最基本的基线，用来判断复杂系统的收益是否真的超过了简单方法。所有系统读取同一份记忆快照，使用同一个 embedding 模型（text-embedding-3-small），由同一个评委打分。每个系统只在开发集上调一个阈值，测试集只用于最终报告。

吸取 LoCoMo 争议的教训，我让每个系统都按它本来的用法接入。OpenViking 使用它为 OpenClaw 等插件做自动注入时调用的原生接口（context assembly）。mem0 使用它自己的写入方式（`infer=True`），由它的 LLM 从每份文档中提炼事实，并按周的顺序依次写入，每个探针只能检索到当时已经存在的记忆。

这一点在实验中被证明非常重要。我第一次做对比时，OpenViking 用的是通用检索接口，返回的多是带元数据的目录概览，mem0 则直接存入原文，不做提炼。那一轮里，它们注入内容的有用率只有 4.9% 和 5.9%。改为原生用法后，两者分别上升到 16.5% 和 19.0%，都提高到原来的三倍以上。

#### 5.5 结果 {#zh-results}

![图 4](/images/2026-10-30-one-memory-many-agents/fig4-results.png)

*图 4：同一份记忆、同样的召回内容预算下，各系统注入了什么。A 是注入内容的质量，B 是各系统说了多少话。测试集为 467 个已评判的真实对话轮次，分布在 83 个会话里。细线是按会话聚类的 95% 置信区间。*

测试集最终包含 467 个已评判的轮次，分布在 83 个会话中。表 1 是相同注入预算下五个系统的结果。

| 指标 | 本系统 | OpenViking | mem0 | 纯向量 | BM25 |
|-|-|-|-|-|-|
| 每轮注入条数 | 3.2 | 0.6 | 2.7 | 2.0 | 2.0 |
| 命中率 | **43.9%** | 9.9% | 32.3% | 28.9% | 31.3% |
| 需要记忆的 65 个轮次中拿到有用内容 | **56.9%** | 21.5% | 53.8% | 38.5% | 36.9% |
| 注入条目的有用率 | **21.0%** | 16.5% | 19.0% | 19.9% | 18.9% |
| 注入条目的有害率 | 2.0% | **1.7%** | 4.6% | 4.3% | 4.8% |

在相同的召回内容预算下，本系统的命中率为 43.9%，比 mem0、BM25 和纯向量检索高 12 到 15 个百分点，比 OpenViking 高 34 个百分点。它的有害率为 2.0%，显著低于 mem0、纯向量检索和 BM25，大约是它们的一半，与 OpenViking 相当。在真正需要记忆的 65 个轮次中，本系统和 mem0 拿到有用内容的比例接近，分别为 56.9% 和 53.8%，都高于其余三个系统。

另一方面，单条记忆的准度在各系统之间没有显著差别，有用率都在 16% 到 21% 之间。这说明本系统的优势并不来自更会挑选单条记忆。它来自两个地方。其一是预算用得更省。本系统每条记忆只注入一句话标题，以及概览中标题之外的部分，同样的 1,200 字节平均能放下 3.2 条，其他系统只能放下 2 到 2.7 条。其二是过滤。按项目范围和版本链过滤，使本系统较少注入其他项目的内容和已被取代的旧说法，这在有害率上体现得最明显。OpenViking 的有害率也很低，但主要原因是它在 59% 的轮次里什么都没有注入，这同时也让它的命中率最低。

如果让每个系统在开发集上调出各自最优的阈值，情况就完全不同了。所有系统都变得几乎沉默，只在 1.5% 到 5.3% 的轮次注入记忆，综合分挤在 0.81 到 0.85 之间，BM25 最高，本系统为 0.84。在 65 个需要记忆的轮次里，没有一个系统召回到被标为“必要”的条目。综合分如此接近，是因为 86% 的轮次本来就不需要记忆，一个永远沉默的系统也能拿到很高的分数。所以我不认为本系统在所有方面都超过了对比系统。更准确的说法是，在愿意注入一定剂量的前提下，它能以更低的风险让更多轮次受益。

#### 5.6 两个关于真实使用的发现 {#zh-findings}

这次评测提供的额外 insights 是，真正需要记忆的时刻很少。在 467 个测试轮次中，评委认为需要记忆的只有 65 个，占 14%。我进一步检查了这 65 个轮次，发现其中 42 个（约三分之二）所需的信息在所有系统的候选中都找不到。其中最多的是“跑完了吗”这类对正在进行的任务的追问，共 21 个，这类问题需要的是任务的实时状态，而它从来不在长期记忆里。剩下的是一些从未被写入记忆的细节，例如某个 PR 的链接或某个具体的数值上限。即使把五个系统的全部候选合在一起，也有 77.7% 的轮次至少包含一条有用的条目，可见检索本身并不是瓶颈。这个结果说明，下一步最值得补的是任务状态的记录，继续改进检索的边际收益很小。这也与 LongMemEval 等 benchmark 的设定形成对照，那里每一道题都保证答案存在于历史之中 [30]。

#### 5.7 局限 {#zh-limitations}

这项评测有几处明显的局限，需要在解读结果时考虑。第一，数据只来自一个用户，也就是我自己，而本系统恰好是在我的数据上开发的。其他人的使用习惯可能完全不同。

第二，评估只用了 LLM。在 90 个被复判的轮次上，条目标签的一致率为 86%（Cohen's κ=0.41），“这一轮是否需要记忆”的一致率为 69%（κ=0.17）。按照 Landis 和 Koch 的常用划分，前者处于中等一致的下限，后者只是轻微一致 [35]。因此，与“是否需要记忆”相关的数字噪声较大，解读时应当谨慎。

第三，所有系统读取的都是同一份已经整理好的记忆，这次没有比较各系统从原始聊天中自己建立记忆的能力。

最后，原始数据涉及个人隐私，不会公开，我只公开方法和脱敏后的示例。

### 6. 结尾 {#zh-closing}

做完这一轮工作，我对记忆系统的理解发生了变化。我原本以为难点在于记住更多的东西，现在看来，更难的是在对的时刻给对的 agent 合适的剂量，在不该说话时保持安静，并且在没有人看着的情况下，自己生长、自己改错。

还有几个问题我没有答案。第一，profile 目前是手工调的。它能否从使用中自动学习？例如 coding agent 每次主动调用 `memory_search`，都可以看作一次“该给的没给”的信号，可以用来调整触发条件和阈值。第二，在多用户的场景下，这种基于真实使用记录的评测要怎么做？一个人的数据说服力有限，但真实记录又天然涉及隐私。第三，需要记忆的轮次中，有三分之二缺的是任务状态。这部分信息应该由记忆系统接管，还是交给另一套专门的任务系统，我还没有想清楚。

本文的搭建说明和评测工具已开源：<https://github.com/jxtse/dose-mem>

</section>

<section id="english" data-language-panel="en" lang="en" markdown="1">

## One Memory, Many Agents {#en-title}

Jinxiang Xie · October 30, 2026

Using several LLM agents at once has become common: Muse to plan the day, Hermes to track research projects, Codex to carry out a specific task. Yet these agents keep their memories apart, so the same preference or correction has to be maintained separately in each system. This post describes a shared memory layer I built for myself. Every agent reads and writes through the same memory interface, and each agent's own recall profile decides when to recall, what scope to search and how fine-grained the injected memory is. Memory updates run automatically across sessions and across agents. To evaluate the system I did not use a conventional memory benchmark. Instead, I built a memory evaluation environment from my own real usage. Borrowing from agent evaluation practice, I combined programmatic checks with a rubric-based LLM-as-a-Judge, which uses the conversation that actually followed to decide whether a given moment needed memory and whether each injected memory helped. On 467 test turns, under the same recall budget, this system gives at least one useful memory on 43.9% of turns, against 9.9% for OpenViking and 32.3% for mem0. Its harmful-injection rate is 2.0%, about half that of mem0, BM25 and dense retrieval. The evaluation also shows that only 14% of turns actually needed injected memory while the agent was running, and in about two thirds of those, the information needed had never been written to memory.

**Contributions.**

1. A recall profile that sets the recall dose per agent. Every agent reads the same memory, and its own configuration decides when to recall, which projects it may see, and how fine-grained the injected information is. For coding agents it lowers the share of routine coding prompts that receive memory from 18% to 2%, with no cross-project injection.
2. An automatic memory-update pipeline with no human review. Fact distillation, evidence checking, comparison with existing memory and rollback all run automatically. Of the 38 auto-promoted cards that I labelled by hand, 31 were good.
3. I believe memory systems cannot be evaluated with benchmarks built on synthetic data. They need an evaluation environment close to real usage, one that measures whether the system gives the right memory at the right moment and stays quiet when nothing is needed. I made a first attempt at such environment-based evaluation using my own usage records.

### 1. Background: more and more agents around one person {#en-background}

Over the past year the number of agents around me has grown quickly. Since Meta released Muse, personal agents have been turning into everyday products for ordinary people [1]. In August, Grok launched Grok Bot, where each bot has its own name, role and an always-on cloud computer and can work around the clock [2]. The open-source community has self-hosted options too, such as OpenClaw [3] and Hermes Agent [4], which I use as my main assistant. Coding agents spread even earlier: Codex, Claude Code and Pi [5] are part of how I write code every day. More domain-specific agents are clearly coming (WeChat's Xiaowei and Doubao Work in Feishu, for example), and working with several agents across different settings is likely to become normal.

Most of these agents ship with their own memory, built in similar ways. Claude Code keeps human-written long-term instructions in CLAUDE.md and lets the model accumulate experience through auto memory [6]. Codex keeps a local memory store separate from ChatGPT on the web [7]. OpenClaw writes memory as plain Markdown files in its workspace [8]. Hermes has two files that stay in context: MEMORY.md for environment and lessons, USER.md for the user profile [9]. Each design is reasonable on its own. The trouble starts when one person uses all of them at once.

One problem is fragmented memory. If I tell Hermes that "every Python environment should be an isolated uv environment", Codex does not know unless I say it again in Codex. Another problem is duplication and contradiction. The same preference has to be written in four places, and when something changes, usually only the agent I happened to be using updates its memory while the others keep working from the old version. Over time this becomes hard to maintain.

So I wanted a unified memory layer: every agent reads from the same memory and writes what it learns back to the same memory. It has to meet four conditions. First, memory has a single source of truth, so a change in one place takes effect for every agent. Second, it serves through a uniform interface, such as an API or MCP, so connecting a new agent needs no change to the memory system itself. Third, it can be shared across devices. My agents run on this machine and on remote servers, and the service is exposed only inside my own private network (tailnet) through Tailscale Serve [10]. Fourth, and the focus of this post, each agent can control the strength and granularity of its own recall.

There is already a good deal of research on external memory for LLM agents. MemGPT compares the limited context window to an operating system's memory and lets the model decide what to page in and out of context [11]. Generative Agents record an agent's full experience in natural language, retrieve it by recency, importance and relevance, and periodically synthesize memories into higher-level reflections [12]. MemoryBank borrows the Ebbinghaus forgetting curve so that memories decay over time and are reinforced when recalled [13]. Mem0 uses an LLM to distill facts from conversations and, for each new fact, chooses to add, update, delete or leave the memory store unchanged [14]. Zep represents memory as a temporal knowledge graph, invalidating outdated facts while keeping their history [15]. A-Mem borrows the Zettelkasten method, linking memory entries to each other and letting them evolve as new information arrives [16]. OpenViking, the context database open-sourced by Volcengine, organizes memory, resources and skills as one file system and gives every node three representations: L0 is a one-sentence summary, L1 an overview, L2 the original text. An agent can read the summary first and then decide whether to open the full text [17].

Most of this work is about how a single agent can remember more, and more accurately. My setting adds a dimension: the same memory has to serve several agents with entirely different roles, and the dose each one needs differs widely.

### 2. One memory, many doses {#en-dose}

#### 2.1 Why recall needs a dose {#en-why-dose}

Intuitively, the more memory the better, since the model will pick out what is useful. Existing research does not support this intuition. Liu et al. found that models perform markedly worse when the relevant information sits in the middle of a long context, even models designed for long contexts [18]. Shi et al. added irrelevant information to math problems and saw accuracy fall sharply across many prompting methods [19]. Chroma's tests also show that as input grows longer, model performance degrades in uneven and hard-to-predict ways [20]. In its discussion of context engineering for agents, Anthropic describes context as a finite attention budget and recommends including only the smallest set of high-signal content that produces the desired behaviour [21].

Research on retrieval-augmented generation points the same way. Mallen et al. found that retrieval helps a lot for long-tail knowledge but little for popular knowledge the model already holds, and proposed an adaptive strategy that retrieves only when needed, which also lowers inference cost [22]. Self-RAG notes that retrieving a fixed number of passages regardless of need hurts the model's versatility, and trains the model to decide when to retrieve [23]. FLARE actively decides during generation when to retrieve and what to retrieve [24]. Earlier human-computer interaction research addressed the same question. In his principles of mixed-initiative user interfaces, Horvitz stressed that before acting on its own initiative a system should weigh the expected benefit of acting against the cost of interrupting the user, taking its uncertainty about the user's intent into account [25].

For a shared memory layer these findings mean two things. First, recall has a cost: irrelevant memory distracts the model and takes up context that should go to the task. Second, the right dose depends on the agent's role. A main assistant that coordinates everything needs a wide view, while a coding agent editing one function needs almost no extra information.

#### 2.2 System overview {#en-overview}

![Figure 1](/images/2026-10-30-one-memory-many-agents/fig1-architecture.png)

*Figure 1. System architecture. The top row is the read path, run on every prompt (solid green, left to right). The bottom row is the write path, run silently in the background after each session ends (dashed grey, right to left).*

Building on this, I designed dose-mem, whose overall structure is shown in Figure 1. On the left is the memory repository, with Markdown as the source of truth. In the middle is the memory service, which offers one interface to every agent. On the right are the agents. The service has two paths inside: the read path, run on every prompt, and the write path, run in the background after each session ends.

Each agent connects to the memory service with an identity token and a profile. The identity decides which projects' memory it may read and write, and the profile decides how much memory it gets each time. Connecting a new agent only takes issuing a token and writing a profile, with no change to the service itself. By default the service listens only on a local port.

#### 2.3 Recall profile {#en-profile}

The recall profile is the core of the design. A profile consists of a few parameters: the trigger decides when to recall, the scope decides which projects may be searched, the level decides whether to inject only a one-line summary or the summary plus an overview, and there are also a length budget for recalled content, a maximum number of items and a score threshold.

The first is the full profile, for the main assistant. My main assistant is Hermes. It coordinates all my research projects and keeps track of experiments and tasks, so it needs the background of every project at hand. The full profile tries to recall on every prompt, may search across projects, and injects at most 5 memories per turn, no more than 1,200 bytes in total, each with a one-line summary and an overview.

The second is the working profile, for coding agents: Claude Code, Codex and Pi. They execute concrete tasks, usually delegated by Hermes or by me, inside some code repository. The working profile recalls only in three situations: on the first turn of a session, when the work moves to another project, or when I say something that points explicitly at memory, such as "the way I usually do it", "last time" or "before". It searches only the current project's memory, plus three types of global cards: preferences, pitfalls and conventions. It injects at most 2 one-line summaries, each with a link the agent can follow to read the original when it needs detail. Its score threshold is also higher than the full profile's.

The third is the personal profile, for personal agents that manage personal matters such as calendars and email. It recalls only memories about personal habits, for example "likes a cup of coffee at 10 in the morning", and never touches research projects.

#### 2.4 Context-aware memory retrieval {#en-retrieval}

Retrieval takes four steps. The first decides which project this turn belongs to. The system reads each project's name, aliases and nicknames from the project registry. If the agent names a project explicitly, that wins. Otherwise the scope is inferred only when the prompt matches exactly one project; when it is ambiguous, the system conservatively searches global memory only. For coding agents the project is mapped from the current working directory.

The second step is hybrid retrieval. The system sends the same query to dense vector retrieval and to BM25 sparse retrieval. Dense vectors are good at approximate semantic matches [26], and BM25 at exact lexical matches [27]; on research notes that mix Chinese and English and are dense with terms and numbers, the two complement each other well. The two result lists are merged with reciprocal rank fusion (RRF), which sums the reciprocal of each list's rank [28]. This needs no calibration of the two scores onto one scale, and the retrieval literature regards it as a robust way to fuse rankings.

The third step decides whether to insert memory at all, which in this design matters as much as what to say. Retrieved results pass through a series of filters, and items scoring below the profile's threshold are dropped. If nothing qualifies, nothing is injected this turn. For the working profile the system also requires the one-line summary itself to have enough lexical support from the prompt: since only the summary is shown, a title that does not match the question should not be injected even if the full text is highly relevant.

The fourth step assembles the result within the budget. The system adds whole items in rank order.

#### 2.5 A Markdown source of truth that is easy to maintain {#en-markdown}

All memory lives in Markdown files in a Git repository: each project's brief, its decision log, one-fact-per-card memory cards, and the project registry. Day-to-day maintenance is mostly done by AI, but I can open, diff or edit any file at any time. The vector index is only retrieval state derived from these files and can be fully rebuilt from the Markdown at any time. I chose this design for two reasons: memory that people can read and check is easier to trust, and systems such as OpenClaw have already shown that plain-file memory works well enough in practice.

Every memory has three representations, an idea taken from OpenViking. L0 is a one-sentence conclusion, taken from the card's conclusion field or first sentence. L1 is an overview with a length cap. L2 is the original text split into chunks by heading. Unlike OpenViking, all three layers are generated by rules without calling an LLM, so rebuilding the index costs nothing in model calls and gives the same result every time. Each card also carries lifecycle information. Experimental results expire after 180 days by default, decisions after 365 days, and preferences, pitfalls and conventions never expire. Once a project is marked archived in the registry, its memory is no longer recalled automatically by default, though it can still be read explicitly.

### 3. Case study {#en-case-study}

![Figure 2](/images/2026-10-30-one-memory-many-agents/fig2-dose.png)

*Figure 2. Same prompt, two doses. Each row shows what was actually injected when the same prompt went to the main assistant (full) and to a coding agent (working); bar length is injected bytes (capped at 1,200 bytes). The three examples are real outputs of the live service, with project names generalized.*

Figure 2 uses three real examples to show how the two profiles differ. In each, the same prompt was sent to the main assistant and to a coding agent, and I recorded the memory each side actually received.

The first example is a routine coding step: "Rename `parse_table` and update the tests." The main assistant's full profile recalls on every turn, and it received 1,199 bytes of "lessons from post-training". That memory has nothing to do with renaming a function and only takes up context. The coding agent's working profile was not triggered and received nothing. For an agent in the middle of editing code, that is exactly the right dose.

The second example is "Set up the Python environment for this project." This prompt triggered recall in both agents. Both received the memory "use an isolated uv environment for each project". The main assistant also received "where large data lives on the external drive". That memory is useful too, but the working profile left it out to keep the dose small.

The third example is asking, inside project B's repository, how project A's paper should cite software licenses. The main assistant recalled three memories from project A, of which the decision log was useful. The coding agent was blocked outright and received 0 bytes. A coding agent working in project B should not read project A's content; this isolation is by design. When cross-project information is really needed, it should come from global memory or be coordinated by the main assistant.

To check these effects on a larger sample, I ran two sets of measurements in an isolated environment. The first used 50 independent routine coding prompts. Under the full profile, 9 of them (18%) received memory; under the working profile only 1 (2%). The second used 5 simulated 10-turn coding sessions. On these sessions the working profile cut the length of recalled memory by 79%.

This low dose has a clear cost. On the evaluation set, the working profile recalls the correct source within its top 2 results about 30% of the time, while the full profile does so within its top 5 about 75% of the time. In other words, the coding agent misses memory at many moments when it could have benefited. I accept this trade-off for two reasons. First, the cost of interruption that Horvitz describes is especially high for coding agents [25]: one irrelevant memory can pull them away from the task at hand. Second, the loss can be made up: a coding agent can always call the `memory_search` tool to query memory itself, and automatic recall is only a low-dose default.

### 4. Memory that grows on its own {#en-growth}

![Figure 3](/images/2026-10-30-one-memory-many-agents/fig3-correction.png)

*Figure 3. A correction nobody reviewed. This is a real record from the end-to-end acceptance test: I first said "mark unverified entries in amber" and later changed it to "use teal instead". The system automatically superseded the old card with a new one; the old card stays on disk but is no longer recalled.*

A memory system has to answer one question: where do new memories come from, and who makes sure they are right? The safest answer is to have a person review every candidate memory. That is how I first designed it, and the review inbox piled up to 218 candidates. I did not want to be my memory's reviewer, and it turned out I did not have the time either. But wrong long-term memory is worse than no memory: it misleads agents again and again over dozens of later conversations, and it is hard to notice. So the goal of the write path is to replace human review with automatic checks without lowering the bar for admission.

The write path has four steps, matching the bottom row of Figure 1 from right to left.

The first step is capture. The system reads only sessions that have ended. It reads the history of idle Hermes, Codex and Pi sessions locally, each with at least 3 user turns. Each session is compressed into a digest that keeps only the user's words, the agent's final answers, the names of tools called, and a limited classification of errors.

The second step is distillation. An LLM splits the digest into atomic facts. Each fact must state its project and confidence and must carry a contiguous verbatim quote as evidence. The system then checks, word for word, that the quote really appears in the original conversation, allowing only formatting differences such as whitespace, full- or half-width characters and quotation marks. A fact without a source is dropped. This step is close in spirit to Mem0's use of an LLM to distill facts from conversations [14], except that here verifiable verbatim evidence is required.

The third step is automatic review. Each candidate first passes a deterministic pre-screen that calls no model, then hybrid retrieval finds the 12 most similar existing cards, and finally an LLM judge decides in batches. The judge has four possible decisions: promote, to admit it as a new card; merge, to fold it into an existing card's evidence; supersede, to replace an old card; and reject, to discard it. Supersede has the highest bar: it needs a newer, stronger, verifiable source, or something I said explicitly myself.

The fourth step is writing. The write path only appends new cards and never rewrites old files. A superseded card stays in the repository, the new card points to it through its `supersedes` field, and the old card is filtered out at retrieval time. Figure 3 shows exactly such a correction: I first said "mark unverified entries in amber" and later changed it to "use teal instead"; the system judged it a supersede, and the old card stays on disk but is never recalled again.

I read all 38 cards that automatic review promoted after launch. Thirty-one were good, for example a license constraint for one project, the fact that a certain test set may only be used for development diagnostics, and the finding that one experimental result was an artifact of the evaluation format. Six should not have entered memory: a piece of generic database knowledge, a timestamped incident timeline, a command-repair log, a Python version snapshot, a record of creating a handoff document, and a one-off task instruction. I added these six error types to the judge's rejection rules and replaced the six cards with archived ones.

### 5. An evaluation environment: measuring memory in real use {#en-evaluation}

#### 5.1 What existing benchmarks measure {#en-benchmarks}

The most widely used benchmark for long-term memory is LoCoMo [29]. It first has LLM agents generate long conversations between two people from personas and event graphs, averaging about 300 turns and spanning up to 35 sessions; after human correction, it uses third-person question answering to test whether a model can answer a fact from the conversation. Mem0's main experiments are built on LoCoMo [14]. LongMemEval has 500 questions covering five abilities, namely information extraction, multi-session reasoning, temporal reasoning, knowledge updates and abstention, and finds that long-context models lose 30% to 60% of their performance on it [30]. MemoryAgentBench turns evaluation into incremental multi-turn interaction, testing accurate retrieval, test-time learning, long-range understanding and selective forgetting [31].

These benchmarks have driven a lot of progress, and LongMemEval already covers knowledge updates and abstention. They share one setup, though: the conversations are generated, the questions are written afterwards, and the answer is guaranteed to exist in the history when the question is written. The question I care about in practice is different. When I say my next sentence to an agent, the memory system first has to decide whether this moment needs memory. If it does, it should give the right few items. If it does not, it should stay quiet. This decision happens on every turn, and existing benchmarks can hardly measure it, because nearly every one of their questions needs memory.

Comparisons between memory systems are also fragile. Zep first reported 84% on LoCoMo; the Mem0 team pointed out a calculation error and put the correct figure at 58.44%; Zep's corrected report was 75.14% [32, 33]. The same system on the same benchmark differed by more than twenty percentage points because of evaluation details alone. This reminded me that, in my own evaluation, the baselines must be connected in a way as close as possible to how they are meant to be used.

#### 5.2 Building a memory environment from real use {#en-environment}

With these considerations in mind, I built an evaluation environment from my own real agent usage. The data come from my private sessions with Hermes, Codex and Pi between September 21 and October 26, 2026. Of the 500 frozen probes, 363 come from Hermes, 89 from Codex and 48 from Pi. The data are split by time: the first two weeks form the development set, used for tuning and choosing thresholds, and weeks 3 to 5 form the test set.

Each point to be tested is called a probe, and each probe is a sentence I actually said in a real session. When answering a probe, a system can see only the previous turn and the earlier memory snapshot. What I actually said next and what the agent actually did, up to 6 turns, are shown only to the judge and never enter any system's retrieval request. Memory snapshots come from the Git history of the memory repository. I take one snapshot per week, strictly earlier than every probe in that week, so no system can read information from the future.

#### 5.3 Labels and metrics {#en-labels}

To build sound metrics, I wrote the rubrics by hand, and an LLM assigns the labels under each rubric. To reduce the biases of LLM-as-a-Judge, the judge sees neither system names nor retrieval scores, candidate items are shuffled, and every judgement must cite a specific passage from the candidate text or the later conversation.

For each probe the judge decides two things. First, given what I actually said next and what the agent actually did, whether this moment needed memory. Second, which category each injected memory falls into: necessary (the task goes wrong without it), helpful, irrelevant, or harmful (it misleads the agent). The judge also checks, when I had changed my mind, whether the system gave the new version or the old one. To check label reliability, I had a model from a different vendor independently re-judge a random 20% of probes and computed the agreement between the models.

From these labels I track several metrics. Hit rate is the share of turns with at least one useful (necessary or helpful) memory injected; it measures how often the system actually helped. Useful rate and harmful rate are the shares of all injected items that are useful and harmful; they measure the quality of what is injected. There is also the share of memory-needing turns that received useful content, and the length of injected content. The composite score puts speaking and staying silent together: on turns that need memory, recalling a necessary item scores; on turns that do not, staying silent scores; injecting harmful content is penalized. All confidence intervals come from 2,000 bootstrap resamples clustered by session, because turns within one session are correlated and treating them as independent samples would understate uncertainty [34].

#### 5.4 Baselines and fair integration {#en-baselines}

There are four baselines: OpenViking [17], mem0 [14], dense vector retrieval alone [26] and BM25 retrieval alone [27]. The last two are the most basic baselines in retrieval and show whether a complex system really beats simple methods. All systems read the same memory snapshot, use the same embedding model (text-embedding-3-small), and are scored by the same judge. Each system tunes a single threshold on the development set, and the test set is used only for the final report.

Learning from the LoCoMo dispute, I connected each system the way it is meant to be used. OpenViking uses the native interface (context assembly) that plugins such as OpenClaw's call for automatic injection. mem0 uses its own write path (`infer=True`): its LLM distills facts from each document, which are written week by week in order, so each probe can only retrieve memories that already existed at that time.

This proved very important in the experiment. In my first comparison, OpenViking used the generic retrieval interface, which mostly returned directory overviews with metadata, and mem0 stored the original text directly without distillation. In that round, the useful rate of their injected content was only 4.9% and 5.9%. After switching to native usage, it rose to 16.5% and 19.0% respectively, more than three times higher.

#### 5.5 Results {#en-results}

![Figure 4](/images/2026-10-30-one-memory-many-agents/fig4-results.png)

*Figure 4. What each system injects from the same memory under the same recall budget. A is the quality of injected content; B is how much each system says. The test set is 467 judged real conversation turns across 83 sessions. Thin lines are session-clustered 95% confidence intervals.*

The test set ended up with 467 judged turns across 83 sessions. Table 1 gives the results of the five systems under the same injection budget.

| Metric | This system | OpenViking | mem0 | Dense | BM25 |
|-|-|-|-|-|-|
| Items injected per turn | 3.2 | 0.6 | 2.7 | 2.0 | 2.0 |
| Hit rate | **43.9%** | 9.9% | 32.3% | 28.9% | 31.3% |
| Useful content on the 65 memory-needing turns | **56.9%** | 21.5% | 53.8% | 38.5% | 36.9% |
| Useful rate of injected items | **21.0%** | 16.5% | 19.0% | 19.9% | 18.9% |
| Harmful rate of injected items | 2.0% | **1.7%** | 4.6% | 4.3% | 4.8% |

Under the same recall budget, this system's hit rate is 43.9%, 12 to 15 percentage points higher than mem0, BM25 and dense retrieval, and 34 points higher than OpenViking. Its harmful rate is 2.0%, significantly lower than mem0, dense retrieval and BM25, about half of theirs, and comparable to OpenViking. On the 65 turns that really needed memory, this system and mem0 gave useful content at similar rates, 56.9% and 53.8%, both higher than the other three systems.

On the other hand, the accuracy of individual memories does not differ significantly between systems: useful rates all lie between 16% and 21%. So this system's advantage does not come from picking individual memories better. It comes from two places. One is spending the budget more economically. This system injects only a one-line title per memory plus the part of the overview beyond the title, so the same 1,200 bytes hold 3.2 items on average while the other systems hold only 2 to 2.7. The other is filtering. Filtering by project scope and by version chain means this system injects less content from other projects and fewer superseded statements, which shows most clearly in the harmful rate. OpenViking's harmful rate is also low, but mainly because it injects nothing on 59% of turns, which also gives it the lowest hit rate.

If each system is allowed to tune its own best threshold on the development set, the picture changes completely. Every system becomes almost silent, injecting memory on only 1.5% to 5.3% of turns, and composite scores bunch between 0.81 and 0.85, with BM25 highest and this system at 0.84. On the 65 memory-needing turns, no system recalled an item labelled "necessary". The composite scores are so close because 86% of turns need no memory at all, so a system that never speaks still scores well. I therefore do not claim this system beats the baselines on every count. The more accurate statement is that, when a system is willing to inject some dose, this one lets more turns benefit at lower risk.

#### 5.6 Findings about real use {#en-findings}

An extra insight from this evaluation is that moments that really need memory are rare. Of the 467 test turns, the judge found only 65, or 14%, needed memory. Looking closer at those 65 turns, I found that for 42 of them (about two thirds) the information needed was not among any system's candidates. The largest group, 21 turns, were follow-up questions about tasks in progress, such as "is it done yet?"; these need the live state of a task, which is never in long-term memory. The rest were details that had never been written to memory, such as the link to a PR or a specific numeric limit. Even pooling all five systems' candidates, 77.7% of turns contain at least one useful item, so retrieval itself is not the bottleneck. This result says the next thing worth adding is a record of task state; further work on retrieval has small marginal returns. It also contrasts with the setup of benchmarks such as LongMemEval, where every question is guaranteed to have its answer in the history [30].

#### 5.7 Limitations {#en-limitations}

This evaluation has several clear limitations to keep in mind when reading the results. First, the data come from a single user, me, and this system happened to be developed on my data. Other people's usage habits may be completely different.

Second, the evaluation relies only on LLM judges. On the 90 re-judged turns, item labels agreed 86% of the time (Cohen's κ = 0.41), and whether a turn needed memory agreed 69% of the time (κ = 0.17). By Landis and Koch's common scale, the former sits at the low end of moderate agreement and the latter is only slight agreement [35]. Numbers related to whether memory was needed are therefore noisy and should be read with care.

Third, every system read the same already-curated memory, so this evaluation did not compare each system's ability to build memory from raw chat on its own.

Finally, the raw data involve personal privacy and will not be released. I release only the method and anonymized examples.

### 6. Closing {#en-closing}

After this round of work, my understanding of memory systems has changed. I used to think the hard part was remembering more. Now it looks harder to give the right agent the right dose at the right moment, to stay quiet when nothing should be said, and to grow and correct itself when no one is watching.

There are several questions I cannot yet answer. First, profiles are tuned by hand today. Could they be learned from use? For example, every time a coding agent calls `memory_search` on its own, that can be read as a signal that something it should have received was not given, and used to adjust triggers and thresholds. Second, how should this kind of evaluation on real usage records work with many users? One person's data is limited evidence, yet real records naturally involve privacy. Third, two thirds of the memory-needing turns were missing task state. Should that information be taken over by the memory system or handed to a separate task system? I have not worked that out yet.

The build specs and the evaluation kit for this post are open source: <https://github.com/jxtse/dose-mem>

</section>

<section id="cite" markdown="1">

<h2 id="cite-en" data-language-text="en" lang="en">Cite this post</h2>
<h2 id="cite-zh" data-language-text="zh" lang="zh-CN">引用本文</h2>

<p data-language-text="en" lang="en">Please cite this post as:</p>
<p data-language-text="zh" lang="zh-CN">如需引用本文，请使用以下格式：</p>

```bibtex
@article{xie2026memory,
  title = {One Memory, Many Agents: A Shared Memory Layer with Per-Agent Recall},
  author = {Jinxiang Xie},
  journal = {jxtse.github.io},
  year = {2026},
  month = {October},
  url = "https://jxtse.github.io/blog/one-memory-many-agents/#english"
}
```

</section>

<section id="chinese-references" data-language-panel="zh" lang="zh-CN" markdown="1">

## 参考文献 {#zh-references}

\[1\] Meta. How to get started with Muse. Meta Help Center, 2026. [https://www.meta.com/help/superintelligence/1331373868832401/](https://www.meta.com/help/superintelligence/1331373868832401/)

\[2\] Introducing Grok Bot, 2026. [https://x.ai/news/introducing-grok-bot](https://x.ai/news/introducing-grok-bot)

\[3\] OpenClaw: Your assistant, on your devices, in your chats. [https://github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)

\[4\] Nous Research. Hermes Agent. [https://github.com/nousresearch/hermes-agent](https://github.com/nousresearch/hermes-agent)

\[5\] Pi: a minimal agent harness. [https://pi.dev/](https://pi.dev/)

\[6\] Anthropic. How Claude remembers your project. Claude Code Docs. [https://code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory)

\[7\] OpenAI. Memories. ChatGPT Learn. [https://learn.chatgpt.com/docs/customization/memories](https://learn.chatgpt.com/docs/customization/memories)

\[8\] OpenClaw. Memory overview. [https://docs.openclaw.ai/concepts/memory/](https://docs.openclaw.ai/concepts/memory/)

\[9\] Nous Research. Persistent Memory. Hermes Agent Docs. [https://hermes-agent.nousresearch.com/docs/user-guide/features/memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory)

\[10\] Tailscale. Tailscale Serve. [https://tailscale.com/docs/features/tailscale-serve](https://tailscale.com/docs/features/tailscale-serve)

\[11\] Packer, C., Wooders, S., Lin, K., Fang, V., Patil, S. G., Stoica, I., Gonzalez, J. E. MemGPT: Towards LLMs as Operating Systems. arXiv:2310.08560, 2023.

\[12\] Park, J. S., O'Brien, J. C., Cai, C. J., Morris, M. R., Liang, P., Bernstein, M. S. Generative Agents: Interactive Simulacra of Human Behavior. UIST 2023.

\[13\] Zhong, W., Guo, L., Gao, Q., Ye, H., Wang, Y. MemoryBank: Enhancing Large Language Models with Long-Term Memory. AAAI 2024.

\[14\] Chhikara, P., Khant, D., Aryan, S., Singh, T., Yadav, D. Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory. arXiv:2504.19413, 2025.

\[15\] Rasmussen, P., Paliychuk, P., Beauvais, T., Ryan, J., Chalef, D. Zep: A Temporal Knowledge Graph Architecture for Agent Memory. arXiv:2501.13956, 2025.

\[16\] Xu, W., Liang, Z., Mei, K., Gao, H., Tan, J., Zhang, Y. A-Mem: Agentic Memory for LLM Agents. arXiv:2502.12110, 2025.

\[17\] Volcengine. OpenViking: Context Database for AI Agents. [https://github.com/volcengine/OpenViking](https://github.com/volcengine/OpenViking)

\[18\] Liu, N. F., Lin, K., Hewitt, J., Paranjape, A., Bevilacqua, M., Petroni, F., Liang, P. Lost in the Middle: How Language Models Use Long Contexts. TACL 12:157–173, 2024.

\[19\] Shi, F., Chen, X., Misra, K., Scales, N., Dohan, D., Chi, E., Schärli, N., Zhou, D. Large Language Models Can Be Easily Distracted by Irrelevant Context. ICML 2023.

\[20\] Hong, K., Troynikov, A., Huber, J. Context Rot: How Increasing Input Tokens Impacts LLM Performance. Chroma Research, 2025. [https://research.trychroma.com/context-rot](https://research.trychroma.com/context-rot)

\[21\] Anthropic. Effective context engineering for AI agents, 2025. [https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

\[22\] Mallen, A., Asai, A., Zhong, V., Das, R., Khashabi, D., Hajishirzi, H. When Not to Trust Language Models: Investigating Effectiveness of Parametric and Non-Parametric Memories. ACL 2023.

\[23\] Asai, A., Wu, Z., Wang, Y., Sil, A., Hajishirzi, H. Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection. ICLR 2024.

\[24\] Jiang, Z., Xu, F. F., Gao, L., Sun, Z., Liu, Q., Dwivedi-Yu, J., Yang, Y., Callan, J., Neubig, G. Active Retrieval Augmented Generation. EMNLP 2023.

\[25\] Horvitz, E. Principles of Mixed-Initiative User Interfaces. CHI 1999.

\[26\] Karpukhin, V., Oguz, B., Min, S., Lewis, P., Wu, L., Edunov, S., Chen, D., Yih, W. Dense Passage Retrieval for Open-Domain Question Answering. EMNLP 2020.

\[27\] Robertson, S., Zaragoza, H. The Probabilistic Relevance Framework: BM25 and Beyond. Foundations and Trends in Information Retrieval 3(4):333–389, 2009.

\[28\] Cormack, G. V., Clarke, C. L. A., Büttcher, S. Reciprocal Rank Fusion Outperforms Condorcet and Individual Rank Learning Methods. SIGIR 2009.

\[29\] Maharana, A., Lee, D.-H., Tulyakov, S., Bansal, M., Barbieri, F., Fang, Y. Evaluating Very Long-Term Conversational Memory of LLM Agents. ACL 2024.

\[30\] Wu, D., Wang, H., Yu, W., Zhang, Y., Chang, K.-W., Yu, D. LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory. ICLR 2025.

\[31\] Hu, Y., Wang, Y., McAuley, J. Evaluating Memory in LLM Agents via Incremental Multi-Turn Interactions. arXiv:2507.05257, 2025.

\[32\] Zep. Is Mem0 Really SOTA in Agent Memory? 2025. [https://www.getzep.com/blog/lies-damn-lies-statistics-is-mem0-really-sota-in-agent-memory/](https://www.getzep.com/blog/lies-damn-lies-statistics-is-mem0-really-sota-in-agent-memory/)

\[33\] Yadav, D. Revisiting Zep's 84% LoCoMo Claim: Corrected Evaluation & 58.44% Accuracy. GitHub issue getzep/zep-papers#5, 2025.

\[34\] Field, C. A., Welsh, A. H. Bootstrapping Clustered Data. Journal of the Royal Statistical Society Series B 69(3):369–390, 2007.

\[35\] Landis, J. R., Koch, G. G. The Measurement of Observer Agreement for Categorical Data. Biometrics 33(1):159–174, 1977.

</section>

<section id="english-references" data-language-panel="en" lang="en" markdown="1">

## References {#en-references}

\[1\] Meta. How to get started with Muse. Meta Help Center, 2026. [https://www.meta.com/help/superintelligence/1331373868832401/](https://www.meta.com/help/superintelligence/1331373868832401/)

\[2\] Introducing Grok Bot, 2026. [https://x.ai/news/introducing-grok-bot](https://x.ai/news/introducing-grok-bot)

\[3\] OpenClaw: Your assistant, on your devices, in your chats. [https://github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)

\[4\] Nous Research. Hermes Agent. [https://github.com/nousresearch/hermes-agent](https://github.com/nousresearch/hermes-agent)

\[5\] Pi: a minimal agent harness. [https://pi.dev/](https://pi.dev/)

\[6\] Anthropic. How Claude remembers your project. Claude Code Docs. [https://code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory)

\[7\] OpenAI. Memories. ChatGPT Learn. [https://learn.chatgpt.com/docs/customization/memories](https://learn.chatgpt.com/docs/customization/memories)

\[8\] OpenClaw. Memory overview. [https://docs.openclaw.ai/concepts/memory/](https://docs.openclaw.ai/concepts/memory/)

\[9\] Nous Research. Persistent Memory. Hermes Agent Docs. [https://hermes-agent.nousresearch.com/docs/user-guide/features/memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory)

\[10\] Tailscale. Tailscale Serve. [https://tailscale.com/docs/features/tailscale-serve](https://tailscale.com/docs/features/tailscale-serve)

\[11\] Packer, C., Wooders, S., Lin, K., Fang, V., Patil, S. G., Stoica, I., Gonzalez, J. E. MemGPT: Towards LLMs as Operating Systems. arXiv:2310.08560, 2023.

\[12\] Park, J. S., O'Brien, J. C., Cai, C. J., Morris, M. R., Liang, P., Bernstein, M. S. Generative Agents: Interactive Simulacra of Human Behavior. UIST 2023.

\[13\] Zhong, W., Guo, L., Gao, Q., Ye, H., Wang, Y. MemoryBank: Enhancing Large Language Models with Long-Term Memory. AAAI 2024.

\[14\] Chhikara, P., Khant, D., Aryan, S., Singh, T., Yadav, D. Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory. arXiv:2504.19413, 2025.

\[15\] Rasmussen, P., Paliychuk, P., Beauvais, T., Ryan, J., Chalef, D. Zep: A Temporal Knowledge Graph Architecture for Agent Memory. arXiv:2501.13956, 2025.

\[16\] Xu, W., Liang, Z., Mei, K., Gao, H., Tan, J., Zhang, Y. A-Mem: Agentic Memory for LLM Agents. arXiv:2502.12110, 2025.

\[17\] Volcengine. OpenViking: Context Database for AI Agents. [https://github.com/volcengine/OpenViking](https://github.com/volcengine/OpenViking)

\[18\] Liu, N. F., Lin, K., Hewitt, J., Paranjape, A., Bevilacqua, M., Petroni, F., Liang, P. Lost in the Middle: How Language Models Use Long Contexts. TACL 12:157–173, 2024.

\[19\] Shi, F., Chen, X., Misra, K., Scales, N., Dohan, D., Chi, E., Schärli, N., Zhou, D. Large Language Models Can Be Easily Distracted by Irrelevant Context. ICML 2023.

\[20\] Hong, K., Troynikov, A., Huber, J. Context Rot: How Increasing Input Tokens Impacts LLM Performance. Chroma Research, 2025. [https://research.trychroma.com/context-rot](https://research.trychroma.com/context-rot)

\[21\] Anthropic. Effective context engineering for AI agents, 2025. [https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

\[22\] Mallen, A., Asai, A., Zhong, V., Das, R., Khashabi, D., Hajishirzi, H. When Not to Trust Language Models: Investigating Effectiveness of Parametric and Non-Parametric Memories. ACL 2023.

\[23\] Asai, A., Wu, Z., Wang, Y., Sil, A., Hajishirzi, H. Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection. ICLR 2024.

\[24\] Jiang, Z., Xu, F. F., Gao, L., Sun, Z., Liu, Q., Dwivedi-Yu, J., Yang, Y., Callan, J., Neubig, G. Active Retrieval Augmented Generation. EMNLP 2023.

\[25\] Horvitz, E. Principles of Mixed-Initiative User Interfaces. CHI 1999.

\[26\] Karpukhin, V., Oguz, B., Min, S., Lewis, P., Wu, L., Edunov, S., Chen, D., Yih, W. Dense Passage Retrieval for Open-Domain Question Answering. EMNLP 2020.

\[27\] Robertson, S., Zaragoza, H. The Probabilistic Relevance Framework: BM25 and Beyond. Foundations and Trends in Information Retrieval 3(4):333–389, 2009.

\[28\] Cormack, G. V., Clarke, C. L. A., Büttcher, S. Reciprocal Rank Fusion Outperforms Condorcet and Individual Rank Learning Methods. SIGIR 2009.

\[29\] Maharana, A., Lee, D.-H., Tulyakov, S., Bansal, M., Barbieri, F., Fang, Y. Evaluating Very Long-Term Conversational Memory of LLM Agents. ACL 2024.

\[30\] Wu, D., Wang, H., Yu, W., Zhang, Y., Chang, K.-W., Yu, D. LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory. ICLR 2025.

\[31\] Hu, Y., Wang, Y., McAuley, J. Evaluating Memory in LLM Agents via Incremental Multi-Turn Interactions. arXiv:2507.05257, 2025.

\[32\] Zep. Is Mem0 Really SOTA in Agent Memory? 2025. [https://www.getzep.com/blog/lies-damn-lies-statistics-is-mem0-really-sota-in-agent-memory/](https://www.getzep.com/blog/lies-damn-lies-statistics-is-mem0-really-sota-in-agent-memory/)

\[33\] Yadav, D. Revisiting Zep's 84% LoCoMo Claim: Corrected Evaluation & 58.44% Accuracy. GitHub issue getzep/zep-papers#5, 2025.

\[34\] Field, C. A., Welsh, A. H. Bootstrapping Clustered Data. Journal of the Royal Statistical Society Series B 69(3):369–390, 2007.

\[35\] Landis, J. R., Koch, G. G. The Measurement of Observer Agreement for Categorical Data. Biometrics 33(1):159–174, 1977.

</section>
