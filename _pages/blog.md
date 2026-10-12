---
permalink: /blog/
title: "Blog"
description: "Essays by Jinxiang Xie on AI research, LLM agents, research tools, and personal reflections."
author_profile: true
---

<span class='anchor' id='blog-list'></span>

# <i class="fas fa-pen-fancy"></i> All Posts

<div class="blog-grid">
{% assign sorted_posts = site.posts | sort: 'date' | reverse %}
{% for post in sorted_posts %}
  <a href="{{ post.url | relative_url }}" class="blog-card-link">
    <div class="blog-card">
      <div class="blog-card-image">
        <div class="blog-badge">{{ post.date | date: "%B, %Y" }}</div>
        {% if forloop.index <= 3 %}
          {% include blog-card-image.html post=post loading="eager" %}
        {% else %}
          {% include blog-card-image.html post=post %}
        {% endif %}
      </div>
      <div class="blog-card-content">
        <div class="blog-title">{{ post.title }}</div>
        <div class="blog-description">{{ post.description | default: post.excerpt | strip_html | truncate: 150 }}</div>
      </div>
    </div>
  </a>
{% endfor %}
</div>

{% if site.posts.size == 0 %}
<div class="quote-accent">
  <p>No blog posts yet. Check back soon!</p>
</div>
{% endif %}
