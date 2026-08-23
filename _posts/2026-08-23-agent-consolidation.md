---
layout: post
title: "Consolidating an Agent That Outgrew Itself"
date: 2026-08-23
description: "After months of heavy use, my AI agent had accumulated 272 skills, plaintext API keys, a 43K-token fixed context, and no way to check its own reasoning. A day of consolidation: usage-based skill retirement, secrets management, context-layer slimming, and a second-model auditor that caught two real errors."
cover_image: /images/2026-08-23-agent-consolidation/cover.jpg
categories: [AI, Agents, Engineering]
---

I have been using Hermes heavily for several months. Its biggest selling point is a self-improving loop: whenever it solves a hard problem, it packages the solution as a reusable skill and loads it next time. In theory this is great. In practice, the library only grows, and long-term accumulation creates real problems. Last week I spent a full day on consolidation — not adding features, just auditing what was already there and cleaning up what had accumulated.

## The skill library

After months of heavy use, my Hermes library had 272 skills. I audited all of them by actual load history. 25 skills had zero loads across 100 days of available history. They were injected into the context window on every single turn, costing tokens and polluting recall, and they had never been called once. Another 16 were Codex skills that had stalled at 5 or fewer sessions and hadn't been touched in over a month. 41 skills in total, about 15% of the library, doing nothing but taking up space.

11 of those 25 zero-load skills were created by Hermes's own self-improving loop. It kept packaging solutions to one-off problems, adding them to the library, and then they sat there forever. A skill for generating architecture diagrams. A skill for kanban-style task lanes. A skill for a God-mode red-teaming prompt. Each one solved a real problem once, got packaged, and was never relevant again.

So I built a retirement system. A few decisions mattered.

The only honest signal is that Hermes actually loaded a skill, which gets logged. A skill becomes a retirement candidate if it is at least 60 days old and has zero loads across 60 days of history. If it has been loaded fewer than twice ever and has not been touched in 90 days, it goes to manual review. New installs get a 60-day grace period, because a fresh skill hasn't had time to prove itself.

Retirement isn't one step. It's audit, quarantine, restore, purge. Audit runs read-only and produces a candidate list. Quarantine moves the skill to an archive directory for 30 days — it stops loading and stops costing context, but the files stay on disk. Restore brings it back any time during that window. Only after 30 days does purge become an option. That quarantine window is there to catch the case I actually worry about: a skill I think is dead that some cron job quietly calls once every two weeks.

Not everything low-usage gets retired. Suite skills that come in families, governance and infrastructure skills, memory and model routing, core debugging tools are pinned and never auto-retired. Some of these have near-zero load frequency and that is fine, because deleting them breaks a suite or removes something I would really want the day I suddenly need it. A skill's value is option value, not throughput, and ranking purely by usage would quietly delete the wrong ones.

After the cleanup the library is at 231 skills. Even now, 48 of those have never been loaded and 111 have been used twice or fewer. The honest number of skills I actually need is probably half of what's left. The monthly audit will keep working through them.

## Credentials

Hermes now ships a way to store API keys securely on the local machine, but somehow my machine was covered in API keys that Hermes had stored in plaintext. This includes keys I had pasted into chat messages — those get stored verbatim in session history and can be surfaced later by the session-search tool. Not great.

Several of its skill scripts were reading API keys from `~/.zshrc` and `~/.hermes/.env` — plaintext files with full credentials sitting on disk. The Feishu gateway scripts sourced the env file directly. The Zotero helper shelled out to `source ~/.zshrc` and parsed the output. The WeRead analysis script read the API key from a line in `~/.zshrc` by anchoring on the key prefix. A few of these scripts Hermes had written for itself. So Hermes was creating code that read my secrets, storing that code in its own library, and running it with my permissions.

I migrated everything to a secrets manager. Config files now reference environment variables (`${env:VAR}`), not raw keys. Secrets get injected at runtime from Bitwarden, cached in an encrypted local file (ChaCha20-Poly1305 with HKDF-derived keys). Skill scripts only read from the process environment; if a key isn't there, they fail closed with a pointer to run via Hermes or the bws-run wrapper. And I turned on automatic redaction of key-like strings in tool output, so even if a secret leaks into a log, it gets masked before it hits the context window.

The threat model isn't a remote attacker. It's Hermes itself — reading a file it shouldn't, echoing a key into a prompt, or writing a script that sources your shell config. The fix is defense in depth: no plaintext secrets on disk, runtime injection only, fail-closed scripts, and output redaction. Any one layer can fail without exposing credentials, because the others are still in place.

One more benefit of the migration: I can now add, edit, view, and delete all my API keys in one place in the Bitwarden web UI, and distribute them quickly and safely to any new device — like a freshly provisioned cloud server.

## The context window

Hermes's fixed context is more than just skills. Before every model call, the system prompt, MEMORY.md, USER.md, the skill index, and the tool schemas all enter the context window together. They carry the operating rules, long-term memory, user preferences, the capability index, and tool documentation. If any one layer keeps growing, a brand-new session with almost no actual content starts from a very high token baseline.

I measured a complete fixed prefix: about 174 KB, roughly 43.5K tokens. The system prompt (including the skill index) was about 72 KB, MEMORY.md about 21 KB, USER.md about 9 KB, tool schemas about 72 KB. The problem isn't just cost. Before the model has even seen the user's question, a mass of long-term information, candidate skills, and tool definitions has already claimed a large share of the context window.

