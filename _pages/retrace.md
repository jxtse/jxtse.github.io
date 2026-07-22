---
permalink: /retrace/
title: "ReTRACE"
author_profile: false
---

<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
<link rel="stylesheet" href="{{ '/assets/css/project-page.css' | relative_url }}">

<div class="project-container">

  <header class="project-header">
    <div class="project-venue-badge"><i class="fas fa-flask"></i> In Preparation · 2026</div>
    <h1 class="project-title">ReTRACE: Chemically Auditable Large Language Model Agent for Multi-Step Retrosynthesis Planning</h1>
    <div class="project-subtitle">A frozen LLM orchestrating heterogeneous chemistry engines with auditable route evaluation</div>

    <p class="pp-hero-tagline">
      Single-step retrosynthesis models have high <em>coverage</em> but uneven <em>validity</em>, and classic tree search couples the planner to one engine and one reward. <strong>ReTRACE</strong> lets a frozen LLM plan at the <em>route level</em> — proposing, verifying, and restructuring whole synthetic routes with auditable, multi-dimensional feedback.
    </p>

    <div class="project-authors">
      <a href="https://jxtse.github.io">Jinxiang Xie</a>, Yijian Zhang, Hao Dong
    </div>
    <div class="affiliations">
      Nanjing University
    </div>
  </header>

  <section class="teaser-section">
    <img src="{{ '/images/retrace/route-iteration.png' | relative_url }}" alt="ReTRACE route-level iterative search" class="teaser-image">
    <div class="teaser-caption">
      <strong>Route-level iterative search on a real target.</strong> The agent proposes and verifies an initial route (Route 1), saves it and explores reordered variants (Routes 2–3), then escapes the local optimum by switching to new disconnection classes (Routes 4–5). Route 5 — a Suzuki / oxa-Michael strategy with a repaired purchasable leaf — scores highest and is selected. The agent optimizes for route quality, not just route length.
    </div>
  </section>

  <section class="abstract-section">
    <div class="abstract-title"><i class="fas fa-align-left"></i> Overview</div>
    <div class="abstract-text">
      Computer-aided synthesis planning is dominated by two paradigms: score-guided tree search (MCTS, Retro*) that expands one disconnection at a time under a fixed value function, and RL-trained policies bound to a single prediction engine. Both make locally optimal choices that chemists cannot easily audit.
      <br><br>
      <strong>ReTRACE</strong> takes a different route: a <strong>frozen large language model</strong> — no task-specific training — acts as a strategic orchestrator over a harness of chemistry tools: multiple complementary single-step engines, precedent retrieval over literature routes, and a multi-dimensional route evaluator covering <strong>feasibility, cost, and greenness</strong>. The agent reasons over whole candidate routes, keeps every intermediate decision in an auditable trace, and terminates only when all leaf molecules pass a frozen buyability check against a commercial stock catalog.
    </div>
  </section>

  <section class="project-section pp-fadeup">
    <h2 class="section-title">Key Ideas</h2>
    <div class="pp-contrib-grid pp-fadeup-stagger">
      <div class="pp-contrib-card">
        <div class="pp-contrib-num">01</div>
        <h3 class="pp-contrib-title">Route-Level Reasoning</h3>
        <p class="pp-contrib-text">Instead of scoring one bond disconnection at a time, the agent proposes, critiques, and restructures <strong>entire routes</strong> — it can reject a strategy, switch disconnection classes, and repair non-purchasable leaves.</p>
      </div>
      <div class="pp-contrib-card">
        <div class="pp-contrib-num">02</div>
        <h3 class="pp-contrib-title">Frozen Orchestrator</h3>
        <p class="pp-contrib-text">The planner is a <strong>frozen LLM</strong> — no fine-tuning on reaction data. Chemistry knowledge enters through the tool harness: heterogeneous single-step engines with complementary coverage, plus retrieval over literature precedent routes.</p>
      </div>
      <div class="pp-contrib-card">
        <div class="pp-contrib-num">03</div>
        <h3 class="pp-contrib-title">Auditable Evaluation</h3>
        <p class="pp-contrib-text">Every route is scored on <strong>feasibility, cost, and greenness</strong>, and every accepted route must ground each step in model or precedent evidence. Chemists can inspect <em>why</em> a route was chosen, not just the final answer.</p>
      </div>
      <div class="pp-contrib-card">
        <div class="pp-contrib-num">04</div>
        <h3 class="pp-contrib-title">Strict Termination</h3>
        <p class="pp-contrib-text">A route only counts as solved when every leaf is <strong>purchasable under a frozen stock catalog</strong> — preventing the silent "unsolved leaf" failure mode that inflates success rates in synthesis planning.</p>
      </div>
    </div>
  </section>

  <section class="project-section pp-fadeup">
    <h2 class="section-title">Agent Search vs. Classical Tree Search</h2>
    <div class="figure-block">
      <img src="{{ '/images/retrace/search-comparison.png' | relative_url }}" alt="Tree search vs agent-guided route search">
      <div class="figure-caption">
        Both paradigms iterate — the difference is the decision granularity inside each iteration. Score-guided tree search (left) selects and expands nodes within a fixed action space under a scalar value estimate. The agent-guided loop (right) abstracts the target's strategic challenges, proposes routes via retrosynthesis tools, critiques mechanisms and feasibility, and restructures routes before committing a forward synthesis plan.
      </div>
    </div>
  </section>

  <section class="project-section pp-fadeup">
    <h2 class="section-title">Status</h2>
    <p style="font-size: 1.05em; line-height: 1.7; color: #444;">
      Manuscript in preparation. The system is being evaluated on standard hard-target suites (Retro*-190) and out-of-distribution drug-molecule sets, with expert chemist assessment of route quality. A reinforcement-learning extension that post-trains a local policy from the agent's own verified rollouts is under active investigation.
    </p>
  </section>

</div>

{% include project-page-enhance.html %}
