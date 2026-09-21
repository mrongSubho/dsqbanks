/* Stubborn toggle — compact StickMan-style effort toggle for the question bank.
 *
 * Adapts the "stubborn toggle" interaction (planted hands, lowered head,
 * forward shoulders, bent front knee, braced rear leg, strain, snap, backward
 * launch — mirrored for the opposite direction) to the app's own pill
 * switches (#mcq-toggle "Show answers", #tts-toggle "Text to Speech").
 *
 * - Progressive enhancement: native <input type="checkbox"> stays the source
 *   of truth; the real `change` event fires exactly once per user action so
 *   existing show-answers / TTS handlers keep working.
 * - No demo copy: no gallery, no foley audio (silent, respects the app's own
 *   TTS sound preference), no sample download, no artificial delay to the
 *   underlying operation — the state commits at the snap moment, the payoff
 *   plays after.
 * - Scoped per instance: all queries are rooted at the label; no global IDs.
 * - Accessible: native control, visible focus, aria-busy while playing,
 *   polite live announcements, 44px+ hit area, immediate toggle when
 *   prefers-reduced-motion is set.
 */
(() => {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  // Poses extracted from the reference interaction (only the toggle set).
  // [spineTopX, spineTopY, hipX, hipY, handAX, handAY, elbowAX..., ...legs]
  var RIG = {
    stand: [0, -50, 0, -26, -12, -37, -12, -25, 12, -37, 12, -25, -7, -12, -13, 0, 7, -12, 13, 0],
    toggleContact: [6, -46, -6, -25, 25, -43, 45, -39, 25, -28, 45, -27, -20, -13, -35, 0, 12, -15, 16, 0],
    toggleBrace: [20, -39, -8, -24, 32, -40, 45, -39, 28, -29, 45, -27, -21.5, -12, -35, 0, 16, -16, 16, 0],
    reach: [0, -50, 0, -26, -16, -62, -16, -79, 16, -62, 16, -79, -9, -13, -17, 0, 9, -13, 17, 0],
    flat: [28, -8, 5, -5, 17, -2, 35, 0, 23, -14, 35, -19, -8, -5, -20, 0, -7, -1, -23, 0],
    spent: [-5, -38, 2, -22, -14, -24, -17, -13, 9, -24, 14, -13, -5, -10, -13, 0, 12, -10, 20, 0],
    wave: [0, -50, 0, -26, -12, -37, -12, -25, 17, -43, 19, -61, -7, -12, -13, 0, 7, -12, 13, 0]
  };

  // Timing (seconds) — compressed from the reference to fit a toolbar pill.
  var ENTER_END = 0.28;
  var CONTACT_END = 0.5;
  var SNAP = 1.02;
  var SNAP_END = 1.14;
  var LAUNCH_END = 1.38;
  var FLAT_END = 1.62;
  var TOTAL = 1.78;

  function clamp(x) { return Math.min(1, Math.max(0, x)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function phase(t, a, b) { return clamp((t - a) / (b - a)); }
  function ease(x) { x = clamp(x); return x * x * (3 - 2 * x); }
  function fade(t, a, b, c, d) { return ease(phase(t, a, b)) * (1 - ease(phase(t, c, d))); }

  function bentLimb(ax, ay, bx, by, cx, cy) {
    var bx1 = lerp(bx, ax, 0.15), by1 = lerp(by, ay, 0.15);
    var bx2 = lerp(bx, cx, 0.15), by2 = lerp(by, cy, 0.15);
    return 'M' + ax + ' ' + ay + 'L' + bx1 + ' ' + by1 +
      'Q' + bx + ' ' + by + ' ' + bx2 + ' ' + by2 + 'L' + cx + ' ' + cy;
  }

  function el(name, attrs) {
    var n = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function describe(legend, checked) {
    return legend + (checked ? ' on.' : ' off.');
  }

  function enhance(input, legend) {
    var label = input.closest ? input.closest('label.switch') : input.parentNode;
    if (!label || label.hasAttribute('data-stubborn')) return null;
    label.setAttribute('data-stubborn', '');
    label.classList.add('stubborn');

    var host = input.closest ? input.closest('.pill-group') : null;
    if (host) host.classList.add('stubborn-host');

    // Actor overlay (hands push the HTML pill knob; SVG is decoration only).
    var svg = el('svg', {
      'class': 'stubborn-actor',
      viewBox: '130 215 380 120',
      'aria-hidden': 'true',
      focusable: 'false'
    });
    var ground = el('path', {
      d: 'M141 329q75-2 147 0m9 0 66 1m8-1 72-1',
      'class': 'stubborn-ground'
    });
    var worker = el('g', { 'class': 'stubborn-worker', opacity: '0' });
    var cape = el('path', { 'class': 'stubborn-cape', d: 'M0 0' });
    var spine = el('path', { 'class': 'stubborn-limb' });
    var arms = el('path', { 'class': 'stubborn-limb' });
    var legs = el('path', { 'class': 'stubborn-limb' });
    var expression = el('g', { 'class': 'stubborn-face' });
    var faceBg = el('ellipse', { cy: '-66', rx: '12', ry: '11.5', 'class': 'stubborn-face-bg' });
    var mouth = el('path', { 'class': 'stubborn-feature' });
    var eyes = el('path', { 'class': 'stubborn-feature stubborn-eyes' });
    var brows = el('path', { 'class': 'stubborn-feature stubborn-brows' });
    var palms = el('g', { 'class': 'stubborn-palms' });
    var marks = el('path', { 'class': 'stubborn-marks' });
    expression.appendChild(faceBg);
    expression.appendChild(mouth);
    expression.appendChild(eyes);
    expression.appendChild(brows);
    worker.appendChild(cape);
    worker.appendChild(spine);
    worker.appendChild(arms);
    worker.appendChild(legs);
    worker.appendChild(expression);
    worker.appendChild(palms);
    worker.appendChild(marks);
    svg.appendChild(ground);
    svg.appendChild(worker);
    label.appendChild(svg);

    var bubble = document.createElement('span');
    bubble.className = 'stubborn-bubble';
    bubble.setAttribute('aria-hidden', 'true');
    label.appendChild(bubble);

    var live = document.createElement('span');
    live.className = 'stubborn-live sr-only';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    live.textContent = describe(legend, input.checked);
    label.appendChild(live);

    var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    var busy = false;
    var suppress = false;
    var raf = 0;
    var sceneTime = -1;

    function setBubble(text) {
      if (bubble.textContent !== text) bubble.textContent = text;
      bubble.classList.toggle('is-visible', !!text);
    }

    // Draw the worker. mirror=true reflects the whole gag for ON->OFF.
    function actor(x, y, pose, alpha, rotation, blend, f, mirror, t) {
      var a = RIG[pose];
      var v = a.slice();
      if (blend && RIG[blend]) {
        var b = RIG[blend], k = ease(f);
        for (var i = 0; i < v.length; i++) v[i] = lerp(v[i], b[i], k);
      }
      var time = Math.max(0, t);
      var effort = (pose === 'toggleContact' || pose === 'toggleBrace' ||
        blend === 'toggleContact' || blend === 'toggleBrace');
      var flutter = Math.sin(time * 8 - 1) * 3;
      cape.setAttribute('d',
        'M' + v[0] + ' ' + (v[1] + 1) +
        'C' + (v[0] - 13) + ' ' + (v[1] + 4 - 4) +
        ' ' + (v[0] - 28) + ' ' + (v[1] + 6 + flutter) +
        ' ' + (v[0] - 39) + ' ' + (v[1] + 15 + flutter) +
        'L' + (v[0] - 29) + ' ' + (v[1] + 19 + flutter) +
        'Q' + (v[0] - 27) + ' ' + (v[1] + 28) +
        ' ' + (v[0] - 22) + ' ' + (v[1] + 26) +
        'Q' + (v[0] - 9) + ' ' + (v[1] + 21) +
        ' ' + v[0] + ' ' + (v[1] + 1) + 'Z');
      worker.setAttribute('opacity', String(alpha));
      if (mirror) worker.setAttribute('transform', 'translate(' + (640 - x) + ' ' + y + ') scale(-1 1) rotate(' + rotation + ')');
      else worker.setAttribute('transform', 'translate(' + x + ' ' + y + ') rotate(' + rotation + ')');
      var lean = (pose === 'toggleBrace' || blend === 'toggleBrace') ? 0.7 :
        (pose === 'toggleContact' || blend === 'toggleContact') ? 0.35 : 0;
      spine.setAttribute('d', 'M' + (v[0] + 4 * lean) + ' ' + (v[1] - 5) + 'Q' + (v[0] + 3) + ' ' + (v[1] + 11) + ' ' + v[2] + ' ' + v[3]);
      arms.setAttribute('d', bentLimb(v[0], v[1], v[4], v[5], v[6], v[7]) + bentLimb(v[0], v[1], v[8], v[9], v[10], v[11]));
      legs.setAttribute('d', bentLimb(v[2], v[3], v[12], v[13], v[14], v[15]) + 'q-3-2-7 0q-2 2 7 2' + bentLimb(v[2], v[3], v[16], v[17], v[18], v[19]) + 'q4-2 7 1q1 2-7 1');
      palms.textContent = '';
      var p1 = el('circle', { cx: v[6], cy: v[7], r: '2.3', 'class': 'stubborn-palm' });
      palms.appendChild(p1);
      if (pose !== 'wave') {
        palms.appendChild(el('circle', { cx: v[10], cy: v[11], r: '2.3', 'class': 'stubborn-palm' }));
      }
      var hx = v[0] + 7 * lean, hy = v[1] - 16;
      expression.setAttribute('transform', 'translate(' + hx + ' ' + (v[1] + 50 + 3 * lean) + ') rotate(' + (lean ? 16 * lean : 0) + ' 0 -66)');
      mouth.setAttribute('d', effort ? 'M-5-60q5-5 10 0' : (pose === 'flat' ? 'M-4-60h8' : 'M-4-61q4 3 8 0'));
      eyes.setAttribute('d', effort ? 'M-7-70l4 2-4 2m14-4-4 2 4 2' : (pose === 'flat' ? 'M-7-71l5 5m0-5-5 5m9-5 5 5m0-5-5 5' : 'M-5-69v1m9-1v1'));
      brows.setAttribute('d', effort ? 'M-8-74l5 2m6 0 5-2' : '');
      marks.setAttribute('d', effort ?
        'M' + (hx - 18) + ' ' + (hy - 7) + 'q-5-4-4 1q2 3 4-1m2 9q-6-1-4 3q3 1 4-3' :
        (pose === 'flat' ? 'M' + (hx - 18) + ' ' + (hy - 7) + 'l-4-4m7-2-1-5m30 5 4-4' : ''));
      ground.setAttribute('class', 'stubborn-ground is-visible');
    }

    function hideActor() {
      worker.setAttribute('opacity', '0');
      ground.setAttribute('class', 'stubborn-ground');
      setBubble('');
      label.classList.remove('is-straining');
    }

    function commit(target) {
      if (input.checked === target) return;
      suppress = true;
      input.checked = target;
      try {
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (err) {
        var ev;
        try {
          ev = document.createEvent('HTMLEvents');
          ev.initEvent('change', true, false);
          input.dispatchEvent(ev);
        } catch (ignored) { /* older engines: state already set */ }
      }
      suppress = false;
      live.textContent = describe(legend, target);
    }

    // One performance of the gag toward `target`. State commits at the snap.
    function render(t, target, mirror) {
      sceneTime = t;
      var pushX = 239, pushY = 307;
      var startX = mirror ? pushX + 70 : pushX - 70;
      var x = pushX, y = pushY, r = 0, pose = 'stand', next = null, f = 0, alpha = 1;
      if (t < ENTER_END) {
        var k = ease(phase(t, 0, ENTER_END));
        x = lerp(startX, pushX, k);
        pose = 'stand'; next = 'toggleContact'; f = phase(t, 0, ENTER_END);
        alpha = fade(t, 0, 0.12, TOTAL, TOTAL - 0.25);
      } else if (t < CONTACT_END) {
        pose = 'toggleContact'; next = 'toggleBrace'; f = phase(t, ENTER_END, CONTACT_END);
      } else if (t < SNAP) {
        pose = 'toggleContact'; next = 'toggleBrace';
        f = 0.91 + Math.sin(t * 52) * 0.07; // held strain, from the reference
      } else if (t < SNAP_END) {
        var s = phase(t, SNAP, SNAP_END);
        pose = 'toggleBrace'; next = 'reach'; f = s;
        x = pushX - 7 * ease(s); y = pushY - 12 * ease(s); r = -18 * ease(s);
      } else if (t < LAUNCH_END) {
        var g = phase(t, SNAP_END, LAUNCH_END);
        x = lerp(pushX - 7, mirror ? pushX + 62 : pushX - 62, g);
        y = (pushY - 12) - Math.sin(g * Math.PI) * 55 + 12 * g;
        r = lerp(-18, -300, g);
        pose = 'reach';
      } else if (t < FLAT_END) {
        x = mirror ? pushX + 62 : pushX - 62; y = pushY; r = 0; pose = 'flat';
        alpha = 1;
      } else {
        x = mirror ? pushX + 62 : pushX - 62; y = pushY; pose = 'spent';
        alpha = 1 - ease(phase(t, FLAT_END + 0.05, TOTAL));
      }
      actor(x, y, pose, alpha, r, next, f, mirror, t);
      label.classList.toggle('is-straining', t >= ENTER_END && t < SNAP);
      if (t < SNAP) setBubble(t < CONTACT_END ? '' : 'Heave…');
      else if (t < LAUNCH_END) setBubble('Whoa!');
      else setBubble('');
    }

    function finish(target) {
      busy = false;
      input.setAttribute('aria-busy', 'false');
      cancelAnimationFrame(raf);
      hideActor();
      live.textContent = describe(legend, target) + ' Worth it.';
    }

    function play(target) {
      var mirror = target === false; // mirror the pose for the OFF direction
      busy = true;
      input.setAttribute('aria-busy', 'true');
      var committed = false;
      var start = null;
      function tick(now) {
        if (!start) start = now;
        var t = (now - start) / 1000;
        if (t >= SNAP && !committed) {
          committed = true;
          commit(target); // real action succeeds here; payoff follows
        }
        render(Math.min(t, TOTAL), target, mirror);
        if (t < TOTAL) raf = requestAnimationFrame(tick);
        else finish(target);
      }
      raf = requestAnimationFrame(tick);
    }

    function onClick(e) {
      if (busy) { e.preventDefault(); return; }
      var target = !input.checked;
      e.preventDefault(); // hold the state until the snap lands it
      try { input.focus({ preventScroll: true }); } catch (err) { input.focus(); }
      if (reduce.matches) { commit(target); return; }
      play(target);
    }

    input.addEventListener('click', onClick);
    input.addEventListener('change', function () {
      if (suppress || busy) return; // programmatic sync (sort re-render etc.)
      live.textContent = describe(legend, input.checked);
    });
    input.setAttribute('aria-busy', 'false');

    function destroy() {
      cancelAnimationFrame(raf);
      input.removeEventListener('click', onClick);
      if (svg.parentNode === label) label.removeChild(svg);
      if (bubble.parentNode === label) label.removeChild(bubble);
      if (live.parentNode === label) label.removeChild(live);
      label.classList.remove('stubborn', 'is-straining');
      label.removeAttribute('data-stubborn');
      if (host) host.classList.remove('stubborn-host');
    }

    return { destroy: destroy, input: input };
  }

  var instances = [];

  function init() {
    var jobs = [
      ['mcq-toggle', 'Show answers'],
      ['tts-toggle', 'Text to speech']
    ];
    jobs.forEach(function (job) {
      var input = document.getElementById(job[0]);
      if (input) {
        var inst = enhance(input, job[1]);
        if (inst) instances.push(inst);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('pagehide', function () {
    instances.forEach(function (inst) {
      try {
        if (inst.input) inst.input.setAttribute('aria-busy', 'false');
      } catch (ignored) { /* teardown only */ }
    });
  });

  window.__stubbornToggles = { enhance: enhance, instances: instances };
})();