First, some background on how my memory system is layered — three layers. At the top are MEMORY.md and USER.md, two Markdown files injected in full at the start of every session, acting as a compressed global index: who I am, stable preferences, system conventions, one line per project. The second layer is Research Brain, a local Markdown + Git repository that is the authoritative fact layer for all research projects. Each project has a working brief, decision records (with dates and reasons), a timeline, and open questions; Hermes writes back new decisions and experiment results append-only, and multiple agents (Hermes, Claude Code, Codex) share the same copy. It is not injected into context — it gets opened by path when needed. The third layer is mem0local, local semantic retrieval (vectors + BM25) over atomic facts. Each turn automatically recalls the few most relevant entries for the current question, and the agent can search it explicitly; high-confidence facts from Research Brain get distilled into memory cards and indexed in by a nightly pipeline.

The layering principle is simple: the higher up, the more stable and compressed, present on every turn; the lower down, the more detailed, retrieved on demand. On conflict, the Research Brain Markdown wins — raw session transcripts and the vector store are upstream signal and rebuildable cache, not authority.

Unlike the skill library, the treatment for memory wasn't deleting content — it was moving low-frequency detail from "resident on every turn" to "retrieved on demand." MEMORY.md and USER.md now keep only stable preferences, key constraints, and a small set of high-value facts, and no longer serve as a project database; concrete project state lives in Research Brain, fine-grained history lives in retrievable memory, fetched when needed. In the system prompt I removed duplicated rules, folded low-frequency skill categories down to names only, and let most tool schemas load on demand through a search-and-describe mechanism.

After the pass, the fixed prefix went from about 174 KB to 76 KB — roughly 43.5K tokens down to 19K, a 56% reduction. Skill descriptions alone went from about 76k characters to 51k, a 33% reduction.

But compression only lowers the fixed cost; it doesn't fully solve recall and routing. When hundreds of skill names are still competing for the model's attention, the odds it surfaces the right one go down and the odds it grabs a near-miss go up. That's why names-only folding can't replace the retirement system: the former reduces reading volume, the latter actually reduces the number of candidates.

## The auditor

My current main model is GPT-5.6 Sol, and I set up Claude Fable 5 to audit Hermes's decisions. Not to do the work — to check the work. Before costly execution or consequential conclusions, the main model has to get an independent opinion from a different model. The auditor runs as a fresh session with no inherited context, gets a minimal brief, and returns a judgment.

The first version of this mechanism took a wrong turn. I initially wrote a pile of rules telling the main model when to consult: deep analysis, consult; research design, consult; causal interpretation, consult; important reviews, consult — plus a list of exemptions. The result was that every turn, the model first had to decide "does my current situation match the conditions," and that decision is itself exactly where models are most error-prone. The finer the rules, the less reliably they were followed.

Eventually the whole mechanism collapsed into one invariant: **Sol executes; consult Fable at two lifecycle checkpoints, at most once per checkpoint.** One comes before execution, answering "how should this be done." The other comes before a consequential conclusion, after Sol has inspected first-hand evidence and formed a preliminary judgment, answering "is this judgment sound, and is there a better explanation." The two checkpoints map to the two failure modes: doing the wrong thing, and concluding the wrong thing.

I built a deliberately small interface around this: one script, two invocation forms — `consult_fable.py plan` and `consult_fable.py reason`. Each form has a fixed packet schema: plan requires the goal, confirmed facts, constraints, and acceptance criteria; reason requires the question, the evidence, and the preliminary judgment. The design philosophy: the fewer interfaces you give the model, the higher the odds it follows them strictly. It doesn't need to understand the philosophy — it just needs to call one command once at each of two checkpoints.

The auditor itself is constrained. It runs as an independent Hermes sub-session with only two read-only tools — session-history search and skill loading. It can look up relevant past discussions and load domain rules, but it cannot execute commands, modify files, access the network, or delegate further, and it has a turn cap. Its entire output is one structured judgment; all tools, actions, and final decision authority stay with the main model. Consulting is getting an opinion, not transferring control.

I analyzed the last 12 consultations in the history. It caught two real errors.

The first: the main model framed an observability problem as "build a dashboard." The auditor returned a NARROW verdict and corrected the premise. The real issue was attribution, not visualization. Building a dashboard would have produced a dashboard, but the actual problem was that I couldn't tell which layer was causing the latency, and no amount of charting would have answered that.

The second: I redesigned a checkpoint system to eliminate a branching decision. The auditor pointed out I hadn't eliminated the branch — I'd moved it. The old system had a structured trigger the system could check deterministically. The new one replaced that with a semantic judgment the model had to make at runtime. That's strictly worse, because the model is the part most likely to miss it, and now the check itself depended on the model being reliable.

Both catches were about Hermes's reasoning being confidently wrong in a way it couldn't detect itself. The auditor worked because it started fresh, with no sunk cost in the main model's analysis. It didn't have the context — and that was the point. A second model with the same context would have the same blind spots. The value of the audit is that it comes from outside the frame.

12 consultations, 2 catches, 0 complete failures. Not every check found something, but the ones that did were worth far more than the token cost of running them.

## What I learned

The shift is treating Hermes like a codebase that needs lifecycle management, not a collection that only grows. Skills retire. Credentials rotate. Context compresses. Decisions get audited. Adding things is the fun part — but maintaining the system, keeping it honest, and letting things go is engineering work you can't skip.
