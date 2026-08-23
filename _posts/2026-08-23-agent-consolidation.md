---
layout: post
title: "Consolidating an Agent That Outgrew Itself"
date: 2026-08-23
description: "After months of heavy use, my AI agent had accumulated 272 skills, plaintext API keys, and a 43K-token fixed context — with no way to check its own reasoning. A day of consolidation: usage-based skill retirement, secrets management, context-layer slimming, and a second-model auditor that caught two real errors."
cover_image: /images/2026-08-23-agent-consolidation/cover.jpg
categories: [AI, Agents, Engineering]
---

I have now been using Hermes heavily for months. Its biggest selling point is a self-improving loop: whenever it solves a hard problem, it packages the solution as a reusable skill and loads it next time. Great in theory. In practice, the library only grows, and problems pile up over time. Last week I spent a full day on consolidation, dedicated to auditing what was already there and cleaning up what had accumulated.

## The skill library

After months of heavy use, my Hermes library had 272 skills. I audited all of them by actual load history. 25 had zero loads across 100 days of available history. They were injected into the context window on every turn, costing tokens and polluting recall, and had never been called once. Another 16 were Codex skills stalled at 5 or fewer sessions, untouched for over a month. 41 skills in total, about 15% of the library, doing nothing but taking up space.

11 of those 25 zero-load skills were created by Hermes's own self-improving loop. It kept packaging solutions to one-off problems, adding them to the library, and they sat there forever. A skill for architecture diagrams. A skill for kanban task lanes. Each solved a real problem once, got packaged, and was never used again.

So I built a retirement system.

The only honest signal is that Hermes actually loaded a skill, which gets logged. A skill becomes a retirement candidate if it is at least 60 days old with zero loads across 60 days of history. Loaded fewer than twice ever and untouched for 90 days, it goes to manual review. New installs get a 60-day grace period, because a fresh skill has not had time to prove itself.

Not everything low-usage gets retired. Suite skills that come in families, governance and infrastructure skills, memory and model routing, core debugging tools are pinned and never auto-retired. Some have near-zero load frequency and that is fine, because deleting them breaks a suite or removes something I would really want the day I suddenly need it.

After the cleanup the library is at 231 skills. Even now, 48 of those have never been loaded and 111 have been used twice or fewer. The honest number I actually need is probably half of what is left. A recurring audit cron job keeps working through them.

![Usage distribution of the 231 remaining skills](/images/2026-08-23-agent-consolidation/fig1-skill-usage.jpg)
*Figure 1 | Usage distribution of the 231 remaining skills. From the usage-history audit of 22 Aug 2026; a load means Hermes opened the skill instructions.*

## Credentials

Hermes now ships a way to store API keys securely on the local machine, but somehow my machine was covered in API keys Hermes had stored in plaintext. This includes keys I had pasted into chat messages — those get stored verbatim in session history and can be surfaced later by the session-search tool. Not great.

Several of its skill scripts were reading API keys from `~/.zshrc` and `~/.hermes/.env` — plaintext files with full credentials on disk. The Feishu gateway scripts sourced the env file directly. The Zotero helper shelled out to `source ~/.zshrc` and parsed the output. The WeRead analysis script read the key from a line in `~/.zshrc` by anchoring on the key prefix. A few of these scripts Hermes had written for itself. So Hermes was creating code that read my secrets, storing that code in its own library, and running it with my permissions.

I migrated everything to a secrets manager. Config files now reference environment variables, not raw keys. Secrets get injected at runtime from Bitwarden, cached in an encrypted local file (ChaCha20-Poly1305 with HKDF-derived keys). Skill scripts only read from the process environment; if a key is not there, they fail closed. And I turned on automatic redaction of key-like strings in tool output, so even if a secret leaks into a log, it gets masked before it hits the context window.

Cases from around the internet show that sometimes the threat model is not a remote attacker. It is Hermes itself — reading a file it should not, echoing a key into a prompt, or writing a script that sources your shell config. My fix is defense in depth: no plaintext secrets on disk, runtime injection only, fail-closed scripts, output redaction. Any one layer can fail without exposing credentials, because the others are still in place.

One more benefit: I can now add, edit, view, and delete all my API keys in one place in the Bitwarden web UI, and distribute them quickly and safely to any new device — like a freshly provisioned cloud server.

## The context window

Hermes's fixed context is more than just skills. Before every model call, the system prompt, MEMORY.md, USER.md, and the skill index enter the context window together. Almost all of them keep growing through Hermes's self-improving mechanisms.

I measured a complete fixed prefix: about 174 KB, roughly 43.5K tokens. The system prompt (with the skill index) was about 72 KB, MEMORY.md about 21 KB, USER.md about 9 KB, tool schemas about 72 KB. The problem is not just cost. Before the model has even seen the user's question, this information has already claimed a large share of the context window.

