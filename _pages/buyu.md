---
permalink: /buyu/
title: "BuYu 步语"
author_profile: false
---

<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
<link rel="stylesheet" href="{{ '/assets/css/project-page.css' | relative_url }}">

<div class="project-container">

  <header class="project-header">
    <div class="project-venue-badge"><i class="fas fa-walking"></i> NJU Hackathon 2026 · Product</div>
    <h1 class="project-title">BuYu 步语 — Walk the Story of a City</h1>
    <div class="project-subtitle">An AI walking companion that turns Nanjing's streets into a talking, personalized guided tour</div>

    <p class="pp-hero-tagline">
      会说话的历史现场 — BuYu pairs curator-verified local knowledge with real-time voice interaction, so a walk through the city becomes a living, personal narration instead of a static map route.
    </p>
  </header>

  <section class="project-section pp-fadeup">
    <h2 class="section-title">Demo Video</h2>
    <div class="figure-block">
      <video controls preload="metadata" style="width:100%;border-radius:10px;">
        <source src="{{ '/images/buyu/buyu-demo.mp4' | relative_url }}" type="video/mp4">
      </video>
      <div class="figure-caption">
        <strong>Product demo.</strong> Route browsing, historical storytelling cards, and the voice-interaction entry — the core walking-companion experience.
      </div>
    </div>
    <div class="figure-block">
      <video controls preload="metadata" style="width:100%;border-radius:10px;">
        <source src="{{ '/images/buyu/buyu-voice-demo.mp4' | relative_url }}" type="video/mp4">
      </video>
      <div class="figure-caption">
        <strong>Real-time voice demo.</strong> Live speech-to-speech narration running against the app, with the realtime session monitor alongside — the guide answers while you walk.
      </div>
    </div>
  </section>

  <section class="project-section pp-fadeup">
    <h2 class="section-title">Product Walkthrough</h2>
    <p style="font-size: 1.05em; line-height: 1.7; color: #444; margin-bottom: 25px;">
      One complete loop: pick a mood-matched route, walk it with an AI companion, mark discoveries along the way, and leave with an auto-generated walking journal ready to share.
    </p>
    <div class="buyu-shots">
      <figure><img src="{{ '/images/buyu/p1_welcome.jpg' | relative_url }}" alt="Welcome — Your Walking Companion" loading="lazy"><figcaption>Welcome</figcaption></figure>
      <figure><img src="{{ '/images/buyu/p2_home.jpg' | relative_url }}" alt="Home — route recommendations" loading="lazy"><figcaption>Route picks</figcaption></figure>
      <figure><img src="{{ '/images/buyu/p3_route.jpg' | relative_url }}" alt="Route detail — Xuanwu Lake sunset line" loading="lazy"><figcaption>Route detail</figcaption></figure>
      <figure><img src="{{ '/images/buyu/p4_walk.jpg' | relative_url }}" alt="Walking — live map with AI voice" loading="lazy"><figcaption>Walk + talk</figcaption></figure>
      <figure><img src="{{ '/images/buyu/p5_discover.jpg' | relative_url }}" alt="Discovery — spot card en route" loading="lazy"><figcaption>Discoveries</figcaption></figure>
      <figure><img src="{{ '/images/buyu/p6_notes.jpg' | relative_url }}" alt="Walking notes — AI summary" loading="lazy"><figcaption>Walk notes</figcaption></figure>
      <figure><img src="{{ '/images/buyu/p7_plog.jpg' | relative_url }}" alt="Plog — shareable walking journal" loading="lazy"><figcaption>Shareable Plog</figcaption></figure>
    </div>
  </section>

  <section class="project-section pp-fadeup">
    <h2 class="section-title">Poster</h2>
    <div class="figure-block">
      <img src="{{ '/images/buyu/poster.jpg' | relative_url }}" alt="BuYu campaign poster">
      <div class="figure-caption">
        Hackathon campaign poster — 带上步步，立马出发.
      </div>
    </div>
  </section>

  <section class="project-section pp-fadeup">
    <h2 class="section-title">What Makes It Different</h2>
    <div class="pp-contrib-grid pp-fadeup-stagger">
      <div class="pp-contrib-card">
        <div class="pp-contrib-num">01</div>
        <h3 class="pp-contrib-title">Curator-Verified Knowledge</h3>
        <p class="pp-contrib-text">Narrations are grounded in verified local history and culture, not free-form model generation — the guide tells stories that hold up.</p>
      </div>
      <div class="pp-contrib-card">
        <div class="pp-contrib-num">02</div>
        <h3 class="pp-contrib-title">Real-Time Voice</h3>
        <p class="pp-contrib-text">Speech-to-speech interaction while walking: ask about what's in front of you and get an answer without breaking stride.</p>
      </div>
      <div class="pp-contrib-card">
        <div class="pp-contrib-num">03</div>
        <h3 class="pp-contrib-title">Every Walk Is Different</h3>
        <p class="pp-contrib-text">Routes adapt to mood, time, and companions; the same street yields a different narration each visit.</p>
      </div>
      <div class="pp-contrib-card">
        <div class="pp-contrib-num">04</div>
        <h3 class="pp-contrib-title">From Walk to Memory</h3>
        <p class="pp-contrib-text">Discoveries and thoughts along the way are auto-composed into a shareable illustrated walking journal (Plog).</p>
      </div>
    </div>
  </section>

</div>

<style>
.buyu-shots {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
.buyu-shots figure {
  margin: 0;
}
.buyu-shots img {
  width: 100%;
  border-radius: 10px;
  border: 1px solid rgba(0,0,0,0.08);
  box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04);
}
.buyu-shots figcaption {
  text-align: center;
  font-size: 0.85rem;
  color: #6b7280;
  margin-top: 6px;
}
@media (max-width: 760px) {
  .buyu-shots { grid-template-columns: repeat(2, 1fr); }
}
</style>

{% include project-page-enhance.html %}
