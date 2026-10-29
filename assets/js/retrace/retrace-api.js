/*
 * ReTRACE assistant client.
 *
 * One interface, two transports:
 *   - MockClient replays recorded Retro*-190 runs from a static JSON file.
 *   - HttpClient talks to the planning service (see docs/retrace-assistant-api.md).
 *
 * The UI only uses createPlan / streamPlan / cancelPlan / health, so switching
 * to the live backend is a configuration change (data-api-base or ?api=).
 */
(function (global) {
  'use strict';

  var DEFAULT_WEIGHTS = { feasibility: 0.7, cost: 0.15, greenness: 0.15 };
  var PRESETS = ['fast', 'standard', 'thorough'];

  function ApiError(code, message, extra) {
    var err = new Error(message);
    err.name = 'ApiError';
    err.code = code;
    if (extra) Object.keys(extra).forEach(function (k) { err[k] = extra[k]; });
    return err;
  }

  function normalizeSmiles(s) {
    return String(s || '').trim().replace(/\s+/g, '');
  }

  function validateRequest(req) {
    var smiles = normalizeSmiles(req && req.target_smiles);
    if (!smiles) throw ApiError('invalid_request', 'Enter a target molecule as SMILES.');
    if (smiles.length > 400) throw ApiError('invalid_request', 'SMILES is longer than 400 characters.');
    var preset = (req && req.preset) || 'standard';
    if (PRESETS.indexOf(preset) < 0) throw ApiError('invalid_request', 'Unknown preset: ' + preset);
    var maxRoutes = Math.max(1, Math.min(10, (req && req.max_routes) || 10));
    return {
      target_smiles: smiles,
      preset: preset,
      max_routes: maxRoutes,
      weights: (req && req.weights) || DEFAULT_WEIGHTS,
      instructions: (req && req.instructions) || ''
    };
  }

  function sleep(ms, signal) {
    return new Promise(function (resolve, reject) {
      if (signal && signal.aborted) return reject(ApiError('cancelled', 'Cancelled'));
      var t = setTimeout(resolve, ms);
      if (signal) signal.addEventListener('abort', function () {
        clearTimeout(t);
        reject(ApiError('cancelled', 'Cancelled'));
      }, { once: true });
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Mock transport: deterministic replay of recorded runs                   */
  /* ---------------------------------------------------------------------- */

  function toApiRoute(r) {
    return {
      rank: r.rank,
      audit: {
        passed: r.passed,
        verdict: r.verdict,
        worst_defect: r.worst_defect,
        n_fatal_steps: r.n_fatal,
        n_suspect_steps: r.n_suspect,
        summary: r.summary,
        stage2: r.stage2
      },
      root_step: r.root_steps && r.root_steps.length ? r.root_steps[0] : r.steps.length - 1,
      steps: r.steps.map(function (s) {
        return {
          index: s.i,
          product: s.product,
          precursors: s.precursors,
          precursor_steps: s.children,
          audit: { verdict: s.verdict, defect: s.defect, reason: s.reason }
        };
      }),
      scores: null
    };
  }

  function MockClient(opts) {
    this.mode = 'replay';
    this.replayUrl = opts.replayUrl;
    this.delay = opts.reducedMotion ? 0 : (opts.delay == null ? 320 : opts.delay);
    this._data = null;
    this._plans = {};
    this._seq = 0;
  }

  MockClient.prototype._load = function () {
    var self = this;
    if (self._data) return Promise.resolve(self._data);
    return fetch(self.replayUrl, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw ApiError('unavailable', 'Could not load recorded runs (' + res.status + ').');
        return res.json();
      })
      .then(function (data) {
        self._data = data;
        return data;
      });
  };

  MockClient.prototype.health = function () {
    return this._load().then(function (data) {
      return {
        mode: 'replay',
        live: false,
        source: data.source,
        audit_rule: data.audit_rule,
        examples: data.targets.map(function (t) {
          return { id: t.id, label: 'Retro*-190 #' + t.index, target_smiles: t.smiles };
        })
      };
    });
  };

  MockClient.prototype.createPlan = function (request) {
    var self = this;
    var req;
    try { req = validateRequest(request); } catch (e) { return Promise.reject(e); }
    return self._load().then(function (data) {
      var target = null;
      data.targets.forEach(function (t) {
        if (normalizeSmiles(t.smiles) === req.target_smiles) target = t;
      });
      if (!target) {
        throw ApiError('not_in_replay',
          'Live planning is not open yet. This preview can only replay the recorded example targets.',
          { examples: data.targets.map(function (t) { return t.smiles; }) });
      }
      var cond = target.conditions[req.preset];
      if (!cond || !cond.routes.length) {
        throw ApiError('no_record', 'No recorded run for this target with the ' + req.preset + ' preset.');
      }
      var id = 'replay-' + target.id + '-' + req.preset + '-' + (++self._seq);
      self._plans[id] = { request: req, target: target, cond: cond, cancelled: false };
      return { plan_id: id, status: 'queued', mode: 'replay' };
    });
  };

  MockClient.prototype.streamPlan = function (planId, on, signal) {
    var self = this;
    var plan = self._plans[planId];
    if (!plan) return Promise.reject(ApiError('not_found', 'Unknown plan ' + planId));
    var req = plan.request;
    var routes = plan.cond.routes.slice(0, req.max_routes);
    var d = self.delay;
    var emit = function (type, payload) {
      if (on && on[type]) on[type](payload);
    };

    return sleep(d * 0.6, signal)
      .then(function () {
        emit('status', {
          stage: 'loading',
          replay: true,
          message: 'Loading the recorded run · GPT-5.6 Sol, ' + req.preset + ' preset'
        });
        return sleep(d * 1.6, signal);
      })
      .then(function () {
        emit('status', {
          stage: 'routes',
          replay: true,
          message: 'Replaying ' + routes.length + ' saved route' + (routes.length === 1 ? '' : 's') + ' with their audit verdicts'
        });
        var chain = Promise.resolve();
        routes.forEach(function (r) {
          chain = chain.then(function () {
            return sleep(d, signal).then(function () { emit('route', toApiRoute(r)); });
          });
        });
        return chain;
      })
      .then(function () {
        var passed = routes.filter(function (r) { return r.passed; }).length;
        var firstPass = null;
        routes.forEach(function (r) { if (firstPass === null && r.passed) firstPass = r.rank; });
        emit('done', {
          plan_id: planId,
          replay: true,
          target_smiles: plan.target.smiles,
          target_label: 'Retro*-190 #' + plan.target.index,
          preset: req.preset,
          routes_returned: routes.length,
          routes_passed: passed,
          first_passing_rank: firstPass
        });
      })
      .catch(function (err) {
        if (err && err.code === 'cancelled') { emit('cancelled', { plan_id: planId }); return; }
        emit('error', { code: err.code || 'internal', message: err.message });
      });
  };

  MockClient.prototype.cancelPlan = function (planId) {
    if (this._plans[planId]) this._plans[planId].cancelled = true;
    return Promise.resolve({ plan_id: planId, status: 'cancelled' });
  };

  /* ---------------------------------------------------------------------- */
  /* HTTP transport: the planning service                                    */
  /* ---------------------------------------------------------------------- */

  function HttpClient(opts) {
    this.mode = 'live';
    this.base = opts.base.replace(/\/+$/, '');
    this.token = opts.token || null;
  }

  HttpClient.prototype._headers = function () {
    var h = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (this.token) h.Authorization = 'Bearer ' + this.token;
    return h;
  };

  HttpClient.prototype._json = function (res) {
    return res.text().then(function (text) {
      var body = null;
      try { body = text ? JSON.parse(text) : null; } catch (e) { body = null; }
      if (!res.ok) {
        var e = body && body.error ? body.error : {};
        throw ApiError(e.code || 'http_' + res.status, e.message || ('Request failed (' + res.status + ')'));
      }
      return body;
    });
  };

  HttpClient.prototype.health = function () {
    return fetch(this.base + '/v1/health', { headers: this._headers() }).then(this._json)
      .then(function (body) { body.mode = 'live'; body.live = true; return body; });
  };

  HttpClient.prototype.createPlan = function (request) {
    var req;
    try { req = validateRequest(request); } catch (e) { return Promise.reject(e); }
    return fetch(this.base + '/v1/plans', {
      method: 'POST', headers: this._headers(), body: JSON.stringify(req)
    }).then(this._json);
  };

  // Server-Sent Events over fetch so an Authorization header can be sent.
  HttpClient.prototype.streamPlan = function (planId, on, signal) {
    var emit = function (type, payload) { if (on && on[type]) on[type](payload); };
    var url = this.base + '/v1/plans/' + encodeURIComponent(planId) + '/events';
    var headers = this._headers();
    headers.Accept = 'text/event-stream';
    return fetch(url, { headers: headers, signal: signal }).then(function (res) {
      if (!res.ok || !res.body) throw ApiError('http_' + res.status, 'Event stream failed (' + res.status + ')');
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buf = '';
      function dispatch(block) {
        var type = 'message';
        var data = '';
        block.split('\n').forEach(function (line) {
          if (line.indexOf('event:') === 0) type = line.slice(6).trim();
          else if (line.indexOf('data:') === 0) data += line.slice(5).trim();
        });
        if (!data) return;
        var payload;
        try { payload = JSON.parse(data); } catch (e) { return; }
        emit(type, payload);
      }
      function pump() {
        return reader.read().then(function (chunk) {
          if (chunk.done) { if (buf.trim()) dispatch(buf); return; }
          buf += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, '\n');
          var idx;
          while ((idx = buf.indexOf('\n\n')) >= 0) {
            dispatch(buf.slice(0, idx));
            buf = buf.slice(idx + 2);
          }
          return pump();
        });
      }
      return pump();
    }).catch(function (err) {
      if (err && err.name === 'AbortError') { emit('cancelled', { plan_id: planId }); return; }
      emit('error', { code: err.code || 'network', message: err.message });
    });
  };

  HttpClient.prototype.cancelPlan = function (planId) {
    return fetch(this.base + '/v1/plans/' + encodeURIComponent(planId), {
      method: 'DELETE', headers: this._headers()
    }).then(this._json);
  };

  /* ---------------------------------------------------------------------- */

  function allowedBase(url) {
    url = String(url || '').trim();
    if (!url) return null;
    try {
      var u = new URL(url);
      if (u.protocol === 'https:') return u.href;
      if (u.protocol === 'http:' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname)) return u.href;
    } catch (e) { /* ignore */ }
    return null;
  }

  function createClient(config) {
    var params = new URLSearchParams(global.location.search);
    var base = allowedBase(params.get('api') || config.apiBase || '');
    if (base) return new HttpClient({ base: base, token: config.token });
    return new MockClient({ replayUrl: config.replayUrl, reducedMotion: config.reducedMotion, delay: config.delay });
  }

  global.ReTRACEApi = {
    createClient: createClient,
    MockClient: MockClient,
    HttpClient: HttpClient,
    DEFAULT_WEIGHTS: DEFAULT_WEIGHTS,
    PRESETS: PRESETS,
    normalizeSmiles: normalizeSmiles
  };
})(window);
