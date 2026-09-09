---
layout: post
title: "Where Collective Intelligence Hits Its Ceiling"
bilingual: true
title_zh: "集体智能的天花板在哪里"
description_zh: "深入探讨编排、多智能体强化学习与一次离线投票审计：为什么多样化的智能体不会自动带来集体收益，以及如何通过协调与融合保留有价值的差异。"
date: 2026-09-09
author: "Jinxiang Xie"
description: "A closer look at orchestration, multi-agent reinforcement learning, and an offline voting audit: why diverse agents do not automatically deliver collective gains, and what it takes to preserve useful differences through coordination and fusion."
cover_image: /images/2026-09-09-where-collective-intelligence-hits-its-ceiling/cover.jpg
categories: [AI, Research]
permalink: /blog/where-collective-intelligence-hits-its-ceiling/
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

## 集体智能的天花板在哪里

*Where Collective Intelligence Hits Its Ceiling*

谢锦翔（Jinxiang Xie） · 2026 年 9 月 9 日

当前有很多机构在探索 collective intelligence。我最近关注的技术路线主要有两条：训练模型如何组织其他模型，以及让多个模型共同接受训练。这篇文章整理我的调研和分析，也会随着后续实验持续更新。先把判断放在前面：**增加 agent 的数量和差异，并不自动产生更强的集体能力。系统甚至可能无法利用成员已经给出的正确答案。**

这里需要区分超过最强单模型的平均成绩、超过同预算独立采样的候选覆盖率，以及产生成员独立探索时无法得到的解。它们是不同的主张。对于只在固定候选池中选择答案的机制，候选覆盖率确实构成上限；但这个限制不能直接推广到交互推理、任务分解、工具反馈和训练后的泛化。因此，我讨论的是当前机制在哪里遇到瓶颈，而不是证明集体智能存在一个普遍不可突破的能力上限。

### 范式一：Orchestration

