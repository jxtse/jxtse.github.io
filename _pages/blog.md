---
permalink: /blog/
title: "Blog"
excerpt: "All blog posts"
author_profile: true
---

<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">

<span class='anchor' id='blog-list'></span>

# <i class="fas fa-blog"></i> All Posts

<div class="blog-grid">
{% assign sorted_posts = site.posts | sort: 'date' | reverse %}
{% for post in sorted_posts %}
  <a href="{{ post.url | relative_url }}" class="blog-card-link">
    <div class="blog-card">
      <div class="blog-card-image">
        <div class="blog-badge">{{ post.date | date: "%B, %Y" }}</div>
        {% if post.cover_image %}
        <img src="{{ post.cover_image | relative_url }}" alt="{{ post.title }}">
        {% else %}
        <img src="{{ '/images/default-blog-cover.jpg' | relative_url }}" alt="{{ post.title }}">
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
