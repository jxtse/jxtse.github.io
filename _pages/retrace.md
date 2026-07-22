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
    <img src="{{ '/images/retrace/architecture.jpg' | relative_url }}" alt="ReTRACE system architecture and decision instances" class="teaser-image">
    <div class="teaser-caption">
      <strong>System architecture with two decision instances from real search trajectories.</strong> An LLM coordination layer runs a Reason–Act–Observe loop over a chemistry tool layer (molecular operations, template-based and template-free single-step engines, building-block buyability lookup, and 3-dimensional route scoring). Every model–tool interaction passes deterministic guarantee gates; a route memory outside the loop preserves partial routes, past disconnection decisions, and abandoned branches as prior context. The lower panels show the agent adjudicating conflicting single-step suggestions and diagnosing a failed route before backtracking.
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
    <h2 class="section-title">Why Multiple Engines: Validity ≠ Coverage ≠ Exact Match</h2>
    <div class="figure-block">
      <img src="{{ '/images/retrace/engine-audit.png' | relative_url }}" alt="Single-step engine pool audit on USPTO-50K">
      <div class="figure-caption">
        Auditing nine single-step engines on 50,000 USPTO-50K reactions. <strong>(a)</strong> Whether a candidate is generated, whether it is structurally valid, whether it passes chemical-plausibility audit, and whether it exactly reproduces the reference precursors are four different questions — a single top-k accuracy cannot capture a tool's value for route planning. <strong>(b)</strong> A multi-engine top-10 union outperforms any single engine's top-100 in reference-precursor coverage. <strong>(c)</strong> After structural filtering, each engine retains unique exact hits — the engines are genuinely complementary.
      </div>
    </div>
  </section>

  <section class="project-section pp-fadeup">
    <h2 class="section-title">Route-Level Performance</h2>
    <div class="figure-block">
      <img src="{{ '/images/retrace/route-performance.png' | relative_url }}" alt="ReTRACE route-level performance">
      <div class="figure-caption">
        <strong>(a)</strong> Pass@k of two frozen backbones (GPT-5.5 and Qwen3.6-35B-A3B) on Retro*-190, FDA30, and JMC2025, under the same ReTRACE tool stack and a fixed independent LLM audit protocol. <strong>(b)</strong> Audited Pass@1 on Retro*-190 alongside values reported by prior work (cross-protocol literature numbers, shown for context rather than as a same-protocol ranking). <strong>(c)</strong> Length distribution of the first passing route relative to the stock-truncated reference route — first passing routes are frequently shorter.
      </div>
    </div>
  </section>

  <section class="project-section pp-fadeup">
    <h2 class="section-title">Route-Level Iterative Search</h2>
    <div class="figure-block">
      <img src="{{ '/images/retrace/route-iteration.png' | relative_url }}" alt="ReTRACE route-level iterative search">
      <div class="figure-caption">
        Route-level iterative search on a real target. The agent proposes and verifies an initial route (Route 1), saves it and explores reordered variants (Routes 2–3), then escapes the local optimum by switching to new disconnection classes (Routes 4–5). Route 5 — a Suzuki / oxa-Michael strategy with a repaired purchasable leaf — scores highest and is selected. The agent optimizes for route quality, not just route length.
      </div>
    </div>
  </section>

  <section class="project-section pp-fadeup">
    <h2 class="section-title">Wet-Lab Validation</h2>
    <p style="font-size: 1.05em; line-height: 1.7; color: #444; margin-bottom: 25px;">
      ReTRACE-proposed routes for two target compounds were taken into the lab. The predicted retrosynthetic framework provided the core disconnection strategy and initial plan; bench chemists refined conditions where the prediction had limitations (e.g., a phosphorylation step with a competing free-carboxyl side reaction, and a late-stage Suzuki coupling on a hindered substrate), substantially shortening route exploration.
    </p>
    <div class="figure-block">
      <img src="{{ '/images/retrace/validation-c1.jpg' | relative_url }}" alt="Compound C1: predicted vs experimental synthesis route">
      <div class="figure-caption">
        <strong>Compound C1.</strong> (a) ReTRACE-predicted synthetic route with predicted conditions and theoretical yields; (b) the experimentally optimized route based on the prediction, with actual conditions and isolated yields.
      </div>
    </div>
    <div class="figure-block">
      <img src="{{ '/images/retrace/validation-c2.png' | relative_url }}" alt="Compound C2: predicted vs experimental synthesis route">
      <div class="figure-caption">
        <strong>Compound C2.</strong> (a) Predicted synthetic route with predicted conditions and theoretical yields; (b) the experimentally optimized route, with actual conditions and isolated yields (three-step yield 51%).
      </div>
    </div>
  </section>

  <section class="project-section pp-fadeup">
    <h2 class="section-title">Status</h2>
    <p style="font-size: 1.05em; line-height: 1.7; color: #444;">
      Manuscript in preparation. The system is evaluated on Retro*-190, FDA30, and JMC2025 with a fixed independent audit protocol, complemented by wet-lab validation of predicted routes and proof-of-concept demonstrations of natural-language steerability (cost-first / green-chemistry-first planning, chemist-feedback revision, and pluggable enzymatic-tool extension).
    </p>
  </section>

</div>

{% include project-page-enhance.html %}
