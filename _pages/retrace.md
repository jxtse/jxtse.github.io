---
permalink: /retrace/
title: "ReTRACE"
description: "ReTRACE places an LLM in a chemistry harness to plan, audit and revise multi-step retrosynthesis routes, with a planning assistant for organic chemists."
cover_image: /images/retrace/harness.png
author_profile: false
retrace_api_base: "https://retrace-gu26.tail6455c4.ts.net"
---

<link rel="stylesheet" href="{{ '/assets/css/project-page.css' | relative_url }}">
<link rel="stylesheet" href="{{ '/assets/css/retrace-assistant.css' | relative_url }}">

<div class="project-container">

  <header class="project-header">
    <div class="project-venue-badge">arXiv · 2026</div>
    <h1 class="project-title">ReTRACE: Feedback-Guided LLM Agent in a Chemistry Harness for Retrosynthesis Planning</h1>
    <div class="project-subtitle">An LLM coordinator that plans whole synthetic routes with chemistry tools, learns from evaluator feedback during search and leaves experimental judgement to chemists</div>
    <p class="pp-hero-tagline">
      Complex targets need judgement over the <em>whole route</em>, where stereochemistry, functional-group compatibility, cost and greenness interact. <strong>ReTRACE</strong> gives a large language model a harness of molecular tools, complementary single-step engines, a purchasable starting-material library, a route memory and a multi-criterion route evaluator, then checks every proposed route with an independent audit.
    </p>
    <div class="project-authors">
      <a href="https://jxtse.github.io">Jinxiang Xie</a><sup>1,†</sup>, Yijian Zhang<sup>1,†</sup>, Qingyuan Yi<sup>2</sup>, Jianyi Wang<sup>2,*</sup>, Hao Dong<sup>1,*</sup>
    </div>
    <div class="affiliations">
      <sup>1</sup>Nanjing University &nbsp;·&nbsp; <sup>2</sup>School of Medicine, Guangxi University &nbsp;·&nbsp; <sup>†</sup>Equal contribution &nbsp;·&nbsp; <sup>*</sup>Corresponding authors
    </div>
    <div class="links-bar">
      <a href="https://arxiv.org/abs/2610.24744" target="_blank" rel="noopener noreferrer"><i class="fas fa-file-alt"></i> arXiv</a>
      <a href="https://arxiv.org/pdf/2610.24744" target="_blank" rel="noopener noreferrer"><i class="fas fa-file-pdf"></i> PDF</a>
      <a href="#assistant-title"><i class="fas fa-flask"></i> Try the assistant</a>
      <a href="#citation"><i class="fas fa-quote-right"></i> Cite</a>
    </div>
  </header>

  <section class="teaser-section">
    <img src="{{ '/images/retrace/harness.png' | relative_url }}" alt="ReTRACE harness, two decision instances from real search trajectories and the response to score feedback within a run" class="teaser-image" width="1283" height="1009">
    <div class="teaser-caption">
      <strong>The ReTRACE harness.</strong> <strong>a</strong>, An LLM coordinator works inside a harness of heterogeneous chemistry tools, deterministic gates that check every tool call, tool result and saved route, and a route memory that carries partial routes, past decisions and abandoned branches into the next round. Route scores return to the coordinator as feedback; ranked routes are judged by Audit@k, and selected routes go to chemist review and wet-lab synthesis. <strong>b</strong>, Adjudicating conflicting single-step suggestions. <strong>c</strong>, Diagnosis and backtracking after a lower-scoring route. <strong>d</strong>, In 670 completed Retro*-190 runs, the best score so far and the chance that at least one route passes the audit rise and level off after about eight scored routes.
    </div>
  </section>

  <section class="project-section ra" id="assistant" aria-labelledby="assistant-title">
    <h2 class="section-title" id="assistant-title">ReTRACE Assistant</h2>
    <p class="pp-lead">Enter or draw a target molecule. ReTRACE plans candidate routes, scores each one and shows which tools support every step.</p>
    <div id="ra-console" class="ra-console" data-api-base="{{ page.retrace_api_base }}" data-sessions-url="{{ '/assets/data/retrace-sessions-v1.json' | relative_url }}" data-jsme-url="{{ '/assets/js/retrace/jsme/jsme.nocache.js' | relative_url }}">
      <header class="ra-top">
        <span class="ra-brand">ReTRACE <span>Route planner</span></span>
        <div class="ra-status" data-ra="status" aria-live="polite"></div>
        <span class="ra-model">Model <b data-ra="model">ReTRACE-27B</b></span>
      </header>

      <form class="ra-input" data-ra="form" novalidate>
        <div class="ra-col ra-col--target">
          <label class="ra-label" for="ra-smiles">Target molecule</label>
          <div class="ra-target-row">
            <input id="ra-smiles" class="ra-smiles" data-ra="smiles" type="text" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="Paste a SMILES string or draw the structure">
            <button type="button" class="ra-draw" data-ra="draw" aria-expanded="false" aria-controls="ra-sketch">
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5 16.5 6.2v7.6L10 17.5l-6.5-3.7V6.2z"/></svg>
              Draw structure
            </button>
          </div>
        </div>
        <div class="ra-col ra-col--effort">
          <span class="ra-label" id="ra-effort-label">Search effort</span>
          <fieldset class="ra-seg" data-ra="preset" aria-labelledby="ra-effort-label">
            <label><input type="radio" name="ra-preset" value="fast"><span>Fast</span></label>
            <label><input type="radio" name="ra-preset" value="standard" checked><span>Standard</span></label>
            <label><input type="radio" name="ra-preset" value="thorough"><span>Thorough</span></label>
          </fieldset>
        </div>
        <div class="ra-col ra-col--run">
          <span class="ra-label" aria-hidden="true">&nbsp;</span>
          <button type="submit" class="ra-run" data-ra="run">Plan routes</button>
        </div>
        <div class="ra-sketch" id="ra-sketch" data-ra="sketch" hidden>
          <div class="ra-sketch-pad" id="ra-jsme" data-ra="jsme"><p class="ra-sketch-wait">Loading the structure editor…</p></div>
          <div class="ra-sketch-actions">
            <button type="button" class="ra-btn" data-ra="sketch-cancel">Cancel</button>
            <button type="button" class="ra-btn ra-btn--primary" data-ra="sketch-use">Use this structure</button>
          </div>
        </div>
      </form>

      <div class="ra-error" data-ra="error" role="alert" hidden></div>

      <div class="ra-live" data-ra="live" hidden>
        <div class="ra-live-head">
          <span class="ra-live-now" data-ra="live-now" role="status"></span>
          <span class="ra-clock" data-ra="clock" aria-label="Elapsed time">0:00</span>
        </div>
        <ol class="ra-steps" data-ra="steps"></ol>
        <ul class="ra-feed" data-ra="feed" aria-label="Recent planner actions"></ul>
      </div>

      <div class="ra-results" data-ra="results">
        <div class="ra-empty" data-ra="empty">
          <p>Ranked routes for your target appear here.</p>
        </div>
        <div class="ra-list" data-ra="routes" role="tablist" aria-label="Candidate routes" hidden></div>
        <div class="ra-detail" data-ra="detail" role="tabpanel" hidden></div>
        <aside class="ra-drawer" data-ra="drawer" hidden aria-label="Tool calls in this run"></aside>
      </div>

      <form class="ra-steer" data-ra="steer" novalidate>
        <label class="ra-label" for="ra-feedback">Refine the search</label>
        <input id="ra-feedback" data-ra="feedback" type="text" placeholder="Tell the planner what to change, e.g. avoid Boc protection or prefer cheaper starting materials">
        <button type="submit" class="ra-btn" data-ra="steer-run">Continue planning</button>
      </form>

      <dialog class="ra-quota" data-ra="quota" aria-labelledby="ra-quota-title" aria-describedby="ra-quota-body">
        <div class="ra-quota-body">
          <h3 id="ra-quota-title">Planning quota used up</h3>
          <p class="ra-quota-zh" id="ra-quota-body">今日额度不足，请明天再试</p>
          <p class="ra-quota-en">Today's planning quota is used up. Please try again tomorrow.</p>
          <div class="ra-quota-actions">
            <button type="button" class="ra-btn ra-btn--primary" data-ra="quota-close">Close</button>
          </div>
        </div>
      </dialog>
    </div>
    <p class="ra-foot">Routes are computational proposals for expert review, not experimentally validated procedures. Structure editor: <a href="https://jsme-editor.github.io/">JSME</a> (BSD licence).</p>
    <noscript><p class="pp-table-note">The route planner needs JavaScript.</p></noscript>
  </section>

  <section class="abstract-section">
    <div class="abstract-title">Abstract</div>
    <div class="abstract-text">
      Computer-aided retrosynthesis has advanced through single-step prediction, tree search and route scoring, but complex targets still require judgement over the whole route, where stereochemistry, functional-group compatibility, cost and greenness interact. Here we present <strong>ReTRACE</strong> (<strong>RE</strong>trosynthesis with <strong>T</strong>ool-orchestrated <strong>R</strong>easoning <strong>A</strong>nd <strong>C</strong>ontext-aware <strong>E</strong>vidence), an agent that places a large language model (LLM) in a chemistry harness that integrates molecular tools, complementary single-step prediction engines, a purchasable starting-material library, a route memory and a multi-criterion route evaluator. Routes are judged by a new metric that combines programmatic checks with adversarial LLM review, and its verdicts are compared with a synthetic chemist's. The agent learns continually from evaluator feedback during search, diagnosing weak routes and backtracking to revise them. With Claude Opus 4.8, at least one of the top 10 routes proposed by ReTRACE passed the audit for 87.4%, 95.0% and 86.7% of targets on the three benchmarks. Two prospective wet-lab syntheses show that ReTRACE route proposals can be converted into executable procedures after expert revision.
    </div>
  </section>

  <section class="project-section">
    <h2 class="section-title">Contributions</h2>
    <ol class="pp-contrib-list">
      <li>
        <span class="num">01</span>
        <h3>Single-step engines are complementary</h3>
        <p>A large-scale audit of ten single-step engines on 50,000 USPTO-50K reactions shows that they contribute <strong>complementary candidates</strong>. This motivates a harness that keeps heterogeneous evidence and lets the LLM weigh it at route level.</p>
      </li>
      <li>
        <span class="num">02</span>
        <h3>A harness and a route-level metric</h3>
        <p>We build the harness and compare ReTRACE with classical and LLM controllers on three route-level benchmarks under <strong>Audit@k</strong>, a new metric whose verdicts we check against a synthetic chemist.</p>
      </li>
      <li>
        <span class="num">03</span>
        <h3>Learning from evaluator feedback</h3>
        <p>We examine how the agent learns from feedback <strong>within a run</strong>, through decision trajectories and a tool ablation, and <strong>across runs</strong>, through a first attempt to train the model on harness trajectories.</p>
      </li>
      <li>
        <span class="num">04</span>
        <h3>Prospective wet-lab validation</h3>
        <p>Two prospective syntheses test whether ReTRACE routes can be turned into <strong>executable procedures</strong> after expert revision.</p>
      </li>
    </ol>
  </section>

  <section class="project-section">
    <h2 class="section-title">Route-Level Results</h2>
    <p class="pp-lead">
      <strong>Audit@k</strong> is the share of all targets with at least one audit-passing route among the top k candidates. Failed runs and targets without output count as failures. Every method goes through the same frozen two-stage audit: programmatic checks and a step-by-step LLM review, then an independent defence of every route flagged as fatal.
    </p>
    <div class="pp-results-row">
      <div class="pp-result"><span class="value">87.4%</span><span class="label">Audit@10 on Retro*-190<br>Claude Opus 4.8</span></div>
      <div class="pp-result"><span class="value">95.0%</span><span class="label">Audit@10 on JMC2025<br>Claude Opus 4.8</span></div>
      <div class="pp-result"><span class="value">96.6%</span><span class="label">Route-level agreement with a<br>synthetic chemist (κ = 0.93)</span></div>
    </div>
    <div class="pp-table-wrap">
      <table class="pp-table">
        <thead>
          <tr><th></th><th colspan="3">Retro*-190 (N = 190)</th><th colspan="3">JMC2025 (N = 141)</th><th colspan="3">FDA30 (N = 30)</th></tr>
          <tr><th>Controller / baseline</th><th>Run</th><th>@1</th><th>@10</th><th>Run</th><th>@1</th><th>@10</th><th>Run</th><th>@1</th><th>@10</th></tr>
        </thead>
        <tbody>
          <tr><td>ReTRACE · Claude Opus 4.8</td><td>97.9</td><td>70.0</td><td class="best">87.4</td><td>99.3</td><td class="best">82.3</td><td class="best">95.0</td><td>93.3</td><td>70.0</td><td>86.7</td></tr>
          <tr><td>ReTRACE · GPT-5.6 Sol standard</td><td>100.0</td><td>65.8</td><td>82.6</td><td>100.0</td><td>75.9</td><td>92.2</td><td>100.0</td><td class="best">76.7</td><td class="best">90.0</td></tr>
          <tr><td>ReTRACE · Qwen3.6-35B-A3B</td><td>91.6</td><td>23.7</td><td>34.7</td><td>92.2</td><td>24.8</td><td>43.3</td><td>100.0</td><td>30.0</td><td>63.3</td></tr>
          <tr class="pp-group"><td>Retro*</td><td>85.8</td><td class="best">73.7</td><td>73.7</td><td>95.0</td><td>80.9</td><td>80.9</td><td>86.7</td><td>53.3</td><td>53.3</td></tr>
          <tr><td>Codex (GPT-5.6 Sol standard)</td><td>98.9</td><td>32.1</td><td>32.1</td><td>100.0</td><td>40.4</td><td>40.4</td><td>100.0</td><td>30.0</td><td>30.0</td></tr>
        </tbody>
      </table>
    </div>
    <p class="pp-table-note">
      Percentages. Run = run success, the share of targets whose run completed and returned at least one route. Bold marks the highest Audit@k in each dataset. External baselines share the target sets, the stock-termination criterion and the frozen audit but keep their native controllers and budgets, so the comparison is outcome-level, not compute-matched. Retro* returns one route per target. The fast and thorough GPT-5.6 Sol presets and the tool-group ablations are in Table 1 of the paper.
    </p>
    <p class="pp-lead pp-lead--after">
      To check the audit against human judgement, a researcher with a background in synthetic chemistry reviewed 59 candidate routes (274 reaction steps) for the first six Retro*-190 targets. Agreement with the automatic audit was 96.6% at route level (57/59; Cohen's κ = 0.93), 95.8% for rank-1 routes (23/24; κ = 0.91) and 97.4% at step level (267/274; κ = 0.89). In the tool ablation with Claude Opus 4.8, removing single-step prediction lowered Audit@1 from 70.4% to 42.3% on the 189 comparable targets.
    </p>
  </section>

  <section class="project-section">
    <h2 class="section-title">Complementary Single-Step Engines</h2>
    <div class="figure-block">
      <img src="{{ '/images/retrace/engine-complementarity.png' | relative_url }}" alt="Validity, reference recovery and complementarity of ten single-step engines, and engine agreement in planned routes" loading="lazy" decoding="async" width="1316" height="1308">
      <div class="figure-caption">
        Ten single-step engines on 50,000 USPTO-50K reactions. <strong>a</strong>, Share of reactions with output, with a rank-1 prediction that passes RDKit screening, with a rank-1 prediction that passes the LLM audit, and with an exact top-1 reference match. <strong>b</strong>, Reactions recovered within the top 10 by that engine alone. <strong>c</strong>, Share of the row engine's top-10 misses that the column engine recovers. <strong>d</strong>, Route steps in the Retro*-190 runs that passed or failed the audit, by the number of runtime engines that proposed the step. The top-10 union of all ten engines recovers the reference precursors for 98.6% of reactions. ChemBART ranks fourth on top-10 recovery but accounts for most of the reactions that no other engine hits.
      </div>
    </div>
  </section>

  <section class="project-section">
    <h2 class="section-title">Route-Level Control</h2>
    <div class="figure-block">
      <img src="{{ '/images/retrace/route-control.png' | relative_url }}" alt="Conventional tree-search control and ReTRACE route-level control, with one real decision trajectory" loading="lazy" decoding="async" width="1283" height="1690">
      <div class="figure-caption">
        <strong>a</strong>, Conventional MCTS or Retro* controllers repeatedly select, expand, evaluate and backpropagate within a fixed candidate space. ReTRACE instead runs an agent loop that diagnoses weak steps, introduces alternative precursors and restructures a route before saving it. <strong>b</strong>, Five routes saved for one representative target. Routes 2 and 3 only reorder the steps of Route 1, Route 4 uses a Boc-last assembly, and Route 5 changes the disconnection class and reaches the highest score (0.8316) after its unpurchasable BPin–aryl ether leaf is disconnected further.
      </div>
    </div>
  </section>

  <section class="project-section">
    <h2 class="section-title">Prospective Wet-Lab Validation</h2>
    <p class="pp-lead">
      A computational audit can exclude detectable structural and mechanistic contradictions, but it cannot show that a route runs as proposed. For two targets outside every benchmark set, ReTRACE generated routes before any wet-lab work. Synthetic chemists then reviewed and revised them and ran the syntheses. A synthesis counted as successful only when the target was isolated and its structure confirmed.
    </p>
    <div class="figure-block">
      <img src="{{ '/images/retrace/wetlab-validation.png' | relative_url }}" alt="Initial ReTRACE routes and chemist-revised experimental routes for compounds C1 and C2" loading="lazy" decoding="async" width="1950" height="2555">
      <div class="figure-caption">
        Each panel compares the initial ReTRACE route with the chemist-revised experimental route. <strong>a</strong>, Compound C1 required a revised protection strategy and an earlier Suzuki coupling; the final click step gave C1 in 67% yield. <strong>b</strong>, Compound C2 retained the core sequence, with localized substrate and condition changes. Full procedures, characterization data and spectra are in the paper's appendix.
      </div>
    </div>
  </section>

  <section class="project-section">
    <h2 class="section-title">Where Routes Fail</h2>
    <div class="figure-block">
      <img src="{{ '/images/retrace/failure-modes.png' | relative_url }}" alt="Chemical failure modes identified by the route-level adversarial audit" loading="lazy" decoding="async" width="1283" height="896">
      <div class="figure-caption">
        Of the 1,250 routes returned by GPT-5.6 Sol (standard) on Retro*-190, 497 (39.8%) failed the audit, mostly on chemical contradictions within the route rather than formatting. <strong>a</strong>, Failed routes grouped by the first fatal family: (A) skeletal carbons appear or vanish, (B) wrong connectivity, regiochemistry or ring size, (C) the reagent cannot effect the change, (D) no known mechanism. <strong>b</strong>, A Knoevenagel condensation that loses a carbon. <strong>c</strong>, An oxa-Michael addition drawn at the wrong carbon, giving the wrong ring size. <strong>d</strong>, A one-step δ-carboline construction in which the nitrogen count falls without a nitrogen-containing leaving group.
      </div>
    </div>
  </section>

  <section class="project-section">
    <h2 class="section-title">Scope</h2>
    <ul class="pp-scope">
      <li><strong>Decision support, not certification.</strong> ReTRACE proposes and ranks routes, and chemists decide what to run. Passing the audit means no detectable structural or mechanistic contradiction. It does not mean the route is optimized or executable as written.</li>
      <li><strong>Human in the loop.</strong> Route memory persists on disk, so a session can be resumed, chemists can add feedback or constraints, and the agent continues planning from the saved state.</li>
      <li><strong>Extensible harness.</strong> New expert tools, such as enzymatic single-step predictors, can be added without changing the coordinator. Preference steering, chemist feedback and a chemo-enzymatic case are reported in the paper's appendix.</li>
      <li><strong>Post-training is still open.</strong> SFT and GRPO on harness trajectories did not exceed their base models, and on-policy self-distillation passed fewer rank-1 routes than its base (9 versus 16 of 40). We leave harness-informed post-training to future work.</li>
    </ul>
  </section>

  <section class="project-section">
    <h2 class="section-title" id="citation">Citation</h2>
    <div class="bibtex-section">
      <button class="bibtex-copy-btn" onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText);this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',2000);">Copy</button>
      <div class="bibtex-code">@misc{xie2026retrace,
      title={ReTRACE: Feedback-Guided LLM Agent in a Chemistry Harness for Retrosynthesis Planning},
      author={Jinxiang Xie and Yijian Zhang and Qingyuan Yi and Jianyi Wang and Hao Dong},
      year={2026},
      eprint={2610.24744},
      archivePrefix={arXiv},
      primaryClass={cs.AI},
      url={https://arxiv.org/abs/2610.24744},
}</div>
    </div>
  </section>

  <footer class="pp-footer">
    <a href="{{ '/' | relative_url }}" target="_self">← Homepage</a>
    <span class="sep">·</span>
    <a href="https://x.com/JinxiangTse" target="_blank" rel="noopener noreferrer">Follow me on X</a>
    <span class="sep">·</span>
    <a href="https://www.xiaohongshu.com/user/profile/60c47bae000000000100b07e" target="_blank" rel="noopener noreferrer">Follow me on RedNote</a>
  </footer>

</div>

<script src="{{ '/assets/js/retrace/smiles-drawer.min.js' | relative_url }}" defer></script>
<script src="{{ '/assets/js/retrace/retrace-api.js' | relative_url }}" defer></script>
<script src="{{ '/assets/js/retrace/retrace-assistant.js' | relative_url }}" defer></script>

{% include project-page-enhance.html %}
