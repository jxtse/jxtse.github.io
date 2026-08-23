---
permalink: /dsgram/
title: "DSGram: Dynamic Weighting Sub-Metrics for Grammatical Error Correction"
author_profile: false
---

<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
<link rel="stylesheet" href="{{ '/assets/css/project-page.css' | relative_url }}?v={{ site.time | date: '%s' }}">

<div class="project-container">

  <header class="project-header">
    <div class="project-venue-badge">AAAI 2025</div>
    <h1 class="project-title">DSGram: Dynamic Weighting Sub-Metrics for Grammatical Error Correction in the Era of Large Language Models</h1>

    <p class="pp-hero-tagline">
      Reference-based metrics like BLEU break down on LLM-based GEC systems. <strong>DSGram</strong> introduces a dynamic-weighting framework with three new sub-metrics that align <strong>significantly better with human judgment</strong>.
    </p>

    <div class="project-authors">
      <a href="https://jxtse.github.io">Jinxiang Xie</a><sup>1,2</sup>,
      Yilin Li<sup>1</sup>,
      Xunjian Yin<sup>1</sup>,
      <a href="https://wanxiaojun.github.io/">Xiaojun Wan</a><sup>1</sup>
    </div>
    <div class="affiliations">
      <sup>1</sup>Peking University &nbsp;·&nbsp;
      <sup>2</sup>Beijing Jiaotong University
    </div>

    <div class="links-bar">
      <a href="https://arxiv.org/abs/2412.12832" target="_blank" rel="noopener noreferrer"><i class="fas fa-file-alt"></i> Paper</a>
      <a href="https://arxiv.org/pdf/2412.12832" target="_blank" rel="noopener noreferrer"><i class="fas fa-file-pdf"></i> PDF</a>
      <a href="https://github.com/jxtse/GEC-Metrics-DSGram" target="_blank" rel="noopener noreferrer"><i class="fab fa-github"></i> Code</a>
    </div>
  </header>

  <section class="teaser-section">
    <img src="{{ '/images/dsgram-fig2-architecture.png' | relative_url }}" alt="DSGram Architecture" class="teaser-image">
    <div class="teaser-caption">
      <strong>Figure 1:</strong> Architecture of the DSGram method. It begins with the input of sentence pairs (original and corrected). LLMs are employed to generate dynamic weights, which are refined through a judgment matrix and a consistency check. These dynamic weights are normalized and used to score sub-metrics, producing an overall evaluation score.
    </div>
  </section>

  <section class="abstract-section">
    <div class="abstract-title">Abstract</div>
    <div class="abstract-text">
      Evaluating the performance of Grammatical Error Correction (GEC) models has become increasingly challenging, as large language model (LLM)-based GEC systems often produce corrections that diverge from provided gold references. This discrepancy undermines the reliability of traditional reference-based evaluation metrics.
      <br><br>
      In this study, we propose a novel evaluation framework for GEC models, <strong>DSGram</strong>, integrating <strong>Semantic Coherence</strong>, <strong>Edit Level</strong>, and <strong>Fluency</strong>, and utilizing a <strong>dynamic weighting mechanism</strong>. Our framework employs the Analytic Hierarchy Process (AHP) in conjunction with large language models to ascertain the relative importance of various evaluation criteria. Additionally, we develop a dataset incorporating human annotations and LLM-simulated sentences to validate our algorithms and fine-tune more cost-effective models.
      <br><br>
      Experimental results indicate that our proposed approach enhances the effectiveness of GEC model evaluations.
    </div>
  </section>

  <section class="project-section">
    <h2 class="section-title">Motivation</h2>
    <p class="pp-lead">
      Traditional GEC evaluation metrics have significant limitations when dealing with LLM-based systems. As shown below, BLEU fails to differentiate between over- and under-correction, while SOME cannot capture over-correction. DSGram addresses these gaps with a comprehensive evaluation framework.
    </p>
    <div class="figure-block">
      <img src="{{ '/images/dsgram-fig1-examples.png' | relative_url }}" alt="Motivation Examples">
      <div class="figure-caption">
        <strong>Figure 2:</strong> Running examples and evaluation results of existing metrics. BLEU fails to differentiate between over- and under-correction, whereas SOME cannot capture over-correction. Blue highlights over-correction; red indicates poor fluency.
      </div>
    </div>
  </section>

  <section class="project-section">
    <h2 class="section-title">Key Contributions</h2>
    <ol class="pp-contrib-list">
      <li>
        <span class="num">01</span>
        <h3>New Sub-Metrics</h3>
        <p>We introduce redesigned sub-metrics for GEC evaluation — <strong>Semantic Coherence</strong>, <strong>Edit Level</strong>, and <strong>Fluency</strong> — that address the over-editing problem in LLM-based GEC models.</p>
      </li>
      <li>
        <span class="num">02</span>
        <h3>Dynamic Weighting with AHP</h3>
        <p>A novel dynamic weighting method integrating the <strong>Analytic Hierarchy Process</strong> with LLMs to ascertain the context-dependent importance of evaluation criteria.</p>
      </li>
      <li>
        <span class="num">03</span>
        <h3>Evaluation Datasets</h3>
        <p>We release <strong>DSGram-Eval</strong> (human-annotated) and <strong>DSGram-LLMs</strong> (GPT-4 simulated), both built on CoNLL-2014 and BEA-2019 test sets for rigorous evaluation.</p>
      </li>
      <li>
        <span class="num">04</span>
        <h3>Superior Correlation</h3>
        <p>DSGram achieves <strong>higher correlation with human judgments</strong> than all conventional reference-based and reference-free metrics on the SEEDA benchmark.</p>
      </li>
    </ol>
  </section>

  <section class="project-section">
    <h2 class="section-title">Method</h2>
    <p class="pp-lead">
      DSGram comprises two main components: <strong>score generation</strong> and <strong>weight generation</strong>. By applying context-specific weights to the generated scores, an overall evaluation score is obtained.
    </p>

    <div class="pp-method">
      <div class="pp-method-item">
        <h3>Three Sub-Metrics</h3>
        <p><strong>Semantic Coherence:</strong> degree to which original meaning is preserved. <strong>Edit Level:</strong> whether corrections are necessary and appropriate. <strong>Fluency:</strong> grammatical correctness and natural flow.</p>
      </div>
      <div class="pp-method-item">
        <h3>Dynamic Weighting via AHP</h3>
        <p>Uses LLMs to construct pairwise comparison matrices for each sentence, with consistency checks and eigenvector normalization. Formal texts emphasize Edit Level; casual texts prioritize Fluency.</p>
      </div>
    </div>

    <div class="figure-block">
      <img src="{{ '/images/dsgram-fig5-score-computation.png' | relative_url }}" alt="Score Computation">
      <div class="figure-caption">
        <strong>Figure 3:</strong> DSGram score computation for two different sentences. Sentence (a) is a casual dialogue where Fluency is emphasized. Sentence (b) is a formal expression where Edit Level receives greater weight.
      </div>
    </div>
  </section>

  <section class="project-section">
    <h2 class="section-title">Sub-Metrics Analysis</h2>
    <p class="pp-lead">
      We redesigned the sub-metrics to reduce redundancy and improve coverage. The original SOME metrics showed high correlation (0.89) between Grammaticality and Fluency. Our new sub-metrics achieve a more balanced distribution.
    </p>

    <div class="pp-figure-pair">
      <figure>
        <img src="{{ '/images/dsgram-fig3-heatmap-some.png' | relative_url }}" alt="SOME Heatmap">
        <figcaption><strong>SOME sub-metrics:</strong> high correlation (0.89) between Grammaticality and Fluency.</figcaption>
      </figure>
      <figure>
        <img src="{{ '/images/dsgram-fig4-heatmap-ours.png' | relative_url }}" alt="DSGram Heatmap">
        <figcaption><strong>DSGram sub-metrics:</strong> more evenly distributed correlation.</figcaption>
      </figure>
    </div>
  </section>

  <section class="project-section">
    <h2 class="section-title">Results</h2>

    <div class="pp-results-row">
      <div class="pp-result">
        <span class="value">0.8764</span>
        <span class="label">Pearson corr. with human scores (AHP dynamic weighting)</span>
      </div>
      <div class="pp-result">
        <span class="value">0.8544</span>
        <span class="label">average-weighting baseline</span>
      </div>
      <div class="pp-result">
        <span class="value">12</span>
        <span class="label">GEC systems on SEEDA</span>
      </div>
    </div>

    <p class="pp-lead">
      DSGram's correlation with human feedback surpasses all conventional reference-based metrics (M², ERRANT, BLEU) and reference-free metrics (GLEU, Scribendi Score). Fine-tuned LLaMA3-8B and LLaMA2-13B models on DSGram-LLMs dataset also outperform their few-shot counterparts, demonstrating the framework's practicality with cost-effective models.
    </p>
  </section>

  <section class="project-section">
    <h2 class="section-title">Citation</h2>
    <div class="bibtex-section">
      <button class="bibtex-copy-btn" onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText);this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',2000);">Copy</button>
      <div class="bibtex-code">@misc{xie2025dsgramdynamicweightingsubmetrics,
      title={DSGram: Dynamic Weighting Sub-Metrics for Grammatical Error Correction in the Era of Large Language Models}, 
      author={Jinxiang Xie and Yilin Li and Xunjian Yin and Xiaojun Wan},
      year={2025},
      eprint={2412.12832},
      archivePrefix={arXiv},
      primaryClass={cs.CL},
      doi={https://doi.org/10.1609/aaai.v39i24.34746},
      url={https://arxiv.org/abs/2412.12832}, 
}</div>
    </div>
  </section>

  <div class="pp-acknowledgments">
    <strong>Acknowledgments:</strong> This work was done during the author's research internship at Peking University. We thank Prof. Xiaojun Wan and all colleagues from the Wangxuan Institute of Computer Technology for their guidance and support.
  </div>

  <footer class="pp-footer">
    <a href="{{ '/' | relative_url }}" target="_self">← Homepage</a>
    <span class="sep">·</span>
    <a href="https://x.com/JinxiangTse" target="_blank" rel="noopener noreferrer">Follow me on X</a>
    <span class="sep">·</span>
    <a href="https://www.xiaohongshu.com/user/profile/60c47bae000000000100b07e" target="_blank" rel="noopener noreferrer">Follow me on RedNote</a>
  </footer>

</div>
