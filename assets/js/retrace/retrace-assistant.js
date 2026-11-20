/*
 * ReTRACE route planner UI. Talks only to ReTRACEApi (plan store or live service).
 */
(function () {
  'use strict';

  var root = document.getElementById('ra-console');
  if (!root || !window.ReTRACEApi) return;
  var api = window.ReTRACEApi;

  var client = api.createClient({
    apiBase: root.getAttribute('data-api-base') || '',
    sessionsUrl: root.getAttribute('data-sessions-url')
  });

  var $ = function (sel) { return root.querySelector(sel); };
  var els = {
    model: $('[data-ra="model"]'),
    form: $('[data-ra="form"]'),
    smiles: $('[data-ra="smiles"]'),
    draw: $('[data-ra="draw"]'),
    sketch: $('[data-ra="sketch"]'),
    jsme: $('[data-ra="jsme"]'),
    sketchUse: $('[data-ra="sketch-use"]'),
    sketchCancel: $('[data-ra="sketch-cancel"]'),
    presets: root.querySelectorAll('[data-ra="preset"] input'),
    run: $('[data-ra="run"]'),
    status: $('[data-ra="status"]'),
    error: $('[data-ra="error"]'),
    empty: $('[data-ra="empty"]'),
    routes: $('[data-ra="routes"]'),
    detail: $('[data-ra="detail"]'),
    drawer: $('[data-ra="drawer"]'),
    steer: $('[data-ra="steer"]'),
    feedback: $('[data-ra="feedback"]'),
    steerRun: $('[data-ra="steer-run"]'),
    quota: $('[data-ra="quota"]'),
    quotaClose: $('[data-ra="quota-close"]')
  };

  var state = { live: false, plan: null, route: 0, running: false, controller: null };

  /* ---------------- helpers ---------------- */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function fmt(x, d) { return (x == null || isNaN(x)) ? '–' : Number(x).toFixed(d == null ? 2 : d); }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function sentence(s) { s = String(s || '').trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function bar(v) {
    var b = el('span', 'ra-bar');
    var i = el('i');
    i.style.width = (v == null ? 0 : Math.max(0, Math.min(1, v)) * 100) + '%';
    b.appendChild(i);
    return b;
  }

  /* ---------------- structures ---------------- */

  var drawer = null;
  function getDrawer() {
    if (drawer || !window.SmiDrawer) return drawer;
    drawer = new window.SmiDrawer({
      bondThickness: 1.25,
      bondLength: 24,
      shortBondLength: 0.8,
      fontSizeLarge: 11,
      fontSizeSmall: 7,
      padding: 4,
      compactDrawing: false,
      terminalCarbons: false,
      explicitHydrogens: true,
      fontFamily: 'Arial, Helvetica, sans-serif'
    }, {});
    return drawer;
  }

  var svgNS = 'http://www.w3.org/2000/svg';
  // Plans may ship server-rendered depictions (RDKit, ACS 1996 style, one
  // bond length, intermediates aligned to the target). Use them when present.
  var RDKIT_SCALE = 1.5;
  var parser = new DOMParser();
  var svgTags = new Set('svg g path rect text tspan line polyline polygon circle ellipse defs title'.split(' '));
  var paint = new Set(('fill fill-rule fill-opacity stroke stroke-width stroke-linecap stroke-linejoin ' +
    'stroke-opacity stroke-miterlimit stroke-dasharray opacity font-size font-family font-weight text-anchor').split(' '));
  var svgAttrs = new Set(('version baseProfile width height viewBox x y x1 y1 x2 y2 cx cy r rx ry points d class style').split(' '));
  function safeValue(value) { return /^[a-zA-Z0-9#.%+, -]+$/.test(value); }
  function rebuildSvg(node) {
    if (node.namespaceURI !== svgNS || !svgTags.has(node.tagName)) return null;
    var out = document.createElementNS(svgNS, node.tagName);
    for (var attr of node.attributes) {
      if (attr.namespaceURI === 'http://www.w3.org/2000/xmlns/') continue;
      if (attr.name === 'xml:space' && /^(preserve|default)$/.test(attr.value)) continue;
      if (attr.namespaceURI || (!svgAttrs.has(attr.name) && !paint.has(attr.name))) return null;
      if (attr.name === 'style') {
        for (var decl of attr.value.split(';')) {
          if (!decl.trim()) continue;
          var parts = decl.split(':');
          if (parts.length !== 2 || !paint.has(parts[0].trim()) || !safeValue(parts[1].trim())) return null;
        }
      } else if (!safeValue(attr.value)) return null;
      out.setAttribute(attr.name, attr.value);
    }
    for (var child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) out.appendChild(document.createTextNode(child.textContent));
      else if (child.nodeType === Node.ELEMENT_NODE) {
        var clean = rebuildSvg(child);
        if (!clean) return null;
        out.appendChild(clean);
      } else return null;
    }
    return out;
  }
  function depiction(smiles, scale) {
    var src = state.plan && state.plan.structures && state.plan.structures[smiles];
    if (typeof src !== 'string' || src.length > 40000 || /<!|<\?/.test(src)) return null;
    var doc = parser.parseFromString(src, 'image/svg+xml');
    var svg = doc.documentElement;
    if (!svg || svg.nodeName !== 'svg') return null;
    try { svg = rebuildSvg(svg); } catch (e) { return null; }
    if (!svg) return null;
    var w = parseFloat(svg.getAttribute('width'));
    var h = parseFloat(svg.getAttribute('height'));
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Structure ' + smiles);
    svg.setAttribute('data-scale', String((scale || 1) * RDKIT_SCALE));
    if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    sizeSvg(svg, 1);
    return svg;
  }

  function structure(smiles, scale) {
    var fig = el('div', 'ra-mol');
    var pre = depiction(smiles, scale);
    if (pre) { fig.appendChild(pre); return fig; }
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Structure ' + smiles);
    svg.setAttribute('data-scale', String(scale || 1));
    fig.appendChild(svg);
    var fallback = function () {
      fig.classList.add('ra-mol--text');
      clear(fig);
      fig.appendChild(el('code', null, smiles));
    };
    var d = getDrawer();
    if (!d) { fallback(); return fig; }
    try {
      d.draw(smiles, svg, 'light', function () { sizeSvg(svg, 1); }, fallback);
    } catch (e) { fallback(); }
    return fig;
  }

  // SmilesDrawer sizes each SVG to its own bounding box. Fix the pixel size
  // from the viewBox so every structure in a scheme shares one bond length.
  function sizeSvg(svg, factor) {
    var vb = svg.viewBox && svg.viewBox.baseVal;
    var w = vb && vb.width ? vb.width : parseFloat(svg.getAttribute('width'));
    var h = vb && vb.height ? vb.height : parseFloat(svg.getAttribute('height'));
    if (!w || !h) return;
    if (!vb || !vb.width) svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    var s = parseFloat(svg.getAttribute('data-scale') || '1') * factor;
    svg.style.width = Math.round(w * s) + 'px';
    svg.style.height = Math.round(h * s) + 'px';
    svg.removeAttribute('width');
    svg.removeAttribute('height');
  }

  // Shrink a scheme's structures uniformly until it fits its container.
  // Arrows keep their size, so solve for the factor on the structures alone.
  function fitScheme(box) {
    var svgs = box.querySelectorAll('svg[data-scale]');
    var factor = 1;
    for (var k = 0; k < 8; k++) {
      var need = box.scrollWidth - box.clientWidth;
      if (need <= 1) break;
      var mols = 0;
      Array.prototype.forEach.call(svgs, function (s) {
        if (!s.closest('.ra-arrow')) mols += s.getBoundingClientRect().width;
      });
      if (mols <= 0) break;
      factor = factor * Math.max(0.5, (mols - need - 2) / mols);
      Array.prototype.forEach.call(svgs, function (s) { sizeSvg(s, factor); });
    }
  }

  /* ---------------- vocabulary ---------------- */

  var VERDICT = {
    VALID: ['ok', 'Valid'],
    SUSPECT: ['warn', 'Concern'],
    FAKE: ['bad', 'Fatal error'],
    ERROR: ['', 'Not judged']
  };
  var TOOLS = [
    ['neural_retro', 'Single-step prediction', 'four retrosynthesis models'],
    ['suggest_templates', 'Template matching', 'reaction template library'],
    ['score_route', 'Route scoring', 'feasibility, cost, greenness'],
    ['explore_branches', 'Branch comparison', 'ranks candidate disconnections'],
    ['check_buyability', 'Stock lookup', 'purchasable building blocks'],
    ['validate_smiles', 'Structure validation', 'parses and sanitises structures'],
    ['analyze_molecule', 'Molecule analysis', 'functional groups, complexity'],
    ['save_best_route', 'Route saved', 'adds a route to the ranked set'],
    ['list_best_routes', 'Ranked set review', 'reads the current ranking']
  ];
  var STOCK = { Zinc: 'ZINC', BioNav: 'BioNav' };

  /* ---------------- sketcher (JSME, loaded on first use) ---------------- */

  var jsme = null;
  var jsmeLoading = null;
  function loadJsme() {
    if (jsmeLoading) return jsmeLoading;
    jsmeLoading = new Promise(function (resolve, reject) {
      window.jsmeOnLoad = function () {
        clear(els.jsme);
        var w = Math.max(320, els.jsme.clientWidth - 2);
        jsme = new window.JSApplet.JSME('ra-jsme', w + 'px', '376px', { options: 'newlook,nocanonize,zoom' });
        resolve(jsme);
      };
      var s = document.createElement('script');
      s.src = root.getAttribute('data-jsme-url');
      s.async = true;
      s.onerror = function () { reject(new Error('The structure editor could not be loaded.')); };
      document.head.appendChild(s);
    });
    return jsmeLoading;
  }

  function openSketch(open) {
    els.sketch.hidden = !open;
    els.draw.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open) return;
    loadJsme().then(function (editor) {
      var smi = api.normalizeSmiles(els.smiles.value);
      if (smi) { try { editor.readGenericMolecularInput(smi); } catch (e) { /* keep canvas */ } }
    }).catch(function (err) {
      clear(els.jsme);
      els.jsme.appendChild(el('p', 'ra-sketch-wait', err.message));
    });
  }
  els.draw.addEventListener('click', function () { openSketch(els.sketch.hidden); });
  els.sketchCancel.addEventListener('click', function () { openSketch(false); els.draw.focus(); });
  els.sketchUse.addEventListener('click', function () {
    if (!jsme) return;
    var smi = jsme.smiles();
    if (smi) { els.smiles.value = smi; syncControls(); onTargetInput(); }
    openSketch(false);
    els.smiles.focus();
  });

  /* ---------------- empty state ---------------- */

  var previewTimer = null;
  function onTargetInput() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(function () {
      if (state.plan && api.normalizeSmiles(els.smiles.value) === api.normalizeSmiles(state.plan.target)) return;
      showEmpty();
    }, 150);
  }

  function showEmpty() {
    state.plan = null;
    syncControls();
    clear(els.status);
    els.routes.hidden = true;
    els.detail.hidden = true;
    els.drawer.hidden = true;
    els.empty.hidden = false;
    clear(els.empty);
    var smi = api.normalizeSmiles(els.smiles.value);
    if (smi) els.empty.appendChild(structure(smi, 1.3));
    els.empty.appendChild(el('p', null, smi
      ? 'Choose a search effort and select Plan routes.'
      : 'Enter a target as SMILES or draw it. Ranked routes appear here.'));
  }

  /* ---------------- quota notice ---------------- */

  var QUOTA_TEXT = "Today's planning quota is used up. Please try again tomorrow.";

  function openQuota() {
    if (!els.quota || els.quota.open) {
      setError(QUOTA_TEXT);
      return;
    }
    setError(null);
    if (typeof els.quota.showModal === 'function') els.quota.showModal();
    else els.quota.setAttribute('open', 'open');
    var focus = els.quotaClose || els.quota.querySelector('button');
    if (focus) focus.focus();
  }

  function closeQuota() {
    if (!els.quota) return;
    if (typeof els.quota.close === 'function') els.quota.close();
    else els.quota.removeAttribute('open');
    els.quota.returnValue = '';
  }

  if (els.quotaClose) els.quotaClose.addEventListener('click', closeQuota);
  if (els.quota) {
    els.quota.addEventListener('click', function (e) {
      // Clicking the backdrop (the dialog element itself) closes it.
      if (e.target === els.quota) closeQuota();
    });
    els.quota.addEventListener('close', function () { els.run.focus(); });
  }

  /* ---------------- status strip ---------------- */

  var ERRORS = {
    quota_exhausted: QUOTA_TEXT,
    plan_budget_exceeded: 'This request exceeds the budget. Try a lower search effort.',
    service_busy: 'Planning is temporarily unavailable. Please try again shortly.',
    queue_full: 'The planner is busy right now. Please try again in a few minutes.',
    rate_limited: 'Too many requests from this network. Please try again later.',
    invalid_smiles: 'That target could not be read as a molecule. Check the SMILES and try again.',
    invalid_request: 'That request could not be accepted. Check the target SMILES.',
    service_unavailable: 'The route planner is unavailable right now. Please try again shortly.',
    not_found: 'This plan is no longer available.',
    forbidden: 'Refining or cancelling this plan needs the browser session that created it.',
    continuation_unavailable: 'This plan cannot be refined because its working record is incomplete.',
    conflict: 'This plan is still running. Wait for it to finish, then refine.',
    network: 'The connection to the route planner was interrupted.'
  };

  function fail(err) {
    var code = (err && err.code) || 'network';
    if (code === 'quota_exhausted') { openQuota(); return; }
    setError(ERRORS[code] || (err && err.message) || ERRORS.network);
  }

  function progressText(plan) {
    var p = plan.progress || {};
    if (p.status === 'queued' || p.stage === 'queued') {
      return p.queue_position ? 'Queued · position ' + p.queue_position : 'Queued';
    }
    var bits = [];
    if (typeof p.iteration === 'number' && p.iteration > 0) bits.push('planning iteration ' + p.iteration);
    if (typeof p.tool_calls === 'number' && p.tool_calls > 0) bits.push(p.tool_calls + ' tool calls');
    if (typeof p.elapsed_s === 'number' && p.elapsed_s > 0) bits.push(Math.round(p.elapsed_s / 60) + ' min elapsed');
    return bits.join(' · ') || 'Planning';
  }

  function renderStatus(plan, running) {
    clear(els.status);
    els.status.appendChild(el('span', 'ra-state' + (running ? ' ra-state--busy' : ''), running ? 'Planning' : 'Completed'));
    var facts = el('span');
    var parts = [
      [plan.routes.length, plan.routes.length === 1 ? 'route' : 'routes'],
      [plan.iterations, 'planning iterations'],
      [plan.tool_calls, 'tool calls']
    ];
    var first = true;
    parts.forEach(function (p) {
      if (p[0] == null) return;
      if (!first) facts.appendChild(document.createTextNode(' · '));
      first = false;
      facts.appendChild(el('b', null, String(p[0])));
      facts.appendChild(document.createTextNode(' ' + p[1]));
    });
    if (plan.wall_s) {
      facts.appendChild(document.createTextNode(' · '));
      facts.appendChild(el('b', null, String(Math.round(plan.wall_s / 60))));
      facts.appendChild(document.createTextNode(' min'));
    }
    els.status.appendChild(facts);
    if (running) {
      var live = el('span', 'ra-progress', progressText(plan));
      els.status.appendChild(document.createTextNode(' · '));
      els.status.appendChild(live);
    }
    var link = el('button', 'ra-link', 'Tool calls');
    link.type = 'button';
    link.setAttribute('aria-expanded', els.drawer.hidden ? 'false' : 'true');
    link.setAttribute('aria-controls', 'ra-drawer');
    link.addEventListener('click', function () {
      var open = els.drawer.hidden;
      els.drawer.hidden = !open;
      link.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    els.status.appendChild(link);
  }

  function timeText(ms) {
    if (ms == null) return '–';
    if (ms >= 60000) return (ms / 60000).toFixed(1) + ' min';
    if (ms >= 1000) return (ms / 1000).toFixed(1) + ' s';
    return '< 1 s';
  }

  function renderDrawer(plan) {
    clear(els.drawer);
    els.drawer.id = 'ra-drawer';
    els.drawer.hidden = true;
    els.drawer.appendChild(el('h5', null, 'Tool calls in this plan'));
    var t = el('table');
    var head = el('thead');
    var hr = el('tr');
    ['Tool', 'Calls', 'Time'].forEach(function (h) { hr.appendChild(el('th', null, h)); });
    head.appendChild(hr);
    t.appendChild(head);
    var body = el('tbody');
    var counts = plan.tool_counts || {};
    var ms = plan.tool_ms || {};
    var total = 0;
    var totalMs = 0;
    TOOLS.forEach(function (x) {
      if (!counts[x[0]]) return;
      total += counts[x[0]];
      totalMs += ms[x[0]] || 0;
      var tr = el('tr');
      var name = el('td');
      name.appendChild(el('span', null, x[1]));
      name.appendChild(el('span', 'ra-tool-what', x[2]));
      tr.appendChild(name);
      tr.appendChild(el('td', null, String(counts[x[0]])));
      tr.appendChild(el('td', null, timeText(ms[x[0]])));
      body.appendChild(tr);
    });
    t.appendChild(body);
    var foot = el('tfoot');
    var fr = el('tr');
    fr.appendChild(el('td', null, 'Total'));
    fr.appendChild(el('td', null, String(total)));
    fr.appendChild(el('td', null, timeText(totalMs)));
    foot.appendChild(fr);
    t.appendChild(foot);
    els.drawer.appendChild(t);
  }

  /* ---------------- route table ---------------- */

  function renderRoutes() {
    var plan = state.plan;
    clear(els.routes);
    var head = el('div', 'ra-list-head');
    ['#', 'Score', 'Feasibility', 'Cost', 'Greenness'].forEach(function (h) { head.appendChild(el('span', null, h)); });
    els.routes.appendChild(head);
    plan.routes.forEach(function (r, i) {
      var b = el('button', 'ra-row');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', i === state.route ? 'true' : 'false');
      b.setAttribute('tabindex', i === state.route ? '0' : '-1');
      b.setAttribute('aria-label', 'Route ' + r.rank + ', score ' + fmt(r.scores.total, 3));
      b.appendChild(el('span', 'ra-row-rank', String(r.rank)));
      b.appendChild(el('span', 'ra-row-score', fmt(r.scores.total, 3)));
      [r.scores.feasibility, r.scores.cost, r.scores.greenness].forEach(function (v) {
        var m = el('span', 'ra-mini');
        m.appendChild(el('span', null, fmt(v)));
        m.appendChild(bar(v));
        b.appendChild(m);
      });
      b.addEventListener('click', function () { selectRoute(i, true); });
      els.routes.appendChild(b);
    });
  }

  els.routes.addEventListener('keydown', function (e) {
    var plan = state.plan;
    if (!plan) return;
    var delta = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!delta) return;
    e.preventDefault();
    selectRoute((state.route + delta + plan.routes.length) % plan.routes.length, true);
  });

  function selectRoute(i, focus) {
    state.route = i;
    Array.prototype.forEach.call(els.routes.querySelectorAll('.ra-row'), function (b, j) {
      b.setAttribute('aria-selected', j === i ? 'true' : 'false');
      b.setAttribute('tabindex', j === i ? '0' : '-1');
      if (focus && j === i) b.focus();
    });
    renderDetail();
  }

  /* ---------------- route detail ---------------- */

  function forwardOrder(route) {
    var order = [];
    var seen = {};
    function visit(k) {
      if (seen[k] || !route.steps[k]) return;
      seen[k] = true;
      (route.steps[k].precursor_steps || []).forEach(function (kids) { (kids || []).forEach(visit); });
      order.push(k);
    }
    visit(route.root_step);
    route.steps.forEach(function (_, k) { visit(k); });
    return order;
  }

  // A linear route: each step after the first consumes exactly the product
  // of the step before it, so it draws as one left-to-right chain.
  function isLinear(route, order) {
    for (var n = 0; n < order.length; n++) {
      var st = route.steps[order[n]];
      var made = (st.precursor_steps || []).reduce(function (acc, x) { return acc.concat(x || []); }, []);
      if (n === 0 && made.length) return false;
      if (n > 0 && (made.length !== 1 || made[0] !== order[n - 1])) return false;
    }
    return true;
  }

  function heavy(smi) { return (String(smi).match(/Cl|Br|[BCNOSPFI]|[cnosp]/g) || []).length; }

  function stockOf(route, smi) {
    var hit = null;
    (route.leaves || []).forEach(function (l) { if (l.smiles === smi) hit = l; });
    return hit && hit.stock && hit.stock.length ? hit.stock.map(function (x) { return STOCK[x] || x; }) : null;
  }

  // Reaction arrow: co-reactants sit above the line, the step number below.
  // The trailing hidden caption keeps the line level with the structures.
  function arrow(num, coReactants) {
    var a = el('div', 'ra-arrow');
    var mid = el('div', 'ra-arrow-mid');
    var co = el('div', 'ra-arrow-co');
    coReactants.forEach(function (smi, j) {
      if (j) co.appendChild(el('span', 'ra-plus', '+'));
      co.appendChild(structure(smi, 0.92));
    });
    mid.appendChild(co);
    mid.appendChild(el('span', 'ra-arrow-line'));
    mid.appendChild(el('span', 'ra-arrow-num', String(num)));
    a.appendChild(mid);
    a.appendChild(el('span', 'ra-arrow-foot', '\u00a0'));
    return a;
  }

  function node(smiles, tag, tagCls, scale) {
    var n = el('div', 'ra-node');
    var mols = el('div', 'ra-node-mols');
    smiles.forEach(function (smi, j) {
      if (j) mols.appendChild(el('span', 'ra-plus', '+'));
      mols.appendChild(structure(smi, scale || 1));
    });
    n.appendChild(mols);
    n.appendChild(el('span', 'ra-node-tag' + (tagCls ? ' ' + tagCls : ''), tag || '\u00a0'));
    return n;
  }

  function scheme(route, order) {
    var box = el('div', 'ra-scheme');
    var first = route.steps[order[0]];
    var pre = first.precursors.slice().sort(function (a, b) { return heavy(b) - heavy(a); });
    var start = pre[0];
    var stock = stockOf(route, start);
    box.appendChild(node([start], stock ? 'In stock · ' + stock.join(', ') : 'Starting material'));
    order.forEach(function (k, n) {
      var st = route.steps[k];
      var co = n === 0 ? pre.slice(1) : st.precursors.filter(function (p, j) {
        return !(st.precursor_steps[j] || []).length;
      });
      box.appendChild(arrow(n + 1, co));
      var isTarget = k === route.root_step;
      box.appendChild(node([st.product], isTarget ? 'Target' : 'Intermediate', isTarget ? 'ra-node-tag--target' : ''));
    });
    return box;
  }

  function stepRows(route, order) {
    var wrap = el('div', 'ra-rows');
    order.forEach(function (k, n) {
      var st = route.steps[k];
      var row = el('div', 'ra-scheme');
      row.appendChild(node(st.precursors, null, null, 0.7));
      row.appendChild(arrow(n + 1, []));
      row.appendChild(node([st.product], k === route.root_step ? 'Target' : null, 'ra-node-tag--target', 0.7));
      wrap.appendChild(row);
    });
    return wrap;
  }

  // Audit notes use a compact chemist's notation for carbon balance.
  function tidyReason(text) {
    return String(text || '').replace(/C\s?delta\s*=\s*-\s*(\d+)/gi, '\u0394C = \u2212$1')
      .replace(/C\s?delta\s*=\s*\+?\s*(\d+)/gi, '\u0394C = +$1');
  }

  function stepCard(route, k, n) {
    var st = route.steps[k];
    var li = el('li', 'ra-card');
    var head = el('div', 'ra-card-head');
    head.appendChild(el('span', 'ra-arrow-num', String(n + 1)));
    head.appendChild(el('h5', null, 'Step ' + (n + 1)));
    if (st.audit) {
      var m = VERDICT[st.audit.verdict] || ['', st.audit.verdict];
      head.appendChild(el('span', 'ra-verdict' + (m[0] ? ' ra-verdict--' + m[0] : ''), m[1]));
    }
    li.appendChild(head);
    // The audited description replaces the planner's own reaction label.
    var what = st.audit && st.audit.reason ? tidyReason(st.audit.reason) : sentence(st.reaction);
    if (what) li.appendChild(el('p', 'ra-reason', what));
    var meta = el('p', 'ra-card-meta');
    if (st.feasibility != null) {
      meta.appendChild(document.createTextNode('Feasibility '));
      meta.appendChild(el('b', null, fmt(st.feasibility)));
      meta.appendChild(document.createTextNode('  ·  '));
    }
    var support = (st.engines || []).concat(st.templates || []);
    meta.appendChild(document.createTextNode(support.length ? 'Supported by ' : ''));
    meta.appendChild(el('b', null, support.length ? support.join(', ') : 'Planner proposal'));
    li.appendChild(meta);
    return li;
  }

  function renderDetail() {
    var plan = state.plan;
    var r = plan && plan.routes[state.route];
    clear(els.detail);
    if (!r) return;
    var order = forwardOrder(r);

    var head = el('div', 'ra-detail-head');
    var title = el('div', 'ra-detail-title');
    title.appendChild(el('h4', null, 'Route ' + r.rank));
    title.appendChild(el('span', 'ra-node-tag', plural(r.steps.length, 'step')));
    head.appendChild(title);
    var total = el('div', 'ra-total');
    total.appendChild(el('b', null, fmt(r.scores.total, 3)));
    total.appendChild(el('span', null, 'Route score'));
    head.appendChild(total);
    var subs = el('div', 'ra-subs');
    [['Feasibility', r.scores.feasibility], ['Cost', r.scores.cost], ['Greenness', r.scores.greenness]].forEach(function (x) {
      var s = el('div', 'ra-sub');
      s.appendChild(el('span', null, x[0]));
      s.appendChild(el('b', null, fmt(x[1])));
      s.appendChild(bar(x[1]));
      subs.appendChild(s);
    });
    head.appendChild(subs);
    var badge;
    if (r.audit) {
      var nValid = r.steps.filter(function (s) { return s.audit && s.audit.verdict === 'VALID'; }).length;
      var tone = r.audit.verdict === 'VALID' ? 'ok' : r.audit.verdict === 'FAKE' ? 'bad' : 'warn';
      badge = el('span', 'ra-badge ra-badge--' + tone, 'Audit · ' + nValid + ' of ' + r.steps.length + ' steps valid');
    } else {
      badge = el('span', 'ra-badge', 'Not audited');
      badge.title = 'The chemistry audit reviews the top-ranked route of each plan.';
    }
    head.appendChild(badge);
    els.detail.appendChild(head);

    var sch = isLinear(r, order) ? scheme(r, order) : stepRows(r, order);
    els.detail.appendChild(sch);

    var cards = el('ol', 'ra-cards');
    order.forEach(function (k, n) { cards.appendChild(stepCard(r, k, n)); });
    els.detail.appendChild(cards);

    requestAnimationFrame(function () {
      var rows = sch.classList.contains('ra-scheme') ? [sch] : Array.prototype.slice.call(sch.children);
      rows.forEach(fitScheme);
    });
  }

  /* ---------------- show a plan ---------------- */

  function showPlan(plan) {
    state.plan = plan;
    state.route = 0;
    setError(null);
    els.empty.hidden = true;
    els.routes.hidden = false;
    els.detail.hidden = false;
    if (plan.preset) {
      Array.prototype.forEach.call(els.presets, function (i) { i.checked = i.value === plan.preset; });
    }
    renderDrawer(plan);
    renderStatus(plan, false);
    renderRoutes();
    renderDetail();
    syncControls();
  }

  /* ---------------- actions ---------------- */

  function setError(msg) {
    clear(els.error);
    els.error.hidden = !msg;
    if (msg) els.error.appendChild(el('p', null, msg));
  }

  function currentPreset() {
    var p = 'standard';
    Array.prototype.forEach.call(els.presets, function (i) { if (i.checked) p = i.value; });
    return p;
  }

  // Plan routes needs a target; refining needs a plan to refine.
  function syncControls() {
    var hasTarget = !!api.normalizeSmiles(els.smiles.value);
    els.run.disabled = state.running || !hasTarget;
    els.feedback.disabled = state.running || !state.plan;
    els.steerRun.disabled = state.running || !state.plan;
  }

  function setRunning(on) {
    state.running = on;
    els.run.textContent = on ? 'Planning…' : 'Plan routes';
    syncControls();
  }

  function mergeRoute(plan, route) {
    plan.routes = plan.routes.filter(function (r) { return r.rank !== route.rank; })
      .concat([route]).sort(function (a, b) { return a.rank - b.rank; });
  }

  function mergeStructures(plan, structures) {
    if (!structures) return;
    plan.structures = plan.structures || {};
    Object.keys(structures).forEach(function (smi) { plan.structures[smi] = structures[smi]; });
  }

  function stream(planId, plan) {
    state.controller = new AbortController();
    setRunning(true);
    renderStatus(plan, true);
    return client.streamPlan(planId, {
      cursor: function (seq) { plan.last_seq = seq; },
      snapshot: function (snapshot) {
        Object.assign(plan, snapshot);
        showPlan(plan);
        setRunning(plan.status === 'queued' || plan.status === 'running');
      },
      status: function (ev) {
        plan.progress = plan.progress || {};
        plan.progress.stage = ev.stage;
        plan.progress.message = ev.message;
        plan.progress.status = ev.status;
        plan.progress.queue_position = ev.queue_position;
        plan.progress.iteration = ev.iteration;
        plan.progress.tool_calls = ev.tool_calls;
        plan.progress.elapsed_s = ev.elapsed_s;
        if (ev.iteration != null) plan.iterations = ev.iteration;
        if (ev.tool_calls != null) plan.tool_calls = ev.tool_calls;
        setRunning(true);
        if (state.plan !== plan) showPlan(plan);
        else { renderStatus(plan, true); }
      },
      route: function (route) {
        mergeRoute(plan, route);
        if (state.plan !== plan) showPlan(plan); else { renderRoutes(); renderDetail(); }
        renderStatus(plan, true);
      },
      routes: function (ev) {
        (ev.routes || []).forEach(function (r) { mergeRoute(plan, r); });
        if (state.plan === plan) { renderRoutes(); renderDetail(); }
        renderStatus(plan, true);
      },
      structures: function (ev) {
        var drawings = Object.assign({}, ev);
        delete drawings.phase; delete drawings.seq; delete drawings.ts;
        mergeStructures(plan, drawings);
        if (state.plan === plan) { renderRoutes(); renderDetail(); }
      },
      done: function (done) {
        if (done.iterations != null) plan.iterations = done.iterations;
        if (done.tool_calls != null) plan.tool_calls = done.tool_calls;
        if (done.tool_counts) plan.tool_counts = done.tool_counts;
        if (done.wall_s) plan.wall_s = done.wall_s;
        if (done.status) plan.status = done.status;
        plan.progress = { status: done.status || 'completed', stage: done.status || 'completed' };
        renderDrawer(plan);
        setRunning(false);
        renderStatus(plan, false);
        if (done.status === 'cancelled') setError('Planning was cancelled.');
        if ((done.status === 'failed') && !plan.routes.length) {
          setError(ERRORS.service_unavailable);
        } else if ((done.status === 'completed') && !plan.routes.length) {
          setError('No complete route was found within this search effort. Refine the search to continue.');
        }
      },
      error: function (err) {
        setRunning(false);
        fail(err || { code: 'service_unavailable' });
        if (state.plan === plan) renderStatus(plan, false);
      },
      cancelled: function () { setRunning(false); setError('Planning was cancelled.'); }
    }, state.controller.signal, plan.last_seq || 0).then(function () {
      setRunning(false);
      if (state.plan === plan) renderStatus(plan, false);
    });
  }

  function run(e) {
    if (e) e.preventDefault();
    if (state.running) return;
    setError(null);
    var request = {
      target_smiles: els.smiles.value,
      preset: currentPreset(),
      max_routes: 10,
      weights: api.DEFAULT_WEIGHTS,
      instructions: ''
    };
    client.createPlan(request).then(function (res) {
      if (res.session) { showPlan(res.session); return; }
      var plan = {
        id: res.plan_id, target: api.normalizeSmiles(request.target_smiles), preset: request.preset,
        routes: [], tool_counts: {}, tool_ms: {}, structures: {},
        progress: { status: res.status, queue_position: res.queue_position }
      };
      showPlan(plan);
      return stream(res.plan_id, plan);
    }).catch(function (err) { setRunning(false); fail(err); });
  }

  function steer(e) {
    if (e) e.preventDefault();
    var text = els.feedback.value.trim();
    if (!text) { els.feedback.focus(); return; }
    if (!state.plan) { setError('Plan routes for a target first, then refine the search.'); return; }
    if (state.live && (!client.tokens || !client.tokens[state.plan.id])) {
      setError('Refining needs the tab that created this plan. Plan the target again here, then refine it.');
      return;
    }
    client.continuePlan(state.plan.id, { feedback: text, extra_rounds: 6 })
      .then(function () {
        els.feedback.value = '';
        state.plan.progress = { status: 'queued', stage: 'queued' };
        return stream(state.plan.id, state.plan);
      })
      .catch(function (err) { setRunning(false); fail(err); });
  }

  els.form.addEventListener('submit', run);
  els.steer.addEventListener('submit', steer);
  els.smiles.addEventListener('input', function () { syncControls(); onTargetInput(); });

  /* ---------------- page integration ---------------- */

  // The wide console overlaps the page's TOC rail; hide the rail while the
  // console is on screen.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      document.body.classList.toggle('ra-wide-in-view', entries[0].isIntersecting);
    }, { threshold: 0.05 }).observe(root);
  }

  /* ---------------- init ---------------- */

  var params = new URLSearchParams(window.location.search);
  client.health().then(function (info) {
    state.live = !!info.live;
    // Only ever show the coordinator the service reports as serving.
    if (info.model) els.model.textContent = info.model;
    state.serving = info.serving !== false;
    if (state.live && info.error_code === 'quota_exhausted') openQuota();
    if (state.live && !state.serving) {
      setError('The route planner is starting up. Please try again shortly.');
    }
    var id = params.get('plan');
    if (!id) { showEmpty(); return; }
    return client.getPlan(id).then(function (plan) {
      els.smiles.value = plan.target;
      showPlan(plan);
    }).catch(function (err) { showEmpty(); fail(err); });
  }).catch(function (err) {
    showEmpty();
    fail({ code: 'service_unavailable' });
  }).then(function () { root.classList.add('is-ready'); });
})();