Some background on how my memory system is layered — three layers. At the top are MEMORY.md and USER.md, two Markdown files injected in full at session start, acting as a compressed global index: who I am, stable preferences, system conventions, one line per project. The second layer is Research Brain, a local Markdown + Git repository that is the authoritative fact layer for all research projects. Each project has a working brief, decision records, a timeline, and open questions; Hermes writes back new decisions and experiment results append-only, and multiple agents (Hermes, Claude Code, Codex) share the same copy. It is not injected into context — it gets opened by path when needed. The third layer is mem0local, local semantic retrieval (vectors + BM25) over atomic facts. Each turn automatically recalls the few most relevant entries, and the agent can search it explicitly; high-confidence facts from Research Brain get distilled into memory cards and indexed by a nightly pipeline. The layering principle is simple: the higher up, the more stable and compressed; the lower down, the more detailed and retrieved on demand.

Unlike the skill library, the treatment for memory was not deleting content — it was moving low-frequency detail from resident-every-turn to retrieved-on-demand. MEMORY.md and USER.md now keep only stable preferences, key constraints, and a few high-value facts, no longer serving as a project database; concrete project state lives in Research Brain, fine-grained history lives in retrievable memory. In the system prompt I removed duplicated rules, folded low-frequency skill categories down to names only, and let most tool schemas load on demand through a search-and-describe mechanism.

After the pass, the fixed prefix went from about 174 KB to 76 KB — roughly 43.5K tokens down to 19K, a 56% reduction. Skill descriptions alone went from about 76k characters to 51k, down 33%.

![Fixed-prefix composition before and after context slimming](/images/2026-08-23-agent-consolidation/fig2-fixed-context.jpg)
*Figure 2 | Fixed-prefix composition before and after context slimming. Measured 17 Aug 2026; 173.9 KB → 75.8 KB (roughly 43.5K → 19K tokens).*

## The auditor

My current main model is GPT-5.6 Sol, and I set up Claude Fable 5 to audit Hermes's decisions. Not to do the work — to check the work. Before costly execution or consequential conclusions, the main model has to get an independent opinion from a different model. The auditor runs as a fresh session with no inherited context, gets a minimal brief, and returns a judgment.

The first version of this mechanism took a wrong turn. I wrote a pile of rules telling the main model when to consult: deep analysis, consult; research design, consult; causal interpretation, consult; important reviews, consult — plus a list of exemptions. The result: every turn, the model first had to decide whether its current situation matched the conditions, and that decision is itself exactly where models are most error-prone. The finer the rules, the less reliably they were followed.

Eventually the whole mechanism collapsed into one invariant: **Sol executes; consult Fable at two lifecycle checkpoints, at most once per checkpoint.** One comes before execution, answering how this should be done. The other comes before a consequential conclusion — after Sol has inspected first-hand evidence and formed a preliminary judgment — answering whether that judgment is sound and whether there is a better explanation.

I built a deliberately small interface: one script, two invocation forms — `consult_fable.py plan` and `consult_fable.py reason`. Each has a fixed packet schema: plan takes the goal, confirmed facts, constraints, and acceptance criteria; reason takes the question, the evidence, and the preliminary judgment. The design philosophy: the fewer interfaces you give the model, the higher the odds it follows them strictly. It does not need to understand the reasoning behind the design — it just calls one command once at each of two checkpoints.

The auditor itself is constrained. It runs as an independent Hermes sub-session with only two read-only tools — session-history search and skill loading. It can look up past discussions and load domain rules, but cannot execute commands, modify files, access the network, or delegate further, and it has a turn cap. Its entire output is one structured judgment; all tools, actions, and final decision authority stay with the main model. Consulting is getting an opinion, not transferring control.

I analyzed the last 12 consultations. It caught two real errors.

First: the main model framed an observability problem as build-a-dashboard. The auditor returned a NARROW verdict and corrected the premise. The real issue was attribution, not visualization. A dashboard would have produced a dashboard, but the actual problem was that I could not tell which layer was causing the latency, and no amount of charting would answer that.

Second: I redesigned a checkpoint system to eliminate a branching decision. The auditor pointed out I had not eliminated the branch — I had moved it. The old system had a structured trigger that could be checked deterministically. The new one replaced it with a semantic judgment the model had to make at runtime. Strictly worse, because the model is the part most likely to miss it, and now the check itself depended on the model being reliable.

Both catches were the same class of error: Hermes's reasoning being confidently wrong in a way it could not detect itself. The auditor worked because it started fresh, with no sunk cost in the main model's analysis. It did not have the context — and that was the point. A second model with the same context would have the same blind spots. The value of the audit is that it comes from outside the frame.

12 consultations, 2 catches, 0 complete failures. Not every check found something, but the ones that did were worth far more than the token cost of running them.

## What I learned

The shift is treating Hermes like a codebase that needs lifecycle management, not a collection that only grows. Skills retire. Credentials rotate. Context compresses. Decisions get audited. Adding things is the fun part — but maintaining the system, keeping it honest, and letting things go is engineering work you cannot skip.
