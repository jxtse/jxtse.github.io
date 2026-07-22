---
permalink: /tada/
title: "TADA"
author_profile: false
---

<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
<link rel="stylesheet" href="{{ '/assets/css/project-page.css' | relative_url }}">

<div class="project-container">

  <header class="project-header">
    <div class="project-venue-badge"><i class="fas fa-database"></i> In Submission · 2026</div>
    <h1 class="project-title">Semantic Atoms for Scalable Text Analysis in Data Analytics in the Era of LLM-Based Agents</h1>
    <div class="project-subtitle">An agent-facing systems abstraction for text analysis in the era of LLM-based agents</div>

    <p class="pp-hero-tagline">
      Modern tables mix text with structured columns, and LLM agents now drive the analysis. <strong>TADA</strong> asks the systems question underneath: <em>when the executor already controls a symbolic runtime, what semantic interface should the data system expose?</em>
    </p>

    <div class="project-authors">
      <a href="https://jxtse.github.io">Jinxiang Xie</a>, Zihao Li, Rui Ding, Bartuer Zhou, Shi Han, Dongmei Zhang
    </div>
    <div class="affiliations">
      Nanjing University &nbsp;|&nbsp; Microsoft Research
    </div>
  </header>

  <section class="teaser-section">
    <img src="{{ '/images/tada/semantic-boundary.png' | relative_url }}" alt="Two placements of the semantic boundary" class="teaser-image">
    <div class="teaser-caption">
      <strong>Two placements of the semantic boundary.</strong> Operator-style interfaces (left) fuse an LLM judgment into each analytical action, leaving no reusable semantic state. TADA (right) confines semantic judgment to two atoms: Tagging (N→N) adds row-aligned fields keyed by <code>rid</code>; Categorization (N→M) creates a detached category relation keyed by <code>cid</code>. Both materialize ordinary table state for deterministic filtering, grouping, ranking, joining, and regression.
    </div>
  </section>

  <section class="abstract-section">
    <div class="abstract-title"><i class="fas fa-align-left"></i> Overview</div>
    <div class="abstract-text">
      Existing LLM-powered data systems extend query languages with natural-language operators — semantic filters, semantic aggregates, semantic joins. These are <em>semantic–OLAP macros</em>: an LLM judgment welded to one analytical action. That is convenient for a human query author, but unnecessarily coarse for an agent that already knows how to filter, group, join, and fit a model.
      <br><br>
      <strong>TADA</strong> proposes a finer boundary built on two <strong>semantic atoms</strong> over text columns. <strong>Tagging</strong> is an N→N operation producing typed, row-aligned fields keyed by row id. <strong>Categorization</strong> is an N→M corpus-level operation creating a detached relation of discovered abstractions. Both outputs are <strong>materialized as ordinary table state</strong> — inspectable, reusable, and composable with the full symbolic runtime. The LLM is confined to semantic judgment; everything else stays deterministic.
      <br><br>
      At corpus scale, a <strong>Map–Reduce execution harness</strong> lets the same two atoms operate beyond a single reliable context window, with a top-k preservation analysis making the approximation boundary explicit.
    </div>
  </section>

  <section class="project-section pp-fadeup">
    <h2 class="section-title">Key Contributions</h2>
    <div class="pp-contrib-grid pp-fadeup-stagger">
      <div class="pp-contrib-card">
        <div class="pp-contrib-num">01</div>
        <h3 class="pp-contrib-title">Agent-Facing Abstraction</h3>
        <p class="pp-contrib-text">Text analysis inside analytical programs is formulated as an <strong>interface problem</strong>: two typed, materialized semantic contracts separate probabilistic judgment from symbolic execution.</p>
      </div>
      <div class="pp-contrib-card">
        <div class="pp-contrib-num">02</div>
        <h3 class="pp-contrib-title">Scalable Realization</h3>
        <p class="pp-contrib-text">TADA-Agent implements the abstraction with validated, keyed state materialization and a <strong>Map–Reduce harness</strong> for bounded-context execution, backed by an analysis of top-k category preservation under partitioning.</p>
      </div>
      <div class="pp-contrib-card">
        <div class="pp-contrib-num">03</div>
        <h3 class="pp-contrib-title">Artifact-Backed Evaluation</h3>
        <p class="pp-contrib-text">TABench: 26 complete semantic–symbolic workbook requests derived from a literature-grounded taxonomy, probing both the strength and the <strong>boundary</strong> of the two-atom framework — plus public extraction benchmarks and a scaling study.</p>
      </div>
      <div class="pp-contrib-card">
        <div class="pp-contrib-num">04</div>
        <h3 class="pp-contrib-title">Honest Accounting</h3>
        <p class="pp-contrib-text">Missing, unreadable, or protocol-mismatched evidence is retained as <strong>limitations</strong> rather than converted into favorable scores; repeated runs are distinguished from single-run baselines throughout.</p>
      </div>
    </div>
  </section>

  <section class="project-section pp-fadeup">
    <h2 class="section-title">Composing Semantic and Symbolic Steps</h2>
    <div class="figure-block">
      <img src="{{ '/images/tada/tada-examples.png' | relative_url }}" alt="Three TADA workloads composing semantic and symbolic steps">
      <div class="figure-caption">
        Three workloads that outgrow task-specific semantic operators. Orange boxes are semantic LLM steps; teal boxes are deterministic symbolic steps. (a) A row-aligned sentiment field is materialized, filtered symbolically, then feeds corpus-level topic discovery. (b) The same Categorization atom is invoked inside ordinary group-wise control flow. (c) Discovered aspects become row-aligned features entering an ordinary regression.
      </div>
    </div>
  </section>

  <section class="project-section pp-fadeup">
    <h2 class="section-title">Public Document-Extraction Benchmarks</h2>
    <div class="figure-block">
      <img src="{{ '/images/tada/public-benchmarks.png' | relative_url }}" alt="CUAD and BioDEX benchmark quality">
      <div class="figure-caption">
        All displayed metrics are higher-is-better. (a) On CUAD, TADA-Agent reaches 0.787 average F1, versus 0.753 for DocETL and 0.619 for LOTUS under the same model and evaluator. (b) On BioDEX, the unchanged two-atom interface also leads the reproduced alternatives on RP@5, RP@10, and term recall.
      </div>
    </div>
  </section>

  <section class="project-section pp-fadeup">
    <h2 class="section-title">TABench: End-to-End Workbook Outcomes</h2>
    <div class="figure-block">
      <img src="{{ '/images/tada/tabench-outcomes.png' | relative_url }}" alt="TABench end-to-end workbook outcomes">
      <div class="figure-caption">
        Query-specific artifact evaluation over 26 complete workbook requests. A Good result must satisfy all mandatory criteria for output structure and analytical content. TADA-Agent produces <strong>21/26 Good outputs (80.8%)</strong>, compared with 16 for Codex, 15 for Shortcut AI, 14 for Claude in Excel, and 2 for Excel Copilot.
      </div>
    </div>
  </section>

  <section class="project-section pp-fadeup">
    <h2 class="section-title">Inside the Agent Loop</h2>
    <div class="figure-block">
      <img src="{{ '/images/tada/react-case-study.png' | relative_url }}" alt="TADA atoms inside a ReAct analytical loop">
      <div class="figure-caption">
        An end-to-end case study: given a natural-language request over a review workbook, the agent interleaves reasoning with three action types. Categorization induces a detached issue taxonomy (N→M), Tagging assigns row-aligned issue fields (N→N), and the deterministic runtime joins, groups, and computes regional refund effects. Each intermediate result is materialized state that the next reasoning turn can inspect.
      </div>
    </div>
  </section>

  <section class="project-section pp-fadeup">
    <h2 class="section-title">Scalable Execution</h2>
    <p style="font-size: 1.05em; line-height: 1.7; color: #444;">
      On three approximately 2.6K-row open-vocabulary joint-topic workloads, moving from (n,r) = (60,10) to (500,19) cuts complete-execution LLM calls by <strong>85.3%</strong> and wall time by <strong>30.0%</strong>, with no observed decrease in the reported global-topic or row-level metrics.
    </p>
  </section>

  <section class="project-section pp-fadeup">
    <h2 class="section-title">Relation to CAST</h2>
    <p style="font-size: 1.05em; line-height: 1.7; color: #444;">
      The two atoms were introduced in <a href="/cast/">CAST</a> (ACL 2026 Findings) as stable summarization and tagging operations. TADA adopts those implementations and recasts their typed outputs as an <strong>agent-facing systems abstraction</strong> — proving the compositional properties (sufficiency for scoped TADA workloads, scalable bounded-context execution) that CAST left open.
    </p>
  </section>

  <section class="project-section pp-fadeup">
    <h2 class="section-title">Status</h2>
    <p style="font-size: 1.05em; line-height: 1.7; color: #444;">
      In submission. A unified cross-system benchmark campaign (all baselines under three-repeat self-consistency with a position-debiased LLM judge and human calibration) is in progress.
    </p>
  </section>

</div>

{% include project-page-enhance.html %}
