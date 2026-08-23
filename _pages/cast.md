---
permalink: /cast/
title: "CAST: Achieving Stable LLM-based Text Analysis for Data Analytics"
author_profile: false
---

<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
<link rel="stylesheet" href="{{ '/assets/css/project-page.css' | relative_url }}?v={{ site.time | date: '%s' }}">

<div class="project-container">

  <header class="project-header">
    <div class="project-venue-badge">ACL 2026 Findings</div>
    <h1 class="project-title">CAST: Achieving Stable LLM-based Text Analysis for Data Analytics</h1>
    <div class="project-subtitle">Consistency via Algorithmic Prompting and Stable Thinking</div>

    <p class="pp-hero-tagline">
      LLM-based text analysis is unstable across runs — a deal-breaker for data analytics. <strong>CAST</strong> constrains the latent reasoning path to deliver consistent, deterministic-grade outputs without sacrificing quality.
    </p>

    <div class="project-authors">
      <a href="https://jxtse.github.io">Jinxiang Xie</a><sup>1</sup>,
      Zihao Li<sup>2</sup>,
      Wei He<sup>3</sup>,
      Rui Ding<sup>4</sup>,
      Shi Han<sup>4</sup>,
      Dongmei Zhang<sup>4</sup>
    </div>
    <div class="affiliations">
      <sup>1</sup>Nanjing University &nbsp;·&nbsp;
      <sup>2</sup>Tsinghua University &nbsp;·&nbsp;
      <sup>3</sup>Peking University &nbsp;·&nbsp;
      <sup>4</sup>Microsoft Research
    </div>

    <div class="links-bar">
      <a href="https://arxiv.org/abs/2602.15861" target="_blank" rel="noopener noreferrer"><i class="fas fa-file-alt"></i> Paper</a>
      <a href="https://arxiv.org/pdf/2602.15861" target="_blank" rel="noopener noreferrer"><i class="fas fa-file-pdf"></i> PDF</a>
      <a href="https://github.com/jxtse/CAST-text-analysis" target="_blank" rel="noopener noreferrer"><i class="fab fa-github"></i> Code</a>
    </div>
  </header>

  <section class="teaser-section">
    <img src="{{ '/images/cast-fig2-framework.png' | relative_url }}" alt="CAST Framework Overview" class="teaser-image">
    <div class="teaser-caption">
      <strong>Figure 1:</strong> Overview of the CAST framework. Traditional methods (left) operate with uncontrolled reasoning paths, resulting in wide, high-entropy output distributions. CAST (right) mitigates instability via Algorithmic Prompting and Thinking-before-Speaking, collapsing the generation process into a sharply concentrated output distribution.
    </div>
  </section>

  <section class="abstract-section">
    <div class="abstract-title">Abstract</div>
    <div class="abstract-text">
      Text analysis of tabular data relies on two core operations: <strong>summarization</strong> for corpus-level theme extraction and <strong>tagging</strong> for row-level labeling. A critical limitation of employing large language models (LLMs) for these tasks is their inability to meet the high standards of <em>output stability</em> demanded by data analytics.
      <br><br>
      To address this challenge, we introduce <strong>CAST</strong> (<strong>C</strong>onsistency via <strong>A</strong>lgorithmic Prompting and <strong>S</strong>table <strong>T</strong>hinking), a framework that enhances output stability by constraining the model's latent reasoning path. CAST combines (i) <strong>Algorithmic Prompting</strong> to impose a procedural scaffold over valid reasoning transitions and (ii) <strong>Thinking-before-Speaking</strong> to enforce explicit intermediate commitments before final generation.
      <br><br>
      To measure progress, we introduce <strong>CAST-S</strong> and <strong>CAST-T</strong>, stability metrics for bulleted summarization and tagging, and validate their alignment with human judgments. Experiments across publicly available benchmarks on multiple LLM backbones show that CAST consistently achieves the best stability among all baselines, improving Stability Score by up to <strong>16.2%</strong>, while maintaining or improving output quality.
    </div>
  </section>

  <section class="project-section">
    <h2 class="section-title">Key Contributions</h2>
    <ol class="pp-contrib-list">
      <li>
        <span class="num">01</span>
        <h3>Formalization of TADA</h3>
        <p>We formalize Text Analysis for Data Analysis (TADA) as a tabular-centric paradigm, highlighting <strong>stability as a functional necessity</strong> for integrating probabilistic LLM outputs into deterministic OLAP workflows.</p>
      </li>
      <li>
        <span class="num">02</span>
        <h3>CAST Framework</h3>
        <p>A novel approach that constrains generation via <strong>Algorithmic Prompting</strong> and intermediate commitments, reducing the entropy of latent paths without expensive search-based methods.</p>
      </li>
      <li>
        <span class="num">03</span>
        <h3>Stability Metrics</h3>
        <p>We introduce <strong>CAST-S</strong> and <strong>CAST-T</strong>, stability-focused evaluation metrics combining semantic matching with order sensitivity (Kendall's Tau) to capture human-perceived consistency.</p>
      </li>
      <li>
        <span class="num">04</span>
        <h3>Strong Empirical Results</h3>
        <p>Up to <strong>16.2% improvement</strong> in Stability Score across multiple LLM backbones, with no regression in accuracy.</p>
      </li>
    </ol>
  </section>

  <section class="project-section">
    <h2 class="section-title">Method</h2>
    <p class="pp-lead">
      CAST addresses the instability problem by constraining the LLM's latent reasoning trajectory through two complementary mechanisms:
    </p>

    <div class="pp-method">
      <div class="pp-method-item">
        <h3>Algorithmic Prompting</h3>
        <p>Specifies an algorithmic scaffold for the task, translating classic deterministic workflows into a structured prompt sequence. This scaffold acts as a strong prior over valid reasoning transitions, effectively pruning high-entropy paths.</p>
      </div>
      <div class="pp-method-item">
        <h3>Thinking-before-Speaking</h3>
        <p>Enforces the scaffold by requiring the model to produce well-defined intermediate states (domain, topic schema, clusters) before emitting the final output. By committing to these states, the model follows a more stable reasoning path.</p>
      </div>
    </div>

    <div class="figure-block">
      <img src="{{ '/images/cast-fig1-tada.png' | relative_url }}" alt="TADA Operations">
      <div class="figure-caption">
        <strong>Figure 2:</strong> Illustration of the summarization and tagging operations for TADA. These atomic operations can be composed and reused in complex TADA tasks.
      </div>
    </div>
  </section>

  <section class="project-section">
    <h2 class="section-title">Empirical Observation</h2>
    <p class="pp-lead">
      We empirically demonstrate that requiring relevant intermediate states demonstrably sharpens the model's output distribution. As shown below, CAST produces the sharpest and most concentrated distribution, indicating substantially improved run-to-run stability.
    </p>

    <div class="figure-block">
      <img src="{{ '/images/cast-fig3-kde.png' | relative_url }}" alt="Output Length Stability">
      <div class="figure-caption">
        <strong>Figure 3:</strong> Output-length stability under different prompting strategies. KDE-smoothed distributions of summary length compare (i) direct prompting, (ii) irrelevant intermediate states, (iii) relevant intermediate states, and (iv) the full CAST prompt. CAST produces the sharpest distribution with outputs tightly clustered around a central value.
      </div>
    </div>
  </section>

  <section class="project-section">
    <h2 class="section-title">Results</h2>

    <div class="pp-results-row">
      <div class="pp-result">
        <span class="value">+16.2%</span>
        <span class="label">max Stability Score improvement</span>
      </div>
      <div class="pp-result">
        <span class="value">32</span>
        <span class="label">dataset–query pairs evaluated</span>
      </div>
      <div class="pp-result">
        <span class="value">5,100+</span>
        <span class="label">items across 4 domains</span>
      </div>
    </div>

    <div class="figure-block">
      <img src="{{ '/images/cast-fig4-tagging.png' | relative_url }}" alt="Tagging Pipeline">
      <div class="figure-caption">
        <strong>Figure 4:</strong> The CAST framework for tagging, illustrating a pipeline that begins with query decomposition and domain identification to guide the core algorithmic prompting stage, and concludes with output validation.
      </div>
    </div>
  </section>

  <section class="project-section">
    <h2 class="section-title">Citation</h2>
    <div class="bibtex-section">
      <button class="bibtex-copy-btn" onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText);this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',2000);">Copy</button>
      <div class="bibtex-code">@misc{xie2026castachievingstablellmbased,
      title={CAST: Achieving Stable LLM-based Text Analysis for Data Analytics}, 
      author={Jinxiang Xie and Zihao Li and Wei He and Rui Ding and Shi Han and Dongmei Zhang},
      year={2026},
      eprint={2602.15861},
      archivePrefix={arXiv},
      primaryClass={cs.CL},
      url={https://arxiv.org/abs/2602.15861}, 
}</div>
    </div>
  </section>

  <div class="pp-acknowledgments">
    <strong>Acknowledgments:</strong> This work was done during the author's internship at Microsoft Research. We thank all colleagues and mentors from the DKI group for their support and valuable feedback.
  </div>

  <footer class="pp-footer">
    <a href="{{ '/' | relative_url }}" target="_self">← Homepage</a>
    <span class="sep">·</span>
    <a href="https://x.com/JinxiangTse" target="_blank" rel="noopener noreferrer">Follow me on X</a>
    <span class="sep">·</span>
    <a href="https://www.xiaohongshu.com/user/profile/60c47bae000000000100b07e" target="_blank" rel="noopener noreferrer">Follow me on RedNote</a>
  </footer>

</div>

{% include project-page-enhance.html %}
