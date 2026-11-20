/*
 * ReTRACE planner client.
 *
 * Two transports behind one interface:
 *   - PlanStore serves completed ReTRACE-27B-latest plans from a static
 *     JSON export (assets/data/retrace-sessions-v1.json), addressable by
 *     plan id (?plan=R190-171).
 *   - HttpClient talks to the planning service (docs/retrace-assistant-api.md).
 *
 * The UI calls health / getPlan / createPlan / streamPlan / continuePlan /
 * cancelPlan only, so pointing the page at a running service is a
 * configuration change (data-api-base or ?api=).
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

  /* ---------------------------------------------------------------------- */
  /* Plan store: completed plans exported from the planner's run records     */
  /* ---------------------------------------------------------------------- */

  function PlanStore(opts) {
    this.mode = 'store';
    this.url = opts.sessionsUrl;
    this._data = null;
  }

  PlanStore.prototype._load = function () {
    var self = this;
    if (self._data) return Promise.resolve(self._data);
    return fetch(self.url, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw ApiError('unavailable', 'Could not load completed plans (' + res.status + ').');
        return res.json();
      })
      .then(function (data) { self._data = data; return data; });
  };

  PlanStore.prototype.health = function () {
    return this._load().then(function () {
      return { mode: 'store', live: false, model: 'ReTRACE-27B-latest', version: 's3-v1' };
    });
  };

  PlanStore.prototype.getPlan = function (planId) {
    var id = String(planId || '').toUpperCase();
    return this._load().then(function (data) {
      var hit = null;
      data.sessions.forEach(function (s) { if (s.id.toUpperCase() === id) hit = s; });
      if (!hit) throw ApiError('not_found', 'No plan with this identifier.');
      return hit;
    });
  };

  PlanStore.prototype.createPlan = function (request) {
    var req;
    try { req = validateRequest(request); } catch (e) { return Promise.reject(e); }
    return this._load().then(function (data) {
      var hit = null;
      data.sessions.forEach(function (s) {
        if (normalizeSmiles(s.target) === req.target_smiles) hit = s;
      });
      if (hit) return { plan_id: hit.id, status: 'completed', session: hit };
      throw ApiError('service_offline',
        'The planning service is not accepting new requests at the moment. Please try again later.');
    });
  };

  PlanStore.prototype.streamPlan = function () {
    return Promise.reject(ApiError('service_offline', 'The planning service is not connected.'));
  };

  PlanStore.prototype.continuePlan = function () {
    return Promise.reject(ApiError('service_offline',
      'Continuing a plan needs the planning service, which is not accepting requests at the moment.'));
  };

  PlanStore.prototype.cancelPlan = function (planId) {
    return Promise.resolve({ plan_id: planId, status: 'cancelled' });
  };

  /* ---------------------------------------------------------------------- */
  /* HTTP transport: the planning service                                    */
  /* ---------------------------------------------------------------------- */

  function HttpClient(opts) {
    this.mode = 'live';
    this.base = opts.base.replace(/\/+$/, '');
    // Per-plan creation token: the service only lets the client that created
    // a plan refine or cancel it. Held in memory, never persisted.
    this.tokens = Object.create(null);
    this.readTokens = Object.create(null);
  }

  HttpClient.prototype._headers = function (planId, accept, write) {
    var h = { 'Content-Type': 'application/json', Accept: accept || 'application/json' };
    var token = planId && this.tokens[planId];
    if (write && token) h['X-Plan-Token'] = token;
    if (!write && planId && this.readTokens[planId]) h['X-Read-Token'] = this.readTokens[planId];
    return h;
  };

  function retryAfter(res) {
    if (res.status !== 429 && res.status !== 503) return 0;
    var value = res.headers.get('Retry-After');
    if (!value) return 0;
    if (/^\d+$/.test(value)) return Number(value) * 1000;
    return Math.max(0, Date.parse(value) - Date.now()) || 0;
  }

  HttpClient.prototype._json = function (res) {
    return res.text().then(function (text) {
      var body = null;
      try { body = text ? JSON.parse(text) : null; } catch (e) { body = null; }
      if (!res.ok) {
        var e = body && body.error ? body.error : {};
        throw ApiError(e.code || 'http_' + res.status, e.message || ('Request failed (' + res.status + ')'), { status: res.status, retryAfter: retryAfter(res) });
      }
      return body;
    });
  };

  HttpClient.prototype.health = function () {
    return fetch(this.base + '/v1/health', { redirect: 'error', headers: this._headers() }).then(this._json)
      .then(function (body) { body.mode = 'live'; body.live = true; return body; });
  };

  HttpClient.prototype.getPlan = function (planId, signal) {
    return fetch(this.base + '/v1/plans/' + encodeURIComponent(planId), {
      redirect: 'error', headers: this._headers(planId), signal: signal
    }).then(this._json);
  };

  HttpClient.prototype.createPlan = function (request) {
    var req;
    try { req = validateRequest(request); } catch (e) { return Promise.reject(e); }
    // The service fixes route count and score weights server-side, so the
    // wire body carries only what it validates.
    var body = { target_smiles: req.target_smiles, preset: req.preset };
    if (req.instructions) body.instructions = req.instructions;
    var self = this;
    return fetch(this.base + '/v1/plans', {
      method: 'POST', redirect: 'error', headers: this._headers(), body: JSON.stringify(body)
    }).then(this._json).then(function (res) {
      if (res && res.plan_id && res.token) {
        self.tokens[res.plan_id] = res.token;
        self.readTokens[res.plan_id] = res.read_token;
      }
      return res;
    });
  };

  HttpClient.prototype.continuePlan = function (planId, body) {
    return fetch(this.base + '/v1/plans/' + encodeURIComponent(planId) + '/continue', {
      method: 'POST', redirect: 'error', headers: this._headers(planId, null, true), body: JSON.stringify(body)
    }).then(this._json);
  };

  // Server-Sent Events over fetch so an Authorization header can be sent.
  HttpClient.prototype.streamPlan = async function (planId, on, signal, since) {
    var self = this;
    var emit = function (type, payload) { if (on && on[type]) on[type](payload); };
    var terminal = false;
    var confirmTerminal = false;
    function pause(ms, stop) {
      return new Promise(function (resolve, reject) {
        function finish() {
          if (stop) stop.removeEventListener('abort', cancel);
          resolve();
        }
        function cancel() {
          clearTimeout(timer);
          reject(ApiError('network', 'Recovery interrupted.'));
        }
        var timer = setTimeout(finish, ms);
        if (stop && stop.aborted) cancel();
        else if (stop) stop.addEventListener('abort', cancel, { once: true });
      });
    }
    var controller = new AbortController();
    var cancel = function () { controller.abort(); };
    var deadline;
    var delay = 1000;
    if (signal) {
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
    }
    function clearRecoveryDeadline() {
      clearTimeout(deadline);
      deadline = undefined;
    }
    function progress() {
      clearRecoveryDeadline();
      delay = 1000;
    }
    function startDeadline() {
      if (!deadline) deadline = setTimeout(cancel, 30000);
    }
    async function backoff(minimum) {
      await pause(Math.min(30000, Math.max(delay, minimum || 0)), controller.signal);
      delay = Math.min(30000, delay * 2);
    }
    async function recover() {
      startDeadline();
      while (!controller.signal.aborted) {
        try { return await self.getPlan(planId, controller.signal); }
        catch (err) {
          if (err.status === 403 || err.status === 404 || controller.signal.aborted) throw err;
          await backoff(err.retryAfter);
        }
      }
      throw ApiError('network', 'Recovery interrupted.');
    }
    function aborted() { return signal && signal.aborted; }
    async function readStream() {
      var stream = new AbortController();
      var timer;
      function stopRead() { stream.abort(); }
      function armRead() {
        clearTimeout(timer);
        timer = setTimeout(stopRead, 30000);
      }
      if (controller.signal.aborted) stopRead();
      controller.signal.addEventListener('abort', stopRead, { once: true });
      armRead();
      try {
        await consumeStream(stream.signal, armRead);
      } finally {
        clearTimeout(timer);
        controller.signal.removeEventListener('abort', stopRead);
        stopRead();
      }
    }
    async function consumeStream(readSignal, armRead) {
      var url = self.base + '/v1/plans/' + encodeURIComponent(planId) + '/events?since=' + (since || 0);
      var res = await fetch(url, { redirect: 'error', headers: self._headers(planId, 'text/event-stream'), signal: readSignal });
      if (!res.ok) return self._json(res);
      if (!res.body) return;
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
        if (type === 'resync' || (payload.seq && payload.seq > (since || 0) + 1)) {
          confirmTerminal = true;
          return true;
        }
        if (payload.seq && payload.seq <= (since || 0)) return;
        var end = type === 'done' || type === 'error' || type === 'quota_exhausted';
        if (end && confirmTerminal) return true;
        if (payload.seq) {
          progress();
          since = payload.seq;
          emit('cursor', since);
        }
        terminal = end;
        emit(type === 'quota_exhausted' ? 'error' : type,
             type === 'quota_exhausted' ? {code: type} : payload);
        return terminal;
      }
      var lines = [];
      var skipLF = false;
      function pump() {
        armRead();
        return reader.read().then(function (chunk) {
          if (chunk.done) return;
          buf += decoder.decode(chunk.value, { stream: true });
          var pos;
          while ((pos = buf.search(/[\r\n]/)) >= 0) {
            var line = buf.slice(0, pos);
            var end = buf.charAt(pos);
            buf = buf.slice(pos + 1);
            var continuation = skipLF && !line && end === '\n';
            skipLF = end === '\r';
            if (continuation) continue;
            if (line.charAt(0) === ':') clearRecoveryDeadline();
            else if (line) lines.push(line);
            else {
              if (dispatch(lines.join('\n'))) return reader.cancel();
              lines = [];
            }
          }
          return pump();
        });
      }
      return pump();
    }
    try {
      while (!aborted() && !terminal) {
        var minimumDelay = 0;
        try { await readStream(); }
        catch (err) {
          if (controller.signal.aborted || err.status === 403 || err.status === 404) throw err;
          minimumDelay = err.retryAfter || 0;
        }
        if (terminal || aborted()) break;
        var snapshot = await recover();
        if (aborted()) break;
        emit('snapshot', snapshot);
        if (snapshot.last_seq > (since || 0)) progress();
        since = Math.max(since || 0, snapshot.last_seq);
        if (snapshot.status !== 'queued' && snapshot.status !== 'running') {
          if (snapshot.error_code) emit('error', { code: snapshot.error_code });
          else emit('done', snapshot);
          break;
        }
        startDeadline();
        await backoff(minimumDelay);
      }
    } catch (err) {
      if (!aborted()) {
        if (controller.signal.aborted) err = ApiError('snapshot_timeout', 'Could not reconnect to this plan within 30 seconds.');
        emit('error', { code: err.code || 'network', message: err.message });
      }
    } finally {
      clearTimeout(deadline);
      if (signal) signal.removeEventListener('abort', cancel);
    }
  };

  HttpClient.prototype.cancelPlan = function (planId) {
    return fetch(this.base + '/v1/plans/' + encodeURIComponent(planId), {
      method: 'DELETE', redirect: 'error', headers: this._headers(planId, null, true)
    }).then(this._json);
  };

  /* ---------------------------------------------------------------------- */

  function allowedBase(url) {
    url = String(url || '').trim();
    if (!url) return null;
    try {
      var u = new URL(url);
      if (u.username || u.password || u.pathname !== '/' || u.search || u.hash) return null;
      if (u.origin === 'https://retrace-gu26.tail6455c4.ts.net') return u.origin;
      if (/^http:\/\/(localhost|127\.0\.0\.1):[0-9]+\/?$/.test(url) &&
          /^(localhost|127\.0\.0\.1)$/.test(global.location.hostname)) return u.origin;
    } catch (e) { /* ignore */ }
    return null;
  }

  function createClient(config) {
    var params = new URLSearchParams(global.location.search);
    var local = /^(localhost|127\.0\.0\.1)$/.test(global.location.hostname);
    var stored = /^R190-[0-9]+$/i.test(params.get('plan') || '');
    var base = !stored && (allowedBase(params.get('api')) || (!local && allowedBase(config.apiBase)));
    if (base) return new HttpClient({ base: base, token: config.token });
    return new PlanStore({ sessionsUrl: config.sessionsUrl });
  }

  global.ReTRACEApi = {
    createClient: createClient,
    PlanStore: PlanStore,
    HttpClient: HttpClient,
    DEFAULT_WEIGHTS: DEFAULT_WEIGHTS,
    PRESETS: PRESETS,
    normalizeSmiles: normalizeSmiles
  };
})(window);
