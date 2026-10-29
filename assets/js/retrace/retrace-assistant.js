/*
 * ReTRACE assistant UI. Talks only to ReTRACEApi (mock replay or live service).
 */
(function () {
  'use strict';

  var root = document.getElementById('ra-console');
  if (!root || !window.ReTRACEApi) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var client = window.ReTRACEApi.createClient({
    apiBase: root.getAttribute('data-api-base') || '',
    replayUrl: root.getAttribute('data-replay-url'),
    reducedMotion: reduced
  });

  var $ = function (sel) { return root.querySelector(sel); };
  var els = {
    mode: $('[data-ra="mode"]'),
    modeText: $('[data-ra="mode-text"]'),
    form: $('[data-ra="form"]'),
    smiles: $('[data-ra="smiles"]'),
    examples: $('[data-ra="examples"]'),
    preview: $('[data-ra="preview"]'),
    previewNote: $('[data-ra="preview-note"]'),
    presets: root.querySelectorAll('[data-ra="preset"] input'),
    weights: root.querySelectorAll('[data-ra="weight"]'),
    weightOut: root.querySelectorAll('[data-ra="weight-out"]'),
    instructions: $('[data-ra="instructions"]'),
    prefNote: $('[data-ra="pref-note"]'),
    run: $('[data-ra="run"]'),
    cancel: $('[data-ra="cancel"]'),
    error: $('[data-ra="error"]'),
    log: $('[data-ra="log"]'),
    results: $('[data-ra="results"]'),
    summary: $('[data-ra="summary"]'),
    list: $('[data-ra="route-list"]'),
    detail: $('[data-ra="route-detail"]')
  };

  var state = { routes: [], selected: 0, running: false, controller: null, planId: null, examples: [] };

  /* ---------------- structure drawing ---------------- */

  var drawer = null;
  function getDrawer() {
    if (drawer || !window.SmiDrawer) return drawer;
    drawer = new window.SmiDrawer({
      bondThickness: 1.1,
      bondLength: 26,
      shortBondLength: 0.82,
      fontSizeLarge: 9,
      fontSizeSmall: 5,
      padding: 6,
      compactDrawing: false,
      terminalCarbons: false,
      explicitHydrogens: true
    }, {});
    return drawer;
  }

  var svgNS = 'http://www.w3.org/2000/svg';
  // One drawing scale for every reaction tile, so bond lengths and atom
  // labels match across molecules. The target preview is drawn larger.
  var STEP_SCALE = 1.0;
  var TARGET_SCALE = 1.45;
  function structure(smiles, cls, scale) {
    var fig = document.createElement('div');
    fig.className = 'ra-mol' + (cls ? ' ' + cls : '');
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Structure: ' + smiles);
    fig.appendChild(svg);
    var code = document.createElement('code');
    code.className = 'ra-mol-smiles';
    code.textContent = smiles;
    code.title = smiles;
    fig.appendChild(code);
    var d = getDrawer();
    if (!d) { fig.classList.add('ra-mol--text'); return fig; }
    try {
      d.draw(smiles, svg, 'light', function () {
        fitSvg(svg, scale || STEP_SCALE);
      }, function () {
        fig.classList.add('ra-mol--text');
      });
    } catch (e) {
      fig.classList.add('ra-mol--text');
    }
    return fig;
  }

  // SmilesDrawer sizes each SVG to its own bounding box. Re-derive the
  // pixel size from the viewBox so all tiles share one scale.
  function fitSvg(svg, scale) {
    var vb = svg.viewBox && svg.viewBox.baseVal;
    var w = vb && vb.width ? vb.width : parseFloat(svg.getAttribute('width'));
    var h = vb && vb.height ? vb.height : parseFloat(svg.getAttribute('height'));
    if (!w || !h) return;
    if (!vb || !vb.width) svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.style.width = '';
    svg.style.height = '';
    svg.setAttribute('width', Math.round(w * scale));
    svg.setAttribute('height', Math.round(h * scale));
  }

  /* ---------------- helpers ---------------- */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var DEFECT = {
    NONE: '',
    WRONG_REAGENT_OR_CONDITIONS: 'Reagent or conditions cannot effect the change',
    WRONG_REGIO_OR_CONSTITUTIONAL: 'Wrong regiochemistry or connectivity',
    WRONG_REGIO_OR_CONDITIONS: 'Wrong regiochemistry or conditions',
    STEREO_ONLY: 'Stereochemistry only',
    IMPOSSIBLE_OR_NONSENSE_REACTION: 'No known mechanism',
    CHEMOSELECTIVITY: 'Chemoselectivity concern',
    WRONG_RING_SIZE: 'Wrong ring size',
    FABRICATED_OR_MISSING_SKELETAL_CARBON: 'Skeletal carbons appear or vanish'
  };
  function defectLabel(code) {
    if (!code) return '';
    return DEFECT.hasOwnProperty(code) ? DEFECT[code] : code.replace(/_/g, ' ').toLowerCase();
  }

  function stepBadge(v) {
    if (v === 'VALID') return ['ra-badge ra-badge--ok', 'No issue'];
    if (v === 'SUSPECT') return ['ra-badge ra-badge--warn', 'Concern'];
    if (v === 'FAKE') return ['ra-badge ra-badge--bad', 'Fatal flag'];
    return ['ra-badge', 'Not judged'];
  }

  function currentPreset() {
    var p = 'standard';
    Array.prototype.forEach.call(els.presets, function (i) { if (i.checked) p = i.value; });
    return p;
  }

  function currentWeights() {
    var w = {};
    Array.prototype.forEach.call(els.weights, function (i) { w[i.name] = parseFloat(i.value); });
    var sum = (w.feasibility || 0) + (w.cost || 0) + (w.greenness || 0);
    if (sum > 0) Object.keys(w).forEach(function (k) { w[k] = Math.round((w[k] / sum) * 100) / 100; });
    return w;
  }

  function renderWeights() {
    var w = currentWeights();
    Array.prototype.forEach.call(els.weightOut, function (o) {
      o.textContent = (w[o.getAttribute('data-for')] || 0).toFixed(2);
    });
  }

  function setError(msg, examples) {
    els.error.innerHTML = '';
    if (!msg) { els.error.hidden = true; return; }
    els.error.hidden = false;
    els.error.appendChild(el('p', null, msg));
    if (examples && examples.length) {
      els.error.appendChild(el('p', 'ra-error-hint', 'Try one of the example targets above.'));
    }
  }

  function log(message, kind) {
    var li = el('li', 'ra-log-item' + (kind ? ' ra-log-item--' + kind : ''), message);
    els.log.appendChild(li);
    els.log.hidden = false;
  }

  function setRunning(on) {
    state.running = on;
    els.run.disabled = on;
    els.cancel.hidden = !on;
    root.classList.toggle('is-running', on);
    els.run.textContent = on ? 'Planning…' : 'Plan routes';
  }

  /* ---------------- target preview ---------------- */

  var previewTimer = null;
  function updatePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(function () {
      var smi = window.ReTRACEApi.normalizeSmiles(els.smiles.value);
      els.preview.innerHTML = '';
      if (!smi) {
        els.preview.appendChild(el('div', 'ra-preview-empty', 'Target structure appears here'));
        els.previewNote.textContent = '';
        return;
      }
      els.preview.appendChild(structure(smi, 'ra-mol--target', TARGET_SCALE));
      var known = state.examples.some(function (e) { return e.target_smiles === smi; });
      els.previewNote.textContent = (client.mode === 'replay' && !known)
        ? 'Not in the recorded set. Live planning will accept any target once the service is open.'
        : '';
      Array.prototype.forEach.call(els.examples.querySelectorAll('button'), function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-smiles') === smi ? 'true' : 'false');
      });
    }, 180);
  }

  /* ---------------- routes ---------------- */

  function renderSummary(done) {
    els.summary.innerHTML = '';
    var line = el('p', 'ra-summary-line');
    var n = done.routes_returned;
    var k = done.routes_passed;
    line.appendChild(el('strong', null, k + ' of ' + n));
    line.appendChild(document.createTextNode(' returned route' + (n === 1 ? '' : 's') + ' passed the audit'));
    if (done.first_passing_rank) {
      line.appendChild(document.createTextNode(' · first passing route at rank '));
      line.appendChild(el('strong', null, String(done.first_passing_rank)));
    } else {
      line.appendChild(document.createTextNode(' · none of the returned routes passed'));
    }
    els.summary.appendChild(line);
    if (done.replay) {
      els.summary.appendChild(el('p', 'ra-summary-src',
        'Recorded ' + done.target_label + ' run, GPT-5.6 Sol (' + done.preset + '), scored by the frozen two-stage audit used in the paper.'));
    }
  }

  function renderList() {
    els.list.innerHTML = '';
    state.routes.forEach(function (r, i) {
      var b = el('button', 'ra-route-tab');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', i === state.selected ? 'true' : 'false');
      b.setAttribute('tabindex', i === state.selected ? '0' : '-1');
      b.appendChild(el('span', 'ra-route-rank', '#' + r.rank));
      b.appendChild(el('span', 'ra-route-steps', r.steps.length + ' step' + (r.steps.length === 1 ? '' : 's')));
      b.appendChild(el('span', r.audit.passed ? 'ra-dot ra-dot--ok' : 'ra-dot ra-dot--bad',
        r.audit.passed ? 'Passed' : 'Failed'));
      b.addEventListener('click', function () { select(i, true); });
      els.list.appendChild(b);
    });
  }

  els.list.addEventListener('keydown', function (e) {
    if (!state.routes.length) return;
    var delta = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!delta) return;
    e.preventDefault();
    select((state.selected + delta + state.routes.length) % state.routes.length, true);
  });

  function select(i, focus) {
    state.selected = i;
    renderList();
    renderDetail(state.routes[i]);
    if (focus) {
      var tab = els.list.children[i];
      if (tab) tab.focus();
    }
  }

  // Order steps from the starting materials towards the target so the
  // forward synthesis reads top to bottom.
  function forwardOrder(route) {
    var order = [];
    var seen = {};
    function visit(k) {
      if (seen[k] || !route.steps[k]) return;
      seen[k] = true;
      (route.steps[k].precursor_steps || []).forEach(function (kids) {
        (kids || []).forEach(visit);
      });
      order.push(k);
    }
    visit(route.root_step);
    route.steps.forEach(function (_, k) { visit(k); });
    return order;
  }

  function renderDetail(route) {
    els.detail.innerHTML = '';
    if (!route) return;
    var a = route.audit;

    var head = el('div', 'ra-detail-head');
    var h = el('h4', 'ra-detail-title', 'Route #' + route.rank);
    head.appendChild(h);
    head.appendChild(el('span', a.passed ? 'ra-verdict ra-verdict--ok' : 'ra-verdict ra-verdict--bad',
      a.passed ? 'Passed audit' : 'Failed audit'));
    els.detail.appendChild(head);

    var meta = el('p', 'ra-detail-meta');
    meta.textContent = route.steps.length + ' steps · ' + (a.n_fatal_steps || 0) + ' fatal flag' +
      ((a.n_fatal_steps || 0) === 1 ? '' : 's') + ' · ' + (a.n_suspect_steps || 0) + ' concern' +
      ((a.n_suspect_steps || 0) === 1 ? '' : 's') +
      (a.worst_defect && a.worst_defect !== 'NONE' ? ' · worst: ' + defectLabel(a.worst_defect) : '');
    els.detail.appendChild(meta);

    if (a.summary) els.detail.appendChild(el('p', 'ra-detail-summary', a.summary));

    if (a.stage2 && a.stage2.triggered && a.stage2.reason) {
      var det = el('details', 'ra-stage2');
      var sum = el('summary', null, a.stage2.upheld === false
        ? 'Stage 2 defence overturned the fatal flag'
        : 'Stage 2 defence did not overturn the fatal flag');
      det.appendChild(sum);
      det.appendChild(el('p', null, a.stage2.reason));
      els.detail.appendChild(det);
    }

    var ol = el('ol', 'ra-steps');
    forwardOrder(route).forEach(function (k, n) {
      var s = route.steps[k];
      var li = el('li', 'ra-step');
      var top = el('div', 'ra-step-head');
      top.appendChild(el('span', 'ra-step-num', 'Step ' + (n + 1)));
      var b = stepBadge(s.audit.verdict);
      top.appendChild(el('span', b[0], b[1]));
      var dl = defectLabel(s.audit.defect);
      if (dl) top.appendChild(el('span', 'ra-step-defect', dl));
      li.appendChild(top);

      var rxn = el('div', 'ra-rxn');
      var left = el('div', 'ra-rxn-side');
      s.precursors.forEach(function (p, j) {
        if (j) left.appendChild(el('span', 'ra-plus', '+'));
        left.appendChild(structure(p));
      });
      rxn.appendChild(left);
      rxn.appendChild(el('span', 'ra-arrow', '→'));
      var right = el('div', 'ra-rxn-side');
      right.appendChild(structure(s.product, k === route.root_step ? 'ra-mol--target' : ''));
      rxn.appendChild(right);
      li.appendChild(rxn);

      if (s.audit.reason) li.appendChild(el('p', 'ra-step-reason', s.audit.reason));
      ol.appendChild(li);
    });
    els.detail.appendChild(ol);
  }

  /* ---------------- run ---------------- */

  function resetResults() {
    state.routes = [];
    state.selected = 0;
    els.log.innerHTML = '';
    els.log.hidden = true;
    els.summary.innerHTML = '';
    els.list.innerHTML = '';
    els.detail.innerHTML = '';
    els.results.hidden = true;
    setError(null);
  }

  function run(e) {
    if (e) e.preventDefault();
    if (state.running) return;
    resetResults();
    var request = {
      target_smiles: els.smiles.value,
      preset: currentPreset(),
      max_routes: 10,
      weights: currentWeights(),
      instructions: els.instructions.value.trim()
    };
    var controller = new AbortController();
    state.controller = controller;
    setRunning(true);

    client.createPlan(request).then(function (plan) {
      state.planId = plan.plan_id;
      log(plan.mode === 'replay' ? 'Request accepted · preview mode' : 'Request accepted · plan ' + plan.plan_id);
      return client.streamPlan(plan.plan_id, {
        status: function (ev) { log(ev.message); },
        route: function (route) {
          state.routes.push(route);
          els.results.hidden = false;
          if (state.routes.length === 1) select(0, false); else renderList();
        },
        done: function (done) {
          log('Finished', 'done');
          renderSummary(done);
        },
        error: function (err) { setError(err.message); log('Stopped: ' + err.message, 'error'); },
        cancelled: function () { log('Cancelled', 'error'); }
      }, controller.signal);
    }).catch(function (err) {
      setError(err.message, err.examples);
    }).then(function () {
      setRunning(false);
      state.controller = null;
    });
  }

  function cancel() {
    if (state.controller) state.controller.abort();
    if (state.planId) client.cancelPlan(state.planId);
  }

  /* ---------------- init ---------------- */

  function applyMode(info) {
    var live = info && info.live;
    root.classList.toggle('is-live', !!live);
    root.classList.toggle('is-replay', !live);
    els.modeText.textContent = live
      ? 'Live · planning service connected'
      : 'Preview · replays recorded benchmark runs';
    var lock = !live;
    Array.prototype.forEach.call(els.weights, function (i) { i.disabled = lock; });
    els.instructions.disabled = lock;
    els.prefNote.hidden = !lock;
  }

  function renderExamples(list) {
    els.examples.innerHTML = '';
    state.examples = list || [];
    state.examples.forEach(function (ex) {
      var b = el('button', 'ra-chip', ex.label);
      b.type = 'button';
      b.setAttribute('data-smiles', ex.target_smiles);
      b.setAttribute('aria-pressed', 'false');
      b.title = ex.target_smiles;
      b.addEventListener('click', function () {
        els.smiles.value = ex.target_smiles;
        updatePreview();
      });
      els.examples.appendChild(b);
    });
  }

  els.form.addEventListener('submit', run);
  els.cancel.addEventListener('click', cancel);
  els.smiles.addEventListener('input', updatePreview);
  Array.prototype.forEach.call(els.weights, function (i) { i.addEventListener('input', renderWeights); });
  renderWeights();

  client.health().then(function (info) {
    applyMode(info);
    renderExamples(info.examples || []);
    if (!els.smiles.value && state.examples.length) els.smiles.value = state.examples[0].target_smiles;
    updatePreview();
    root.classList.add('is-ready');
  }).catch(function (err) {
    applyMode({ live: client.mode === 'live' });
    els.modeText.textContent = 'Unavailable';
    els.run.disabled = true;
    setError('The assistant is unavailable right now. ' + (err && err.message ? err.message : ''));
    updatePreview();
  });
})();