第一条路线是 **orchestration（编排）**，代表是 Sakana AI 的 [Fugu](https://sakana.ai/fugu/)。思路是优化一个 coordinator，负责把任务拆解、路由给合适的 subagent（worker），再把结果汇总，对外封装成单一模型接口。它建立在 [Trinity](https://arxiv.org/abs/2512.04695) 和 [Conductor](https://arxiv.org/abs/2512.04388) 两篇 ICLR 2026 工作之上。[技术报告](https://arxiv.org/abs/2606.21228)里的 Fugu-Ultra 是更完整的形态：用 LLM 生成工作流，组织各个 subagent 的任务、状态和上下文。

产品侧也在使用类似的分工：Claude Code / Codex 的 subagent 机制，以及 Cursor 的 [agent swarm](https://cursor.com/cn/blog/agent-swarm-model-economics)。学界还有 [AgentFlow](https://arxiv.org/abs/2510.05592)、[Lemon](https://arxiv.org/abs/2605.14483) 等优化编排器的工作，把训练重点放在 planner 或 orchestrator 上，而不是同时更新所有 worker。我认为这种架构相比单 agent，最直观的两个收益是：

**1. 上下文隔离。** Coordinator 掌握全局进度，worker 专注单个任务。Cursor 的解释是，swarm 的可扩展性可能更多来自上下文效率：模型可以专注一个具体任务，不必同时保留所有任务的细节，从而减轻上下文过载。

**2. 并行加速。** 分而治之可以降低可并行任务的整体延迟。但代价同样真实：各环节相互依赖时，一个错误可能向下游传播；agent 间的通信损失，也可能让系统低于单 agent。除此之外，异构模型的能力互补和成本路由也是潜在收益，不能只用前面两点概括。

这条路线的瓶颈，更准确地说是**协调与验证**。Fugu 的 benchmark 成绩可以超过池中任何单个成员，但任务是否被正确拆解、必要上下文是否被传递、相互冲突的结果是否被识别，仍然需要系统解决。如果 coordinator 不加验证地采信 subagent 的结果，系统可能在不知不觉中失败；如果提供的上下文不足，worker 则可能从一开始就误解任务。

[Anthropic 的游戏实验](https://www.anthropic.com/research/multiagent-systems)提供了一个有意思的对照：让 agent swarm 花 12 小时协作开发开放世界游戏，尝试自由组队、预设角色和指定 CEO 三种组织方式，最终游戏质量都很差。不过，不同代际模型的协作行为并不相同。Sonnet 4.6 和 Opus 4.6 难以合并彼此的工作；Opus 4.8 和 Mythos Preview 更多通过维持文件所有权、减少直接合作来避开冲突；Sonnet 5 则同时保持了较高的代码共享和 PR 合并率。

这些结果说明，摆好组织结构并不足以获得协调，但也不能据此断言协调只能来自最强模型，或仅靠模型变强就会自然出现。Trinity 本身就允许把验证交给 Verifier worker：coordinator 不必独自完成所有深度验证，难点在于它能否可靠地组织验证、处理冲突并决定何时继续。对于长时间、高依赖的任务，这仍是我对第一条路线最关心的问题。

### 范式二：Multi-Agent RL

第二条路线是 **multi-agent RL（多智能体强化学习）**。以 [Co-RL](https://arxiv.org/abs/2608.17253) 为例，它让多个不共享参数的模型同时接受 RL 训练。每个模型先从自己的多次采样中得到投票伪答案，再用这个答案监督另一个模型；在多于两个模型的设置中，监督可以沿有向环传递。它的关键发现是，异构模型家族、模型规模与输入改写带来的 cohort diversity，可以减少相关错误、缓解 self-rewarding 中的训练坍缩。

同一大方向还有 [MAPoRL](https://aclanthology.org/2025.acl-long.1459/) 和 [MAGRPO](https://arxiv.org/abs/2508.04652)，但机制并不相同。MAPoRL 包含多模型讨论、verifier 评分以及鼓励纠错和说服的奖励；MAGRPO 则优化多轮协作。因此，不能把整个 multi-agent RL 都简化成“独立采样，再固定投票”。通信协议固定，也不意味着协议中的协作行为不能被学到。

对于 Co-RL 这类依赖采样伪标签的方法，**采样覆盖和监督信号质量**是直接瓶颈。在某次更新中，只有实际出现并进入伪标签的答案，才能提供相应的直接监督。增加 diversity 有机会减少共同错误、扩大候选覆盖，但投票本身不会构造候选之外的新解。这是单次采样与聚合的限制，不能直接当作训练后泛化能力的定理。

Self-rewarding 的风险也需要说得更具体：当某个错误答案稳定占据众数时，用它作为伪标签可能继续强化错误。正确答案的采样概率低于一半，并不一定意味着最高票答案错误，因为其他错误可能分散到许多不同答案上。跨模型监督的价值，在于不同模型未必共享同一个错误众数；如果它们的错误高度相关，这个优势就会减弱。

#### 一次离线投票审计

为了看清这个机制，我对 Co-RL 复现配置在**训练起点**的采样做了一次离线审计：8,740 道 MATH-Level345 训练题，三个模型分别是 Qwen2.5-3B、Llama-3.2-3B-Instruct 和 Qwen3-1.7B-Base，每题每模型采样 K=12。答案提取与判分沿用复现仓库的代码。

这里要区分实际训练和额外审计：实际三模型训练使用环形同伴监督；下面的跨模型投票是另一项离线分析。它先取每个模型自己的众数答案，再让每个模型投一票，选出唯一最高票答案；最高票并列时不接受标签。以下把它简称为跨模型投票。

| 配置 | 全题正确率 | 标签覆盖率 | 已接受标签中的准确率 |
| --- | --- | --- | --- |
| Qwen2.5-3B 的模型内众数 | 50.82% | 100% | 50.82% |
| Llama-3.2-3B-Instruct 的模型内众数 | 51.57% | 100% | 51.57% |
| Qwen3-1.7B-Base 的模型内众数 | 52.32% | 100% | 52.32% |
| 三模型跨模型投票 | 51.48% | 66.34% | 77.60% |

全题正确率把没有被接受的标签计为未答对；标签覆盖率是产生被接受标签的题目比例；条件准确率只在这些题目上计算。三个指标必须一起看：投票提高了已接受标签的纯度，但放弃了部分题目，没有提高整体正确覆盖。

三个模型的**模型内众数答案均错误**的题目占 31.6%，跨模型投票救回率为零。这个零是结构性的：只从三个错误众数中选择，不可能得到正确答案；它不表示原始全部采样里都没有正确答案。模型间众数答案的错误相关性 φ 为 0.48–0.67，其中 Qwen2.5 与 Qwen3 这对同家族模型最高。这说明它们在当前条件下存在共同失败模式，不能直接解释为潜在知识边界的重合程度。

我还在固定的 2,000 题子样本上加入强模型的答案，观察等权投票能否保留高质量意见。小模型仍然各自提供一个众数答案；每个强模型提供一个 greedy 答案，仍然每模型一票，并列时不接受标签。

| 子样本上的模型池 | 全题正确率 | 标签覆盖率 | 已接受标签中的准确率 |
| --- | --- | --- | --- |
| 三个小模型 + GPT-5.6 Sol | 63.60% | 74.60% | 85.25% |
| 三个小模型 + Claude-Fable-5 | 64.10% | 74.95% | 85.52% |
| 三个小模型 + 两个强模型 | 85.20% | 89.30% | 95.41% |

这组结果不能与上表全量训练集直接作增益比较，也不是同预算的模型能力排名。它考察的是给定答案池上的聚合行为。加入两个强模型后，已接受标签的准确率很高，但全题正确率仍低于这个条件指标。两个强模型在双方答案都能解析的题目上有 92.18% 的精确答案一致率，因此结果更接近强模型之间的一致意见获得了更大的投票影响力，而不是某个最强成员自动主导集体判断。

**这次审计支持的判断是：简单等权投票会在标签纯度与覆盖率之间取舍，也可能无法保留高质量的少数意见。** 它没有验证 Co-RL 训练后的能力上限，更不能证明整个 multi-agent RL 没有纠错能力。把 Co-RL 理解为跨模型伪标签监督、互相传递可用能力，是一个有帮助的视角，但它仍需与实际的环形训练机制对应起来。

### 群体智能的瓶颈及未来探索方向

我仍然认为，增大模型采样中**有用的 diversity**，再想办法利用这些差异，是群体智能值得继续探索的方向。

#### 从采样数据分布的角度

Diversity 这一半有据可依。Co-RL 的消融支持异构 family 和输入改写减少相关错误、缓解训练坍缩。[Anthropic 的实验](https://www.anthropic.com/research/multiagent-systems)则从反面展示了同源 agent 的低方差：30 个同模型 agent 协作开发游戏，18 个创建了同名 git 分支 `mvp-game-loop`；管理有限带宽任务队列时，agent 部署高频轮询，一次运行产生 240 万个请求，却只有 117 个任务被接受。个体层面的相似倾向，在集体中可能被放大成系统性失效。

困难在于，后训练常常会使输出分布变尖、降低多样性。[DivPO](https://arxiv.org/abs/2501.18101) 直接优化质量约束下的响应多样性；[DPEPO](https://arxiv.org/abs/2604.24320) 通过动作和状态转移奖励鼓励多样的并行探索；[EvoDiverse](https://arxiv.org/abs/2606.10587) 则在推理时的科学假设搜索中借鉴 parallel tempering，缓解搜索分布的坍缩。这些工作处理的对象不同，但都提示：只保留单一高分模式可能损失有价值的候选。调高 temperature 可以改变采样分布，却不能保证得到高质量、语义上互补的解。

顺着这个问题，我更关心的是：diversity 应该定义在什么对象上？[Knowledge boundary](https://arxiv.org/abs/2402.11493) 的工作提供了一个有用的概念：固定问法下答错，不代表模型在语义等价的其他问法下也答不对。因此，单次采样无法代表模型关于这个问题的全部可达能力。不过，有限的改写搜索也无法证明已经穷尽了这个范围。

对 multi-agent 来说，我想要的并非只是几个模型这次恰好答得不同，而是**在保持质量的前提下，减少共同盲区、扩大互补覆盖**。共享正确的基础知识是有价值的；单纯让 knowledge boundary 尽可能少重合，反而可能通过遗忘知识或制造错误实现。

这里可以借 nrehiew 那篇[从分布视角看 post-training 的 blog](https://nrehiew.github.io/blog/sft_rl_opd/) 来组织直觉：SFT 通过外部数据提供目标，在线 RL 则通过当前策略访问到的轨迹接受反馈。前者可以示范当前模型难以采到的行为；后者的探索受当前采样分布影响。这个框架并不是严格的能力边界证明。若希望 SFT 把几个模型的分布拉开，还需要不同的高质量目标数据或显式约束；RL 也可以通过质量与多样性目标改变探索方向。

我期待未来 multi-agent system 中的各个 agent 拥有更异构、又不牺牲基本能力的分布，能提供真正互补的视角，而不只是换一个角色提示词。

#### 从 fusion 的角度

Fusion 才是更难的一半。普通答案投票需要可判等的候选，大量开放式任务和长时间轨迹很难直接适用。[When Agents Disagree](https://arxiv.org/abs/2603.20324) 把这个问题称为 selection bottleneck：在其建模和单轮选择实验中，diverse pool 的收益取决于 selector 的质量。这个结果不应被直接推广成所有融合机制的定律，但它提出了一个好问题：如果不能识别差异中的价值，更多候选究竟是在提供机会，还是增加噪声？

一旦需要一个 learned fusion 模块读懂多个候选、判断每个候选对在哪里，再把有用部分合起来，它就开始接近第一条路线里的 coordinator。但选择一个完整候选、综合多个方案和协调长期执行，仍然是不同任务，未必应由单一模块承担。

[Cursor 的 SQLite 实验](https://cursor.com/cn/blog/agent-swarm-model-economics)提供了量化的失败记录：旧版 swarm 在前两小时产生 68,000 次 commit，累计超过 70,000 次 merge conflict，接近两小时时被暂停；冲突最严重的文件被 1,173 个 agent 改动，发生 7,771 次冲突；项目扩张成 54 个 crate，其中有三个独立的 SQL package。

更重要的是改进后的对照：同模型条件下，引入中立仲裁 agent、共享设计文档、超大文件标记等 harness 机制，显著减少了冲突。这不是模型自己通过训练学会协调的证据，却是**机制设计可以改善集体表现**的证据。环境和协议本来就是协作系统的一部分。

也可以通过为多个 agent 分配信息差来构造 diversity，而聚合这些信息并不容易。[Anthropic 的 hidden profile 实验](https://www.anthropic.com/research/multiagent-systems)把事实分散给四个 agent：共享证据支持错误选项，独家信息则可以改变决策。讨论后的集体表现仍未达到单 agent 获得全部事实的 solo ceiling。这个设置说明，信息分布式存在，不等于系统能有效使用它。识别私有事实的重要性、表达它、以及让其他成员据此更新判断，都是需要解决的能力问题。

我期待更可靠的协调机制能从多样的轨迹中提取重要信息，并按照全局目标稳步推进任务。它可能来自更强的模型，也可能来自更好的验证、协议、环境反馈和训练目标。两条路线会在这里交汇。对我来说，接下来最值得追问的是：怎样制造有价值的差异，又怎样让这些差异在形成集体判断时不被抹掉？

[Read in English ↓](#english)

</section>

<section id="english" data-language-panel="en" lang="en" markdown="1">

## Where Collective Intelligence Hits Its Ceiling

Jinxiang Xie · September 9, 2026

Many organizations are exploring collective intelligence. Two directions have occupied most of my recent reading: training a model to organize other models, and training multiple models together. This post collects my observations and analysis, which I expect to update as the experiments develop. My current view is straightforward: **adding more agents, or making them more different, does not automatically produce stronger collective capability. A system may fail to use even the correct answers its members already provide.**

We should distinguish outperforming the best individual model on average, exceeding the candidate coverage of compute-matched independent sampling, and producing solutions that members cannot reach through independent exploration. These are different claims. For a mechanism that only selects from a fixed candidate pool, candidate coverage is indeed an upper bound. That restriction does not directly extend to interactive reasoning, task decomposition, tool feedback, or generalization after training. I am interested in where current mechanisms encounter bottlenecks, not in proving a universal impossibility result for collective intelligence.

### Paradigm One: Orchestration

The first direction is **orchestration**, exemplified by Sakana AI's [Fugu](https://sakana.ai/fugu/). The idea is to optimize a coordinator that decomposes tasks, routes them to suitable subagents or workers, and combines their outputs, exposing the system through a single model interface. Fugu builds on two ICLR 2026 papers, [Trinity](https://arxiv.org/abs/2512.04695) and [Conductor](https://arxiv.org/abs/2512.04388). Fugu-Ultra, described in the [technical report](https://arxiv.org/abs/2606.21228), is a more developed version: an LLM generates workflows and organizes subagent tasks, state, and context.

Similar divisions of labor appear in products: the subagent mechanisms in Claude Code and Codex, and Cursor's [agent swarm](https://cursor.com/cn/blog/agent-swarm-model-economics). Research systems such as [AgentFlow](https://arxiv.org/abs/2510.05592) and [Lemon](https://arxiv.org/abs/2605.14483) also focus optimization on a planner or orchestrator rather than jointly updating every worker. Compared with a single agent, I see two especially immediate benefits:

**1. Context isolation.** The coordinator tracks global progress while each worker focuses on a specific task. Cursor suggests that swarm scalability may owe more to context efficiency than to parallelism: a model can focus on one piece of work without retaining the details of every other task, reducing context overload.

**2. Parallel speedup.** Divide-and-conquer can reduce latency for parallelizable work. But the costs are real too. When stages depend on one another, an error can propagate downstream, and information lost in communication can leave the system worse than a single agent. These are not the only possible benefits: complementary model capabilities and cost-aware routing also matter.

The bottleneck here is more accurately described as **coordination and verification**. Fugu can outperform any individual member of its pool on benchmarks, but the system still has to decompose tasks correctly, transmit necessary context, and recognize conflicting results. If a coordinator accepts a subagent's report without verification, the system may fail silently. If it supplies too little context, a worker may misunderstand the task from the outset.

[Anthropic's game-development experiment](https://www.anthropic.com/research/multiagent-systems) offers an interesting comparison. Agent swarms spent 12 hours building open-world games under three organizational prompts: freely forming teams, prescribed roles, and a designated CEO. The resulting games were poor in all three conditions. Yet coordination differed across model generations. Sonnet 4.6 and Opus 4.6 struggled to merge each other's work. Opus 4.8 and Mythos Preview largely avoided conflicts by retaining ownership of files and collaborating less directly. Sonnet 5 maintained both relatively high code sharing and a high PR merge rate.

These results show that installing an organizational structure is insufficient. They do not establish that coordination can only come from the strongest models, or that stronger models will acquire it automatically. Trinity itself can delegate verification to a Verifier worker. A coordinator need not perform every difficult verification step personally; the challenge is organizing verification reliably, resolving conflicts, and deciding when to proceed. For long-running tasks with substantial dependencies, this remains my main concern about orchestration.

### Paradigm Two: Multi-Agent RL

The second direction is **multi-agent reinforcement learning**. In [Co-RL](https://arxiv.org/abs/2608.17253), for example, several models with separate parameters undergo RL simultaneously. Each model first obtains a voted pseudo-answer from its own samples, then uses that answer to supervise another model. With more than two models, supervision can pass along a directed ring. A central finding is that cohort diversity, introduced through heterogeneous model families, sizes, and rephrased inputs, can reduce correlated errors and mitigate the training collapse associated with self-rewarding.

[MAPoRL](https://aclanthology.org/2025.acl-long.1459/) and [MAGRPO](https://arxiv.org/abs/2508.04652) belong to the broader direction, but their mechanisms differ. MAPoRL includes discussion, verifier scoring, and incentives for correction and persuasion; MAGRPO optimizes multi-turn collaboration. It would therefore be misleading to reduce all multi-agent RL to independent sampling followed by fixed voting. A fixed communication protocol does not imply that the collaborative behavior inside it cannot be learned.

For methods that depend on sampled pseudo-labels, such as Co-RL, **sampling coverage and supervision quality** are immediate bottlenecks. At a given update, an answer must actually appear and enter the pseudo-label to provide the corresponding direct supervision. Diversity may reduce shared mistakes and expand coverage, but voting itself does not construct a solution outside the candidate pool. That is a restriction on a particular sampling-and-aggregation step, not a theorem about post-training generalization.

The risk in self-rewarding also deserves precision. When a wrong answer is a stable mode of the answer distribution, treating it as a pseudo-label can reinforce the mistake. A correct-answer probability below one half does not necessarily imply that the most-voted answer is wrong: incorrect answers may be distributed across many alternatives. Cross-model supervision is useful when models do not share the same wrong mode. Highly correlated errors weaken that advantage.

#### An Offline Voting Audit

To examine the mechanism, I audited samples from a Co-RL replication configuration **at the start of training**: 8,740 MATH-Level345 training questions, three models (Qwen2.5-3B, Llama-3.2-3B-Instruct, and Qwen3-1.7B-Base), and K=12 samples per model per question. Answer extraction and grading followed the replication repository's code.

The actual training mechanism and this additional audit must be separated. The three-model training setup uses ring-based peer supervision. The cross-model vote below is a separate offline analysis: first obtain each model's modal answer, then give each model one vote and select the unique plurality winner. Ties are rejected. I refer to this as cross-model voting below.

| Configuration | All-question accuracy | Label coverage | Accuracy among accepted labels |
| --- | --- | --- | --- |
| Qwen2.5-3B within-model mode | 50.82% | 100% | 50.82% |
| Llama-3.2-3B-Instruct within-model mode | 51.57% | 100% | 51.57% |
| Qwen3-1.7B-Base within-model mode | 52.32% | 100% | 52.32% |
| Three-model cross-model vote | 51.48% | 66.34% | 77.60% |

All-question accuracy counts rejected labels as unsuccessful answers. Label coverage is the fraction of questions receiving an accepted label. Conditional accuracy is computed only over those questions. These metrics need to be read together: voting improved the purity of accepted labels but gave up coverage, without increasing the overall fraction of questions correctly answered.

On 31.6% of questions, **all three within-model modal answers were wrong**. Cross-model voting rescued none of them. That zero is structural: selecting among three wrong modal answers cannot produce a correct one. It does not mean that no correct answer existed among all the original samples. Error correlations, measured by φ on modal-answer correctness, ranged from 0.48 to 0.67, with the same-family Qwen2.5–Qwen3 pair highest. This establishes shared failure patterns under the tested conditions, not the overlap of the models' latent knowledge boundaries.

I also added strong-model answers on a fixed 2,000-question subsample to examine whether equal-weight voting could preserve high-quality opinions. Each small model still supplied one modal answer, while each strong model supplied one greedy answer. Every model received one vote, and ties were rejected.

| Model pool on the subsample | All-question accuracy | Label coverage | Accuracy among accepted labels |
| --- | --- | --- | --- |
| Three small models + GPT-5.6 Sol | 63.60% | 74.60% | 85.25% |
| Three small models + Claude-Fable-5 | 64.10% | 74.95% | 85.52% |
| Three small models + both strong models | 85.20% | 89.30% | 95.41% |

These results should not be compared directly with the full-training-set table to calculate gains, nor are they a compute-matched model ranking. They probe aggregation over a given answer pool. With both strong models, accepted labels were highly accurate, but all-question accuracy remained below that conditional figure. The two strong models had 92.18% exact-answer agreement on questions where both answers parsed successfully. The result is therefore closer to agreement between two strong models gaining voting influence than to the strongest individual automatically dominating collective judgment.

**What this audit supports is that simple equal-weight voting trades label purity against coverage and may fail to preserve high-quality minority opinions.** It does not test Co-RL's post-training capability ceiling, much less establish that multi-agent RL cannot correct errors. Thinking of Co-RL as cross-model pseudo-label supervision that transfers useful capabilities between peers is helpful, but the interpretation must remain faithful to its actual ring-based training mechanism.

### Bottlenecks and Directions Worth Exploring

I still think that increasing **useful diversity** in model samples, then finding ways to exploit those differences, is a promising direction for collective intelligence.

#### The Sampling-Distribution Perspective

There is evidence for the diversity half. Co-RL's ablations support heterogeneous families and input rephrasing as ways to reduce correlated errors and mitigate collapse. [Anthropic's experiments](https://www.anthropic.com/research/multiagent-systems) illustrate the opposite problem: low variance among agents built on the same model. In a game-development run, 18 of 30 agents created a branch named `mvp-game-loop`. In a bandwidth-limited job-queue experiment, agents deployed high-frequency polling; one run produced 2.4 million requests but only 117 accepted jobs. Similar individual tendencies can become systemic failures when amplified across a group.

One difficulty is that post-training often sharpens the output distribution and reduces diversity. [DivPO](https://arxiv.org/abs/2501.18101) directly optimizes response diversity subject to quality constraints. [DPEPO](https://arxiv.org/abs/2604.24320) encourages diverse parallel exploration through action and state-transition rewards. [EvoDiverse](https://arxiv.org/abs/2606.10587) draws on parallel tempering to counter collapse during inference-time scientific hypothesis search. These methods operate on different objects, but all suggest that retaining only a single high-scoring mode can discard valuable candidates. Raising temperature changes the sampling distribution; it does not guarantee high-quality, semantically complementary solutions.

This leads to a more basic question: what should diversity be defined over? Work on [knowledge boundaries](https://arxiv.org/abs/2402.11493) offers a useful concept. A model answering incorrectly under one wording may answer correctly under a semantically equivalent prompt. A single sample therefore cannot represent everything the model can reach on that question. Conversely, a finite paraphrase search cannot prove that this range has been exhausted.

For multi-agent systems, I want more than models happening to answer differently on a particular draw. I want to **reduce shared blind spots and expand complementary coverage while preserving quality**. Shared correct foundational knowledge is useful. Minimizing knowledge-boundary overlap indiscriminately could instead be achieved by forgetting knowledge or introducing errors.

I find nrehiew's [distributional view of post-training](https://nrehiew.github.io/blog/sft_rl_opd/) helpful for organizing this intuition. SFT supplies a target through external data, whereas online RL receives feedback on trajectories visited by the current policy. The former can demonstrate behavior the current model rarely samples; the latter's exploration depends on its current sampling distribution. This is not a rigorous capability-boundary argument. To separate several models through SFT, we still need distinct high-quality target data or explicit constraints. RL can also reshape exploration through quality and diversity objectives.

I would like agents in future multi-agent systems to have more heterogeneous distributions without sacrificing basic competence, providing genuinely complementary perspectives rather than merely receiving different role prompts.

#### The Fusion Perspective

Fusion is the harder half. Ordinary answer voting requires candidates that can be tested for equivalence, which makes it difficult to apply directly to many open-ended tasks and long-horizon trajectories. [When Agents Disagree](https://arxiv.org/abs/2603.20324) calls this the selection bottleneck: in its model and single-round selection experiments, the benefit of a diverse pool depends on selector quality. This should not be generalized into a law for all fusion mechanisms, but it raises a useful question. If a system cannot recognize the value in differences, do more candidates provide opportunities or merely add noise?

Once a learned fusion module needs to read multiple candidates, identify what each gets right, and combine useful parts, it begins to resemble the coordinator in the first paradigm. Still, selecting a complete candidate, synthesizing several proposals, and coordinating long-running execution are different tasks. They need not all belong to a single module.

[Cursor's SQLite experiment](https://cursor.com/cn/blog/agent-swarm-model-economics) provides quantitative failure records. The old swarm generated 68,000 commits during its first two hours and accumulated more than 70,000 merge conflicts before being paused near the two-hour mark. The most contested file was modified by 1,173 agents and incurred 7,771 conflicts. The project expanded to 54 crates, including three independent SQL packages.

The improved comparison matters more. With the same models, harness changes including neutral arbitration agents, shared design documents, and oversized-file flags substantially reduced conflicts. This is not evidence that models learned coordination through training. It is evidence that **mechanism design can improve collective performance**. Environments and protocols are part of a collaborative system.

Diversity can also be introduced by distributing different information to different agents, but aggregating it is difficult. In [Anthropic's hidden-profile experiment](https://www.anthropic.com/research/multiagent-systems), facts were distributed across four agents: shared evidence favored the wrong option, while unique information could change the decision. After discussion, collective performance still fell short of the solo ceiling, where one agent received every fact. Distributed possession of information does not guarantee effective use. Recognizing the importance of private evidence, communicating it, and getting other members to update their judgments are all capabilities that need to be addressed.

I hope more reliable coordination mechanisms can extract important information from diverse trajectories and steadily advance work toward a global objective. They may come from stronger models, but also from better verification, protocols, environmental feedback, and training objectives. The two directions meet here. The question I most want to pursue is how to create valuable differences, then prevent them from being erased as a group arrives at a collective judgment.


[返回中文 / Back to Chinese ↑](#chinese)

</section>

---

<section id="cite" markdown="1">

<h2 id="cite-en" data-language-text="en" lang="en">Cite this post</h2>
<h2 id="cite-zh" data-language-text="zh" lang="zh-CN">引用本文</h2>

<p data-language-text="en" lang="en">Please cite this post as:</p>
<p data-language-text="zh" lang="zh-CN">如需引用本文，请使用以下格式：</p>

```bibtex
@article{xie2026collective,
  title = {Where Collective Intelligence Hits Its Ceiling},
  author = {Jinxiang Xie},
  journal = {jxtse.github.io},
  year = {2026},
  month = {September},
  url = "https://jxtse.github.io/blog/where-collective-intelligence-hits-its-ceiling/"
}
```

</section>
