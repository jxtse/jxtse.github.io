/* jxtse brand graphics: abstract icon set + generative panels. No photos.
   Grid: 96x96, live area 10..86. Built from circle, rectangle, line only.
   Colour roles are classes so one icon can sit on paper, navy or sage:
   f1 primary, f2 secondary, f3 light, fa coral pointer, fb base; s1/s2/s3 = strokes. */
(function () {
  const C = (cx, cy, r, cls) => `<circle class="${cls}" cx="${cx}" cy="${cy}" r="${r}"/>`;
  const R = (x, y, w, h, cls, extra = '') => `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" ${extra}/>`;
  const L = (x1, y1, x2, y2, cls, w) => `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${w}"/>`;

  const ICONS = {
    /* one memory, three layers: L0 / L1 / L2 */
    memory: R(14,18,68,14,'f1') + R(14,41,46,14,'f2') + R(14,64,24,14,'f3') + C(74,71,7,'fa'),
    /* one source, many agents read from it */
    shared: `<path class="f2" d="M20 80A28 28 0 0 1 76 80Z"/>` + R(10,80,76,5,'f1') +
            R(25,22,4,36,'f1') + R(46,16,4,36,'f1') + R(67,22,4,36,'f1') +
            C(27,20,7,'f1') + C(48,14,7,'fa') + C(69,20,7,'f1'),
    /* recall dose: same vial, three fill levels; coral marks the chosen dose */
    dose: [[12,0.3,'f3'],[40,0.6,'f1'],[68,0.9,'f3']].map(([x,f,cls]) => { const h=(62-8)*f; return `<rect class="s1" x="${x}" y="22" width="16" height="62" stroke-width="4"/>` + R(x+4,80-h,8,h,cls); }).join('') +
          R(34,80-(62-8)*0.6-2,28,4,'fa'),
    /* agents around one hub */
    agents: `<circle class="s3" cx="48" cy="48" r="32" stroke-width="4"/>` + C(48,48,13,'f2') +
            C(48,16,8,'f1') + C(80,48,8,'f1') + C(48,80,8,'f1') + C(16,48,8,'fa'),
    /* collective gains flatten under a ceiling (last disc is cut by it) */
    collective: R(8,14,80,6,'f1') + C(16,80,8,'f2') + C(32,60,8,'f1') + C(48,45,8,'f2') + C(64,35,8,'f1') + C(80,30,8,'fa') +
                L(80,20,80,22,'s3',0),
    /* harness: a frame around the model */
    harness: `<path class="s1" d="M14 34V14H34M62 14H82V34M82 62V82H62M34 82H14V62" stroke-width="6"/>` +
             C(48,48,15,'f2') + C(48,48,5,'fa'),
    /* RL: agent on the loop, reward at the centre */
    loop: `<path class="s1" d="M64.5 22.4A30 30 0 1 1 31.5 22.4" stroke-width="7"/>` +
          `<path class="s1" d="M56 14L66 22L58 32" stroke-width="7"/>` + C(31.5,22.4,7,'f2') + C(48,48,9,'fa'),
    /* retrosynthesis: a ring broken at one bond */
    retro: `<polyline class="s1" points="69,24.9 78,29 78,67 48,84 18,67 18,29 48,12 57,17.1" stroke-width="8" stroke-linejoin="miter"/>` + C(68,12,6,'fa'),
    /* semantic atoms: a sentence bar breaks into countable units */
    atoms: R(10,22,76,10,'f1') + R(10,43,46,10,'f2') + R(62,43,10,10,'f2') + C(80,48,5,'f2') +
           C(15,69,5,'f1') + C(31,69,5,'f1') + C(47,69,5,'f3') + C(63,69,5,'fa') + C(79,69,5,'f3'),
    /* reading / search */
    lens: L(62,62,82,82,'s2',10) + C(42,42,26,'fb') + R(28,32,28,5,'f2') + R(28,41,20,5,'f2') + R(28,50,14,5,'f3') +
          C(52,52,4.5,'fa') + `<circle class="s1" cx="42" cy="42" r="26" stroke-width="6"/>`,
    /* writing */
    writing: `<rect class="s1" x="20" y="12" width="56" height="72" stroke-width="5"/>` + R(30,24,36,7,'f1') +
             R(30,40,36,5,'f2') + R(30,51,36,5,'f2') + R(30,62,20,5,'f2') + C(58,64.5,5,'fa'),
    /* judge / evaluation: tilted beam on a post */
    judge: R(44,44,8,36,'f2') + R(24,80,48,5,'f1') + R(10,38,76,6,'f1','transform="rotate(-10 48 41)"') +
           C(17,31,10,'f1') + C(80,23,6,'fa'),
    /* knowledge graph */
    graph: L(48,48,20,24,'s1',4) + L(48,48,78,22,'s1',4) + L(48,48,80,68,'s1',4) + L(48,48,22,76,'s1',4) + L(78,22,80,68,'s2',3) +
           C(48,48,11,'f1') + C(20,24,7,'f2') + C(78,22,7,'f2') + C(80,68,7,'fa') + C(22,76,7,'f2'),
    /* compounding over time */
    compound: C(14,74,5,'f1') + C(30,66,7,'f1') + C(50,54,10,'f2') + C(74,34,14,'fa') + L(10,86,86,86,'s1',4),
    /* science: a flask, the reaction marked in coral */
    science: R(40,10,16,28,'f1') + R(34,10,28,5,'f1') + C(48,60,25,'f1') + `<path class="f3" d="M27 62A21 21 0 0 0 69 62Z"/>` + C(55,70,5,'fa'),
    /* pipeline: stages step down to an output */
    pipeline: L(30,30,40,30,'s1',5) + L(40,30,40,52,'s1',5) + L(58,58,64,58,'s1',5) + L(64,58,64,70,'s1',5) +
              R(10,18,24,24,'f1') + R(34,46,24,24,'f2') + C(74,79,10,'fa'),
    /* real trace: spans of a run; one span is the moment that mattered */
    trace: L(12,10,12,86,'s1',4) + R(12,16,66,9,'f1') + R(22,32,30,9,'f2') + R(30,48,52,9,'f2') + R(36,64,18,9,'f3') +
           C(78,68,7,'fa'),
  };

  function icon(name, size) {
    return `<svg class="ic" viewBox="0 0 96 96" width="${size}" height="${size}" aria-label="${name}">${ICONS[name]}</svg>`;
  }

  /* concentric rings: a signal spreading from one point */
  function rings(el) {
    const w = el.clientWidth, h = el.clientHeight, d = el.dataset;
    const cx = +d.cx, cy = +d.cy, step = +(d.step || 36), n = +(d.n || 40), sw = d.sw || 1.5;
    let s = '';
    for (let i = 1; i <= n; i++) s += `<circle cx="${cx}" cy="${cy}" r="${i * step}" fill="none" stroke="${d.color}" stroke-opacity="${d.op || .25}" stroke-width="${sw}"/>`;
    el.innerHTML = `<svg width="${w}" height="${h}" style="position:absolute;inset:0">${s}</svg>`;
  }

  /* halftone ramp: dot radius grows along x (or y) */
  function ramp(el) {
    const w = el.clientWidth, h = el.clientHeight, d = el.dataset, p = +(d.pitch || 18), axis = d.axis || 'x';
    let s = '';
    const cols = Math.floor(w / p), rows = Math.floor(h / p), ox = (w - cols * p) / 2 + p / 2, oy = (h - rows * p) / 2 + p / 2;
    for (let yi = 0; yi < rows; yi++) for (let xi = 0; xi < cols; xi++) {
      const x = ox + xi * p, y = oy + yi * p;
      const t = axis === 'x' ? (xi + 1) / cols : 1 - yi / rows, r = Math.max(0, p * 0.36 * Math.pow(t, +(d.gamma || 1.4)));
      if (r > .4) s += `<circle cx="${x}" cy="${y}" r="${r.toFixed(2)}" fill="${d.color}"/>`;
    }
    el.innerHTML = `<svg width="${w}" height="${h}" style="position:absolute;inset:0">${s}</svg>`;
  }

  function hydrate() {
    document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon, +(el.dataset.size || 96)); });
    document.querySelectorAll('[data-rings]').forEach(rings);
    document.querySelectorAll('[data-ramp]').forEach(ramp);
  }
  window.BRAND = { ICONS, icon, hydrate };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hydrate); else hydrate();
})();
